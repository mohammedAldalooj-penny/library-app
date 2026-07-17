import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';
import { BookEntity } from './schemas/book.schema';

describe('BooksService', () => {
  const exec = jest.fn();
  const lean = jest.fn(() => ({ exec }));
  const sort = jest.fn(() => ({ lean }));
  const model = {
    create: jest.fn(),
    find: jest.fn(() => ({ sort })),
    findById: jest.fn(() => ({ lean })),
    findByIdAndDelete: jest.fn(() => ({ lean })),
    findByIdAndUpdate: jest.fn(() => ({ lean })),
  };
  let service: BooksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: getModelToken(BookEntity.name), useValue: model },
      ],
    }).compile();
    service = module.get(BooksService);
  });

  it('creates a book', async () => {
    const book = { _id: '507f1f77bcf86cd799439011', title: 'Dune' };
    model.create.mockResolvedValue({ toObject: () => book });

    await expect(
      service.create({ title: 'Dune', author: 'Frank Herbert' }),
    ).resolves.toEqual(book);
  });

  it('searches across the book fields', async () => {
    exec.mockResolvedValue([]);
    await service.findAll('dune');

    expect(model.find).toHaveBeenCalledWith({
      $or: expect.arrayContaining([
        { title: { $regex: 'dune', $options: 'i' } },
        { author: { $regex: 'dune', $options: 'i' } },
      ]),
    });
  });

  it('rejects malformed ids', async () => {
    await expect(service.findOne('not-an-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns not found for a missing book', async () => {
    exec.mockResolvedValue(null);
    await expect(
      service.findOne('507f1f77bcf86cd799439011'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unsets optional fields when they are cleared', async () => {
    exec.mockResolvedValue({ _id: '507f1f77bcf86cd799439011' });

    await service.update('507f1f77bcf86cd799439011', {
      description: null,
      isbn: '',
    });

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      { $set: {}, $unset: { description: 1, isbn: 1 } },
      { returnDocument: 'after', runValidators: true },
    );
  });
});
