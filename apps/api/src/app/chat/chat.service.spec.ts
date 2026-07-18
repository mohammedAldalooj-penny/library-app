import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { BooksMcpServer } from '../mcp/books-mcp.server';
import { ToolApprovalService } from '../mcp/tool-approval.service';
import { ChatService } from './chat.service';
import { GeminiService } from './gemini.service';
import { ChatConversationEntity } from './schemas/chat-conversation.schema';
import { ChatMessageEntity } from './schemas/chat-message.schema';

describe('ChatService', () => {
  const conversationModel = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };
  const messageModel = {
    deleteMany: jest.fn(),
  };
  let service: ChatService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getModelToken(ChatConversationEntity.name),
          useValue: conversationModel,
        },
        {
          provide: getModelToken(ChatMessageEntity.name),
          useValue: messageModel,
        },
        { provide: GeminiService, useValue: {} },
        { provide: BooksMcpServer, useValue: {} },
        { provide: ToolApprovalService, useValue: {} },
      ],
    }).compile();
    service = module.get(ChatService);
  });

  it('creates a new conversation', async () => {
    const chat = { _id: '507f1f77bcf86cd799439011', title: 'New chat' };
    conversationModel.create.mockResolvedValue({ toObject: () => chat });

    await expect(service.create()).resolves.toEqual(chat);
    expect(conversationModel.create).toHaveBeenCalledWith({
      title: 'New chat',
    });
  });

  it('rejects malformed chat ids before querying MongoDB', async () => {
    await expect(service.findMessages('not-an-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(conversationModel.findById).not.toHaveBeenCalled();
  });

  it('deletes a conversation and all of its messages', async () => {
    const execDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 2 });
    conversationModel.findByIdAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011' }),
    });
    messageModel.deleteMany.mockReturnValue({ exec: execDeleteMany });

    await expect(service.remove('507f1f77bcf86cd799439011')).resolves.toEqual({
      deleted: true,
    });
    expect(messageModel.deleteMany).toHaveBeenCalled();
  });
});
