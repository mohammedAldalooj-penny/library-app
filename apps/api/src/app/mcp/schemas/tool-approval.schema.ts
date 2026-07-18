import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type {
  BookToolName,
  ToolApprovalStatus,
} from '@library-app/shared-models';
import { SchemaTypes, Types } from 'mongoose';

@Schema({ collection: 'tool_approvals', timestamps: true, versionKey: false })
export class ToolApprovalEntity {
  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  chatId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  toolName!: BookToolName;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  arguments!: Record<string, unknown>;

  @Prop({ required: true, select: false })
  argumentsHash!: string;

  @Prop({ required: true, maxlength: 240 })
  summary!: string;

  @Prop({
    type: String,
    enum: [
      'pending',
      'approved',
      'rejected',
      'executing',
      'completed',
      'failed',
    ],
    default: 'pending',
    index: true,
  })
  status!: ToolApprovalStatus;

  @Prop({ required: true, expires: 0 })
  expiresAt!: Date;
}

export const ToolApprovalSchema =
  SchemaFactory.createForClass(ToolApprovalEntity);

ToolApprovalSchema.index({ chatId: 1, status: 1, createdAt: -1 });
