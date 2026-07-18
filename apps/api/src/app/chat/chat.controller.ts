import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Logger,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type {
  ChatMessage,
  ChatStreamEvent,
  ChatSummary,
  ChatToolApproval,
  DeleteChatResponse,
  ResolveToolApprovalResponse,
} from '@library-app/shared-models';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ResolveToolApprovalDto } from './dto/resolve-tool-approval.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chats')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post()
  create(): Promise<ChatSummary> {
    return this.chatService.create();
  }

  @Get()
  findAll(): Promise<ChatSummary[]> {
    return this.chatService.findAll();
  }

  @Get(':id/messages')
  findMessages(@Param('id') id: string): Promise<ChatMessage[]> {
    return this.chatService.findMessages(id);
  }

  @Get(':id/approval')
  findPendingApproval(
    @Param('id') id: string,
  ): Promise<ChatToolApproval | null> {
    return this.chatService.findPendingApproval(id);
  }

  @Post(':id/approvals/:approvalId')
  resolveApproval(
    @Param('id') id: string,
    @Param('approvalId') approvalId: string,
    @Body() input: ResolveToolApprovalDto,
  ): Promise<ResolveToolApprovalResponse> {
    return this.chatService.resolveApproval(id, approvalId, input.approved);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() input: SendMessageDto,
    @Res() response: Response,
  ): Promise<void> {
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    try {
      for await (const event of this.chatService.streamMessage(
        id,
        input.content,
      )) {
        response.write(`${JSON.stringify(event)}\n`);
      }
    } catch (error) {
      this.logger.error(
        'Unable to generate a chat response',
        error instanceof Error ? error.stack : undefined,
      );
      const event: ChatStreamEvent = {
        type: 'error',
        message:
          error instanceof HttpException
            ? error.message
            : 'Unable to generate a response right now.',
      };
      response.write(`${JSON.stringify(event)}\n`);
    } finally {
      response.end();
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<DeleteChatResponse> {
    return this.chatService.remove(id);
  }
}
