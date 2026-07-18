import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BooksModule } from '../books/books.module';
import { BooksMcpServer } from './books-mcp.server';
import { McpController } from './mcp.controller';
import {
  ToolApprovalEntity,
  ToolApprovalSchema,
} from './schemas/tool-approval.schema';
import { ToolApprovalService } from './tool-approval.service';

@Module({
  imports: [
    BooksModule,
    MongooseModule.forFeature([
      { name: ToolApprovalEntity.name, schema: ToolApprovalSchema },
    ]),
  ],
  controllers: [McpController],
  providers: [BooksMcpServer, ToolApprovalService],
  exports: [BooksMcpServer, ToolApprovalService],
})
export class McpModule {}
