import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ToolApprovalModule } from '../mcp/approvals/tool-approval.module';
import { BooksService } from './books.service';
import { BooksController } from './http/books.controller';
import { BooksMcpServer } from './mcp/books-mcp.server';
import { BookEntity, BookSchema } from './schemas/book.schema';

@Module({
  imports: [
    ToolApprovalModule,
    MongooseModule.forFeature([{ name: BookEntity.name, schema: BookSchema }]),
  ],
  controllers: [BooksController],
  providers: [BooksService, BooksMcpServer],
  exports: [BooksService, BooksMcpServer],
})
export class BooksModule {}
