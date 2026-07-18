import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BookDocument = HydratedDocument<BookEntity>;

@Schema({ collection: 'books', timestamps: true, versionKey: false })
export class BookEntity {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  author!: string;

  @Prop({ trim: true, unique: true, sparse: true })
  isbn?: string;

  @Prop({ trim: true, maxlength: 2000 })
  description?: string;

  @Prop({ min: 0, max: new Date().getFullYear() + 1 })
  publishedYear?: number;

  @Prop({
    type: String,
    enum: ['available', 'checked_out'],
    default: 'available',
  })
  status!: 'available' | 'checked_out';

  @Prop({ type: Date })
  checkedOutAt?: Date;
}

export const BookSchema = SchemaFactory.createForClass(BookEntity);

BookSchema.index({ title: 1, author: 1 });
