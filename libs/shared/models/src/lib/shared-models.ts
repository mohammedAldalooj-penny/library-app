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

export type ChatRole = 'user' | 'assistant';

export interface ChatSummary {
  _id: string;
  title: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  chatId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type ChatStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'done'; message: ChatMessage }
  | { type: 'error'; message: string };

export interface DeleteChatResponse {
  deleted: true;
}
