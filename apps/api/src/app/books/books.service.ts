import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Book, DeleteBookResponse } from '@library-app/shared-models';
import { isValidObjectId, Model } from 'mongoose';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookEntity } from './schemas/book.schema';

type MongoDuplicateError = Error & { code?: number };

@Injectable()
export class BooksService {
  constructor(
    @InjectModel(BookEntity.name)
    private readonly bookModel: Model<BookEntity>,
  ) {}

  async create(input: CreateBookDto): Promise<Book> {
    try {
      const created = await this.bookModel.create(
        this.cleanOptionalFields(input),
      );
      return created.toObject() as unknown as Book;
    } catch (error) {
      this.handleDuplicate(error);
      throw error;
    }
  }

  async findAll(query?: string): Promise<Book[]> {
    const term = query?.trim();
    const filter = term
      ? {
          $or: ['title', 'author', 'isbn', 'description'].map((field) => ({
            [field]: { $regex: this.escapeRegex(term), $options: 'i' },
          })),
        }
      : {};

    return this.bookModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean<Book[]>()
      .exec();
  }

  async findOne(id: string): Promise<Book> {
    this.assertValidId(id);
    const book = await this.bookModel.findById(id).lean<Book>().exec();
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    return book;
  }

  async update(id: string, input: UpdateBookDto): Promise<Book> {
    this.assertValidId(id);
    try {
      const book = await this.bookModel
        .findByIdAndUpdate(id, this.buildUpdate(input), {
          returnDocument: 'after',
          runValidators: true,
        })
        .lean<Book>()
        .exec();
      if (!book) {
        throw new NotFoundException('Book not found');
      }
      return book;
    } catch (error) {
      this.handleDuplicate(error);
      throw error;
    }
  }

  async remove(id: string): Promise<DeleteBookResponse> {
    this.assertValidId(id);
    const deleted = await this.bookModel.findByIdAndDelete(id).lean().exec();
    if (!deleted) {
      throw new NotFoundException('Book not found');
    }
    return { deleted: true };
  }

  async checkout(id: string): Promise<Book> {
    this.assertValidId(id);
    const current = await this.findOne(id);
    if (current.status === 'checked_out') {
      throw new ConflictException('Book is already checked out');
    }
    return this.setCheckoutStatus(id, 'checked_out', new Date());
  }

  async checkIn(id: string): Promise<Book> {
    this.assertValidId(id);
    const current = await this.findOne(id);
    if (current.status !== 'checked_out') {
      throw new ConflictException('Book is not checked out');
    }
    return this.setCheckoutStatus(id, 'available');
  }

  private assertValidId(id: string): void {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid book id');
    }
  }

  private cleanOptionalFields<T extends object>(input: T): T {
    return Object.fromEntries(
      Object.entries(input).filter(
        ([, value]) => value !== '' && value != null,
      ),
    ) as T;
  }

  private buildUpdate(input: UpdateBookDto): {
    $set: Record<string, unknown>;
    $unset: Record<string, 1>;
  } {
    const entries = Object.entries(input);
    return {
      $set: Object.fromEntries(
        entries.filter(([, value]) => value !== '' && value != null),
      ),
      $unset: Object.fromEntries(
        entries
          .filter(([, value]) => value === '' || value == null)
          .map(([key]) => [key, 1]),
      ),
    };
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private handleDuplicate(error: unknown): void {
    if ((error as MongoDuplicateError)?.code === 11000) {
      throw new ConflictException('A book with this ISBN already exists');
    }
  }

  private async setCheckoutStatus(
    id: string,
    status: 'available' | 'checked_out',
    checkedOutAt?: Date,
  ): Promise<Book> {
    const update = checkedOutAt
      ? { $set: { status, checkedOutAt } }
      : { $set: { status }, $unset: { checkedOutAt: 1 } };
    const book = await this.bookModel
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .lean<Book>()
      .exec();
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    return book;
  }
}
