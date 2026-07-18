import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  ChatMessage,
  ChatStreamEvent,
  ChatSummary,
  ChatToolApproval,
  DeleteChatResponse,
  ResolveToolApprovalResponse,
} from '@library-app/shared-models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = '/api/chats';

  list(): Observable<ChatSummary[]> {
    return this.http.get<ChatSummary[]>(this.endpoint);
  }

  create(): Observable<ChatSummary> {
    return this.http.post<ChatSummary>(this.endpoint, {});
  }

  messages(chatId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.endpoint}/${chatId}/messages`);
  }

  pendingApproval(chatId: string): Observable<ChatToolApproval | null> {
    return this.http.get<ChatToolApproval | null>(
      `${this.endpoint}/${chatId}/approval`,
    );
  }

  resolveApproval(
    chatId: string,
    approvalId: string,
    approved: boolean,
  ): Observable<ResolveToolApprovalResponse> {
    return this.http.post<ResolveToolApprovalResponse>(
      `${this.endpoint}/${chatId}/approvals/${approvalId}`,
      { approved },
    );
  }

  remove(chatId: string): Observable<DeleteChatResponse> {
    return this.http.delete<DeleteChatResponse>(`${this.endpoint}/${chatId}`);
  }

  async streamMessage(
    chatId: string,
    content: string,
    onEvent: (event: ChatStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetch(`${this.endpoint}/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string | string[];
      } | null;
      const message = Array.isArray(body?.message)
        ? body.message.join('. ')
        : body?.message;
      throw new Error(message || 'Unable to send your message.');
    }

    if (!response.body) {
      throw new Error('The chat stream was not available.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.trim()) {
          onEvent(JSON.parse(line) as ChatStreamEvent);
        }
      }
      if (done) {
        break;
      }
    }

    if (buffer.trim()) {
      onEvent(JSON.parse(buffer) as ChatStreamEvent);
    }
  }
}
