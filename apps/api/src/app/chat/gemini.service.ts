import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Content, FunctionDeclaration, GoogleGenAI } from '@google/genai';
import type { ChatMessage, ChatToolApproval } from '@library-app/shared-models';
import type { LibraryMcpTool } from '../mcp/books-mcp.server';

interface ServiceAccountCredentials {
  type: 'service_account';
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
  [key: string]: unknown;
}

export type ToolExecution =
  | { type: 'result'; output: unknown }
  | { type: 'approval'; approval: ChatToolApproval };

export type GeminiReplyEvent =
  | { type: 'text'; content: string }
  | { type: 'approval'; approval: ChatToolApproval };

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

  async *reply(
    history: ChatMessage[],
    tools: LibraryMcpTool[],
    executeTool: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<ToolExecution>,
  ): AsyncGenerator<GeminiReplyEvent> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Gemini is not configured. Add GOOGLE_CREDS_B64 to the server environment.',
      );
    }

    const contents: Content[] = history.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
    const functionDeclarations: FunctionDeclaration[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.inputSchema,
    }));

    for (let round = 0; round < 8; round += 1) {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents,
        config: {
          maxOutputTokens: 2048,
          temperature: 0.3,
          tools: [{ functionDeclarations }],
          systemInstruction:
            'You are Leafmark AI, a concise personal-library assistant. Use the provided tools for every claim or operation involving the user’s library; never invent catalog contents or ids. Use list_books to find a book before acting when needed. Read-only tools may run immediately. For create, update, delete, checkout, or check-in, call the matching tool once with the exact intended arguments. The application handles user approval, so do not ask for confirmation in prose. Never claim a mutation succeeded until its tool result confirms it. You may answer general questions without tools.',
        },
      });
      const functionCalls = response.functionCalls ?? [];
      if (!functionCalls.length) {
        const text = response.text?.trim();
        if (text) {
          yield { type: 'text', content: text };
          return;
        }
        throw new ServiceUnavailableException(
          'Gemini returned an empty response',
        );
      }

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      }
      const responseParts: NonNullable<Content['parts']> = [];

      for (const call of functionCalls) {
        if (!call.name) {
          continue;
        }
        const execution = await executeTool(call.name, call.args ?? {});
        if (execution.type === 'approval') {
          yield execution;
          return;
        }
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: call.name,
            response: { output: execution.output },
          },
        });
      }

      if (!responseParts.length) {
        throw new ServiceUnavailableException(
          'Gemini requested an invalid library tool',
        );
      }
      contents.push({ role: 'user', parts: responseParts });
    }

    throw new ServiceUnavailableException('Too many library tool calls');
  }
}
