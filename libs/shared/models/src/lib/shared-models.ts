export interface Book {
  _id: string;
  title: string;
  author: string;
  isbn?: string;
  description?: string;
  publishedYear?: number;
  status: 'available' | 'checked_out';
  checkedOutAt?: string;
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

export type ChatChartKind = 'line' | 'bar' | 'area' | 'pie';

export interface ChatChartPoint {
  label: string;
  value: number;
}

export interface ChatChartSeries {
  name: string;
  data: ChatChartPoint[];
}

export interface ChatChart {
  kind: ChatChartKind;
  title: string;
  description?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  series: ChatChartSeries[];
}

export interface ChatMessage {
  _id: string;
  chatId: string;
  role: ChatRole;
  content: string;
  charts?: ChatChart[];
  createdAt: string;
  updatedAt: string;
}

export type ChatStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'chart'; chart: ChatChart }
  | { type: 'approval_required'; approval: ChatToolApproval }
  | { type: 'done'; message: ChatMessage }
  | { type: 'error'; message: string };

export type BookToolName =
  | 'create_book'
  | 'update_book'
  | 'delete_book'
  | 'checkout_book'
  | 'check_in_book';

export type ToolApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed';

export interface ChatToolApproval {
  _id: string;
  chatId: string;
  toolName: BookToolName;
  arguments: Record<string, unknown>;
  summary: string;
  status: ToolApprovalStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResolveToolApprovalResponse {
  approval: ChatToolApproval;
  message: ChatMessage;
}

export interface DeleteChatResponse {
  deleted: true;
}
