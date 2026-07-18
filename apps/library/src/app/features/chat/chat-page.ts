import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type {
  ChatMessage,
  ChatSummary,
  ChatToolApproval,
} from '@library-app/shared-models';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ChatApiService } from '../../core/chat-api.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { ChatChartComponent } from './chat-chart.component';

@Component({
  selector: 'app-chat-page',
  imports: [ChatChartComponent, MarkdownPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPage implements OnInit, OnDestroy {
  @ViewChild('messageViewport')
  private messageViewport?: ElementRef<HTMLElement>;

  private readonly chatApi = inject(ChatApiService);
  private requestController: AbortController | null = null;

  protected readonly chats = signal<ChatSummary[]>([]);
  protected readonly activeChatId = signal<string | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly loadingHistory = signal(true);
  protected readonly sending = signal(false);
  protected readonly resolvingApproval = signal(false);
  protected readonly pendingApproval = signal<ChatToolApproval | null>(null);
  protected readonly sidebarOpen = signal(false);
  protected readonly error = signal('');
  protected readonly composer = new FormControl('', { nonNullable: true });
  protected readonly suggestions = [
    'List the books in my library',
    'Add The Left Hand of Darkness by Ursula K. Le Guin',
    'Check out Dune',
    'Chart the books added to my library over time',
  ];

  ngOnInit(): void {
    void this.initialize();
  }

  ngOnDestroy(): void {
    this.requestController?.abort();
  }

  protected async newChat(): Promise<void> {
    if (this.sending()) {
      return;
    }
    try {
      const chat = await firstValueFrom(this.chatApi.create());
      this.chats.update((chats) => [chat, ...chats]);
      this.activeChatId.set(chat._id);
      this.messages.set([]);
      this.setPendingApproval(null);
      this.error.set('');
      this.sidebarOpen.set(false);
    } catch {
      this.error.set('Unable to create a new chat.');
    }
  }

  protected async selectChat(chat: ChatSummary): Promise<void> {
    if (chat._id === this.activeChatId() || this.sending()) {
      this.sidebarOpen.set(false);
      return;
    }
    this.activeChatId.set(chat._id);
    this.loadingHistory.set(true);
    this.error.set('');
    this.sidebarOpen.set(false);
    try {
      const state = await firstValueFrom(
        forkJoin({
          messages: this.chatApi.messages(chat._id),
          approval: this.chatApi.pendingApproval(chat._id),
        }),
      );
      this.messages.set(state.messages);
      this.setPendingApproval(state.approval);
      this.scrollToBottom();
    } catch {
      this.error.set('Unable to load this conversation.');
    } finally {
      this.loadingHistory.set(false);
    }
  }

  protected async deleteChat(event: Event, chat: ChatSummary): Promise<void> {
    event.stopPropagation();
    if (this.sending() || !window.confirm(`Delete “${chat.title}”?`)) {
      return;
    }
    try {
      await firstValueFrom(this.chatApi.remove(chat._id));
      const remaining = this.chats().filter((item) => item._id !== chat._id);
      this.chats.set(remaining);
      if (this.activeChatId() === chat._id) {
        if (remaining[0]) {
          this.activeChatId.set(null);
          await this.selectChat(remaining[0]);
        } else {
          await this.newChat();
        }
      }
    } catch {
      this.error.set('Unable to delete this conversation.');
    }
  }

  protected async send(content = this.composer.value): Promise<void> {
    const prompt = content.trim();
    if (!prompt || this.sending() || this.pendingApproval()) {
      return;
    }

    if (!this.activeChatId()) {
      await this.newChat();
    }
    const chatId = this.activeChatId();
    if (!chatId) {
      return;
    }

    const now = new Date().toISOString();
    const userId = `local-user-${Date.now()}`;
    const assistantId = `local-assistant-${Date.now()}`;
    this.messages.update((messages) => [
      ...messages,
      {
        _id: userId,
        chatId,
        role: 'user',
        content: prompt,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: assistantId,
        chatId,
        role: 'assistant',
        content: '',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    this.composer.setValue('');
    this.error.set('');
    this.sending.set(true);
    this.requestController = new AbortController();
    this.scrollToBottom();

    try {
      await this.chatApi.streamMessage(
        chatId,
        prompt,
        (event) => {
          if (event.type === 'delta') {
            this.updateAssistant(
              assistantId,
              (content) => content + event.content,
            );
          } else if (event.type === 'chart') {
            this.messages.update((messages) =>
              messages.map((message) =>
                message._id === assistantId
                  ? {
                      ...message,
                      charts: [...(message.charts ?? []), event.chart],
                    }
                  : message,
              ),
            );
          } else if (event.type === 'done') {
            this.messages.update((messages) =>
              messages.map((message) =>
                message._id === assistantId ? event.message : message,
              ),
            );
          } else if (event.type === 'approval_required') {
            this.setPendingApproval(event.approval);
          } else {
            throw new Error(event.message);
          }
          this.scrollToBottom();
        },
        this.requestController.signal,
      );
      this.chats.set(await firstValueFrom(this.chatApi.list()));
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'Unable to generate a response right now.',
      );
      this.updateAssistant(
        assistantId,
        (partial) =>
          partial || 'I could not complete that response. Please try again.',
      );
    } finally {
      this.sending.set(false);
      this.requestController = null;
    }
  }

  protected async resolveToolApproval(approved: boolean): Promise<void> {
    const approval = this.pendingApproval();
    const chatId = this.activeChatId();
    if (!approval || !chatId || this.resolvingApproval()) {
      return;
    }
    this.resolvingApproval.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.chatApi.resolveApproval(chatId, approval._id, approved),
      );
      this.setPendingApproval(null);
      this.messages.update((messages) => [...messages, response.message]);
      this.chats.set(await firstValueFrom(this.chatApi.list()));
      this.scrollToBottom();
    } catch (error) {
      this.setPendingApproval(
        await firstValueFrom(this.chatApi.pendingApproval(chatId)).catch(
          () => null,
        ),
      );
      this.error.set(
        error instanceof Error
          ? error.message
          : 'Unable to resolve this action.',
      );
    } finally {
      this.resolvingApproval.set(false);
    }
  }

  protected handleComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected trackChat(_: number, chat: ChatSummary): string {
    return chat._id;
  }

  protected trackMessage(_: number, message: ChatMessage): string {
    return message._id;
  }

  protected approvalDetails(approval: ChatToolApproval): string {
    return Object.entries(approval.arguments)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => `${this.humanize(key)}: ${String(value)}`)
      .join(' · ');
  }

  private async initialize(): Promise<void> {
    try {
      const chats = await firstValueFrom(this.chatApi.list());
      this.chats.set(chats);
      if (chats[0]) {
        await this.selectChat(chats[0]);
      } else {
        this.loadingHistory.set(false);
        await this.newChat();
      }
    } catch {
      this.loadingHistory.set(false);
      this.error.set('Unable to load your chat history.');
    }
  }

  private updateAssistant(
    id: string,
    update: (content: string) => string,
  ): void {
    this.messages.update((messages) =>
      messages.map((message) =>
        message._id === id
          ? { ...message, content: update(message.content) }
          : message,
      ),
    );
  }

  private setPendingApproval(approval: ChatToolApproval | null): void {
    this.pendingApproval.set(approval);
    if (approval) {
      this.composer.disable({ emitEvent: false });
    } else {
      this.composer.enable({ emitEvent: false });
    }
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      const viewport = this.messageViewport?.nativeElement;
      viewport?.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    });
  }

  private humanize(value: string): string {
    return value
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (letter) => letter.toUpperCase());
  }
}
