import { createHash } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  BookToolName,
  ChatToolApproval,
} from '@library-app/shared-models';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ToolApprovalEntity } from './schemas/tool-approval.schema';

@Injectable()
export class ToolApprovalService {
  constructor(
    @InjectModel(ToolApprovalEntity.name)
    private readonly approvalModel: Model<ToolApprovalEntity>,
  ) {}

  async request(
    chatId: string,
    toolName: BookToolName,
    args: Record<string, unknown>,
    summary: string,
  ): Promise<ChatToolApproval> {
    await this.approvalModel
      .updateMany(
        { chatId: new Types.ObjectId(chatId), status: 'pending' },
        { $set: { status: 'rejected' } },
      )
      .exec();
    const approval = await this.approvalModel.create({
      chatId: new Types.ObjectId(chatId),
      toolName,
      arguments: args,
      argumentsHash: hashArguments(args),
      summary,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    return this.toPublicApproval(
      approval.toObject() as unknown as Record<string, unknown>,
    );
  }

  async findPending(chatId: string): Promise<ChatToolApproval | null> {
    const approval = await this.approvalModel
      .findOne({
        chatId: new Types.ObjectId(chatId),
        status: 'pending',
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .lean<ChatToolApproval>()
      .exec();
    return approval
      ? this.toPublicApproval(approval as unknown as Record<string, unknown>)
      : null;
  }

  async findById(approvalId: string): Promise<ChatToolApproval> {
    this.assertApprovalId(approvalId);
    const approval = await this.approvalModel
      .findById(approvalId)
      .lean<ChatToolApproval>()
      .exec();
    if (!approval) {
      throw new ConflictException('Tool approval was not found');
    }
    return this.toPublicApproval(
      approval as unknown as Record<string, unknown>,
    );
  }

  async approve(chatId: string, approvalId: string): Promise<ChatToolApproval> {
    return this.setDecision(chatId, approvalId, 'approved');
  }

  async reject(chatId: string, approvalId: string): Promise<ChatToolApproval> {
    return this.setDecision(chatId, approvalId, 'rejected');
  }

  async consume(
    approvalId: string,
    toolName: BookToolName,
    args: Record<string, unknown>,
  ): Promise<void> {
    this.assertApprovalId(approvalId);
    const approval = await this.approvalModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(approvalId),
          toolName,
          argumentsHash: hashArguments(args),
          status: 'approved',
          expiresAt: { $gt: new Date() },
        },
        { $set: { status: 'executing' } },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    if (!approval) {
      throw new ConflictException(
        'This action is not approved, has changed, or has expired',
      );
    }
  }

  async complete(approvalId: string): Promise<ChatToolApproval> {
    return this.finish(approvalId, 'completed');
  }

  async fail(approvalId: string): Promise<void> {
    await this.finish(approvalId, 'failed');
  }

  async removeForChat(chatId: string): Promise<void> {
    await this.approvalModel
      .deleteMany({ chatId: new Types.ObjectId(chatId) })
      .exec();
  }

  private async setDecision(
    chatId: string,
    approvalId: string,
    status: 'approved' | 'rejected',
  ): Promise<ChatToolApproval> {
    this.assertApprovalId(approvalId);
    const approval = await this.approvalModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(approvalId),
          chatId: new Types.ObjectId(chatId),
          status: 'pending',
          expiresAt: { $gt: new Date() },
        },
        { $set: { status } },
        { returnDocument: 'after' },
      )
      .lean<ChatToolApproval>()
      .exec();
    if (!approval) {
      throw new ConflictException('This action is no longer awaiting approval');
    }
    return this.toPublicApproval(
      approval as unknown as Record<string, unknown>,
    );
  }

  private async finish(
    approvalId: string,
    status: 'completed' | 'failed',
  ): Promise<ChatToolApproval> {
    this.assertApprovalId(approvalId);
    const approval = await this.approvalModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(approvalId), status: 'executing' },
        { $set: { status } },
        { returnDocument: 'after' },
      )
      .lean<ChatToolApproval>()
      .exec();
    if (!approval) {
      throw new ConflictException('Unable to finish this approved action');
    }
    return this.toPublicApproval(
      approval as unknown as Record<string, unknown>,
    );
  }

  private toPublicApproval(value: Record<string, unknown>): ChatToolApproval {
    const approval = { ...value };
    delete approval['argumentsHash'];
    return approval as unknown as ChatToolApproval;
  }

  private assertApprovalId(approvalId: string): void {
    if (!isValidObjectId(approvalId)) {
      throw new ConflictException('Tool approval was not found');
    }
  }
}

export function hashArguments(args: Record<string, unknown>): string {
  return createHash('sha256').update(stableJson(args)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
