import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  Book,
  BookToolName,
  ChatMessage,
  ChatStreamEvent,
  ChatSummary,
  ChatToolApproval,
  DeleteChatResponse,
  ResolveToolApprovalResponse,
} from '@library-app/shared-models';
import { isValidObjectId, Model, Types } from 'mongoose';
import { BooksMcpServer } from '../mcp/books-mcp.server';
import { ToolApprovalService } from '../mcp/tool-approval.service';
import { GeminiService, ToolExecution } from './gemini.service';
import { ChatConversationEntity } from './schemas/chat-conversation.schema';
import { ChatMessageEntity } from './schemas/chat-message.schema';

const MUTATING_TOOLS = new Set<BookToolName>([
  'create_book',
  'update_book',
  'delete_book',
  'checkout_book',
  'check_in_book',
]);

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatConversationEntity.name)
    private readonly conversationModel: Model<ChatConversationEntity>,
    @InjectModel(ChatMessageEntity.name)
    private readonly messageModel: Model<ChatMessageEntity>,
    private readonly gemini: GeminiService,
    private readonly booksMcp: BooksMcpServer,
    private readonly approvals: ToolApprovalService,
  ) {}

  async create(): Promise<ChatSummary> {
    const conversation = await this.conversationModel.create({
      title: 'New chat',
    });
    return conversation.toObject() as unknown as ChatSummary;
  }

  async findAll(): Promise<ChatSummary[]> {
    return this.conversationModel
      .find()
      .sort({ updatedAt: -1 })
      .lean<ChatSummary[]>()
      .exec();
  }

  async findMessages(chatId: string): Promise<ChatMessage[]> {
    await this.findConversation(chatId);
    return this.messageModel
      .find({ chatId: new Types.ObjectId(chatId) })
      .sort({ createdAt: 1 })
      .lean<ChatMessage[]>()
      .exec();
  }

  async findPendingApproval(chatId: string): Promise<ChatToolApproval | null> {
    await this.findConversation(chatId);
    return this.approvals.findPending(chatId);
  }

  async resolveApproval(
    chatId: string,
    approvalId: string,
    approved: boolean,
  ): Promise<ResolveToolApprovalResponse> {
    await this.findConversation(chatId);
    if (!approved) {
      const approval = await this.approvals.reject(chatId, approvalId);
      const message = await this.saveAssistantMessage(
        chatId,
        `Cancelled — I did not ${approval.summary}.`,
      );
      return { approval, message };
    }

    const authorized = await this.approvals.approve(chatId, approvalId);
    const output = await this.booksMcp.callTool(authorized.toolName, {
      ...authorized.arguments,
      approvalId: authorized._id.toString(),
    });
    const approval = await this.approvals.findById(approvalId);
    const message = await this.saveAssistantMessage(
      chatId,
      this.formatToolResult(authorized.toolName, output),
    );
    return { approval, message };
  }

  async remove(chatId: string): Promise<DeleteChatResponse> {
    this.assertValidId(chatId);
    const deleted = await this.conversationModel
      .findByIdAndDelete(chatId)
      .exec();
    if (!deleted) {
      throw new NotFoundException('Chat not found');
    }
    await this.messageModel.deleteMany({ chatId: deleted._id }).exec();
    return { deleted: true };
  }

  async *streamMessage(
    chatId: string,
    content: string,
  ): AsyncGenerator<ChatStreamEvent> {
    const conversation = await this.findConversation(chatId);
    const objectId = new Types.ObjectId(chatId);
    await this.messageModel.create({
      chatId: objectId,
      role: 'user',
      content,
    });

    const title =
      conversation.title === 'New chat'
        ? this.titleFrom(content)
        : conversation.title;
    await this.conversationModel
      .findByIdAndUpdate(chatId, {
        title,
        lastMessage: this.preview(content),
      })
      .exec();

    const history = await this.messageModel
      .find({ chatId: objectId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean<ChatMessage[]>()
      .exec();
    history.reverse();
    const tools = await this.booksMcp.listTools();
    let response = '';

    for await (const event of this.gemini.reply(
      history,
      tools,
      (name, args) => this.executeTool(chatId, tools, name, args),
    )) {
      if (event.type === 'text') {
        response += event.content;
        yield { type: 'delta', content: event.content };
        continue;
      }

      response = `I’m ready to ${event.approval.summary}. Please approve or cancel this action.`;
      yield { type: 'delta', content: response };
      yield { type: 'approval_required', approval: event.approval };
    }

    if (!response.trim()) {
      throw new BadRequestException('The assistant did not produce a response');
    }

    const saved = await this.saveAssistantMessage(chatId, response.trim());
    yield { type: 'done', message: saved };
  }

  private async executeTool(
    chatId: string,
    tools: Awaited<ReturnType<BooksMcpServer['listTools']>>,
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecution> {
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) {
      throw new BadRequestException(`Unknown library tool: ${name}`);
    }
    if (tool.readOnly) {
      return { type: 'result', output: await this.booksMcp.callTool(name, args) };
    }
    if (!MUTATING_TOOLS.has(name as BookToolName)) {
      throw new BadRequestException(`Unsupported mutating tool: ${name}`);
    }
    const toolName = name as BookToolName;
    const summary = await this.booksMcp.describeAction(toolName, args);
    const approval = await this.approvals.request(
      chatId,
      toolName,
      args,
      summary,
    );
    return { type: 'approval', approval };
  }

  private async saveAssistantMessage(
    chatId: string,
    content: string,
  ): Promise<ChatMessage> {
    const saved = await this.messageModel.create({
      chatId: new Types.ObjectId(chatId),
      role: 'assistant',
      content,
    });
    await this.conversationModel
      .findByIdAndUpdate(chatId, { lastMessage: this.preview(content) })
      .exec();
    return saved.toObject() as unknown as ChatMessage;
  }

  private formatToolResult(toolName: BookToolName, output: unknown): string {
    if (toolName === 'delete_book') {
      return 'Done — the book was permanently deleted from your library.';
    }
    const book = output as Book;
    const messages: Record<Exclude<BookToolName, 'delete_book'>, string> = {
      create_book: `Done — added **${book.title}** by ${book.author}.`,
      update_book: `Done — updated **${book.title}** by ${book.author}.`,
      checkout_book: `Done — **${book.title}** is now checked out.`,
      check_in_book: `Done — **${book.title}** is now available.`,
    };
    return messages[toolName];
  }

  private async findConversation(
    chatId: string,
  ): Promise<ChatConversationEntity> {
    this.assertValidId(chatId);
    const conversation = await this.conversationModel.findById(chatId).exec();
    if (!conversation) {
      throw new NotFoundException('Chat not found');
    }
    return conversation;
  }

  private assertValidId(id: string): void {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid chat id');
    }
  }

  private titleFrom(content: string): string {
    const compact = content.replace(/\s+/g, ' ').trim();
    return compact.length > 54 ? `${compact.slice(0, 51)}…` : compact;
  }

  private preview(content: string): string {
    const compact = content.replace(/\s+/g, ' ').trim();
    return compact.length > 150 ? `${compact.slice(0, 147)}…` : compact;
  }
}
