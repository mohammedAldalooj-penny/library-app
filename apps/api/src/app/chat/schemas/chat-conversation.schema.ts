import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  collection: 'chat_conversations',
  timestamps: true,
  versionKey: false,
})
export class ChatConversationEntity {
  @Prop({ default: 'New chat', maxlength: 80, trim: true })
  title!: string;

  @Prop({ maxlength: 180, trim: true })
  lastMessage?: string;
}

export const ChatConversationSchema = SchemaFactory.createForClass(
  ChatConversationEntity,
);

ChatConversationSchema.index({ updatedAt: -1 });
