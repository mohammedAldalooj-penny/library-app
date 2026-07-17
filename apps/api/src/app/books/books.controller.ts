import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Book, DeleteBookResponse } from '@library-app/shared-models';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  create(@Body() input: CreateBookDto): Promise<Book> {
    return this.booksService.create(input);
  }

  @Get()
  findAll(@Query('q') query?: string): Promise<Book[]> {
    return this.booksService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Book> {
    return this.booksService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateBookDto): Promise<Book> {
    return this.booksService.update(id, input);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<DeleteBookResponse> {
    return this.booksService.remove(id);
  }
}
