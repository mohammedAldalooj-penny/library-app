import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ChatConversationEntity } from './chat-conversation.schema';

@Schema({ collection: 'chat_messages', timestamps: true, versionKey: false })
export class ChatMessageEntity {
  @Prop({
    type: Types.ObjectId,
    ref: ChatConversationEntity.name,
    required: true,
    index: true,
  })
  chatId!: Types.ObjectId;

  @Prop({ enum: ['user', 'assistant'], required: true })
  role!: 'user' | 'assistant';

  @Prop({ maxlength: 50000, required: true })
  content!: string;
}

export const ChatMessageSchema =
  SchemaFactory.createForClass(ChatMessageEntity);

ChatMessageSchema.index({ chatId: 1, createdAt: 1 });
