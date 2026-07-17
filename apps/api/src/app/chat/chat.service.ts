import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  ChatMessage,
  ChatStreamEvent,
  ChatSummary,
  DeleteChatResponse,
} from '@library-app/shared-models';
import { isValidObjectId, Model, Types } from 'mongoose';
import { BooksService } from '../books/books.service';
import { GeminiService } from './gemini.service';
import { ChatConversationEntity } from './schemas/chat-conversation.schema';
import { ChatMessageEntity } from './schemas/chat-message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatConversationEntity.name)
    private readonly conversationModel: Model<ChatConversationEntity>,
    @InjectModel(ChatMessageEntity.name)
    private readonly messageModel: Model<ChatMessageEntity>,
    private readonly gemini: GeminiService,
    private readonly booksService: BooksService,
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
    const books = await this.booksService.findAll();
    let response = '';

    for await (const chunk of this.gemini.streamReply(history, books)) {
      response += chunk;
      yield { type: 'delta', content: chunk };
    }

    if (!response.trim()) {
      throw new ServiceUnavailableException(
        'Gemini returned an empty response',
      );
    }

    const saved = await this.messageModel.create({
      chatId: objectId,
      role: 'assistant',
      content: response.trim(),
    });
    await this.conversationModel
      .findByIdAndUpdate(chatId, { lastMessage: this.preview(response) })
      .exec();

    yield {
      type: 'done',
      message: saved.toObject() as unknown as ChatMessage,
    };
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
