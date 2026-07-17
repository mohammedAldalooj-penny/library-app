import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Content, GoogleGenAI } from '@google/genai';
import type { Book, ChatMessage } from '@library-app/shared-models';

interface ServiceAccountCredentials {
  type: 'service_account';
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
  [key: string]: unknown;
}

export function parseGoogleCredentials(
  encoded: string,
): ServiceAccountCredentials {
  const credentials = JSON.parse(
    Buffer.from(encoded, 'base64').toString('utf8'),
  ) as Partial<ServiceAccountCredentials>;

  if (
    credentials.type !== 'service_account' ||
    !credentials.project_id ||
    !credentials.private_key ||
    !credentials.client_email
  ) {
    throw new Error(
      'GOOGLE_CREDS_B64 is not a valid service-account credential',
    );
  }

  return credentials as ServiceAccountCredentials;
}

@Injectable()
export class GeminiService {
  private readonly client: GoogleGenAI | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.model = this.config.get('GEMINI_MODEL', 'gemini-2.5-flash');
    const encoded = this.config.get<string>('GOOGLE_CREDS_B64');

    if (!encoded) {
      this.client = null;
      return;
    }

    const credentials = parseGoogleCredentials(encoded);
    this.client = new GoogleGenAI({
      apiVersion: 'v1',
      vertexai: true,
      project: credentials.project_id,
      location: 'global',
      googleAuthOptions: { credentials },
    });
  }

  async *streamReply(
    history: ChatMessage[],
    books: Book[],
  ): AsyncGenerator<string> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Gemini is not configured. Add GOOGLE_CREDS_B64 to the server environment.',
      );
    }

    const contents: Content[] = history.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
    const catalog = books
      .slice(0, 100)
      .map(
        (book) =>
          `- ${book.title} by ${book.author}${book.publishedYear ? ` (${book.publishedYear})` : ''}`,
      )
      .join('\n');
    const stream = await this.client.models.generateContentStream({
      model: this.model,
      contents,
      config: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        systemInstruction: `You are Leafmark AI, a warm, thoughtful assistant inside a personal library app. Help with books, reading, writing, research, and general questions. Be concise by default, use Markdown when it improves clarity, and never claim the user owns a book unless it appears in the catalog below.\n\nCurrent library catalog:\n${catalog || '(The library is empty.)'}`,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }
}
