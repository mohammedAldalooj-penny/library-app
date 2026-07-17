import { Transform, Type } from 'class-transformer';
import {
  IsISBN,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateBookDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  author!: string;

  @Transform(trim)
  @IsOptional()
  @IsISBN()
  isbn?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(new Date().getFullYear() + 1)
  publishedYear?: number;
}
