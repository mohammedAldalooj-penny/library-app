export interface Book {
  _id: string;
  title: string;
  author: string;
  isbn?: string;
  description?: string;
  publishedYear?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookInput {
  title: string;
  author: string;
  isbn?: string;
  description?: string;
  publishedYear?: number;
}

export interface UpdateBookInput {
  title?: string;
  author?: string;
  isbn?: string | null;
  description?: string | null;
  publishedYear?: number | null;
}

export interface DeleteBookResponse {
  deleted: true;
}
