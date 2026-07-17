import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BooksModule } from '../books/books.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { GeminiService } from './gemini.service';
import {
  ChatConversationEntity,
  ChatConversationSchema,
} from './schemas/chat-conversation.schema';
import {
  ChatMessageEntity,
  ChatMessageSchema,
} from './schemas/chat-message.schema';

@Module({
  imports: [
    BooksModule,
    MongooseModule.forFeature([
      {
        name: ChatConversationEntity.name,
        schema: ChatConversationSchema,
      },
      { name: ChatMessageEntity.name, schema: ChatMessageSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, GeminiService],
})
export class ChatModule {}
