import { Module } from '@nestjs/common';
import { BooksModule } from '../books/books.module';
import { McpController } from './mcp.controller';

@Module({
  imports: [BooksModule],
  controllers: [McpController],
})
export class McpModule {}
