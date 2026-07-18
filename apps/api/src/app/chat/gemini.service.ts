import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Content, FunctionDeclaration, GoogleGenAI } from '@google/genai';
import type {
  ChatChart,
  ChatMessage,
  ChatToolApproval,
} from '@library-app/shared-models';
import type { LibraryMcpTool } from '../books/mcp/books-mcp.server';
import { renderChartFunctionDeclaration } from './chat-chart';

export type ToolExecution =
  | { type: 'result'; output: unknown }
  | { type: 'chart'; chart: ChatChart }
  | { type: 'approval'; approval: ChatToolApproval };

export type GeminiReplyEvent =
  | { type: 'text'; content: string }
  | { type: 'chart'; chart: ChatChart }
  | { type: 'approval'; approval: ChatToolApproval };

export function normalizeGooglePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, '\n');
}

@Injectable()
export class GeminiService {
  private readonly client: GoogleGenAI | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.model = this.config.get('GEMINI_MODEL', 'gemini-3.5-flash');
    const project = this.config.get<string>('GOOGLE_CLOUD_PROJECT');
    const clientEmail = this.config.get<string>('GOOGLE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('GOOGLE_PRIVATE_KEY');

    if (!project || !clientEmail || !privateKey) {
      this.client = null;
      return;
    }

    this.client = new GoogleGenAI({
      apiVersion: 'v1',
      vertexai: true,
      project,
      location: 'global',
      googleAuthOptions: {
        credentials: {
          client_email: clientEmail,
          private_key: normalizeGooglePrivateKey(privateKey),
        },
      },
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
        'Gemini is not configured. Add GOOGLE_CLOUD_PROJECT, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY to the server environment.',
      );
    }

    const contents: Content[] = history.map((message) => {
      const chartContext = message.charts?.length
        ? `\n\nCharts rendered with this message:\n${JSON.stringify(message.charts)}`
        : '';
      return {
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: `${message.content}${chartContext}` }],
      };
    });
    const functionDeclarations: FunctionDeclaration[] = [
      ...tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: tool.inputSchema,
      })),
      renderChartFunctionDeclaration,
    ];

    for (let round = 0; round < 8; round += 1) {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents,
        config: {
          maxOutputTokens: 2048,
          temperature: 0.3,
          tools: [{ functionDeclarations }],
          systemInstruction:
            'You are Leafmark AI, a concise personal-library assistant. Use the provided application tools for every claim or operation involving the user’s library; never invent catalog contents or ids. Use list_books to find books and their timestamps before analyzing the collection. Read-only tools may run immediately. For create, update, delete, checkout, or check-in, call the matching tool once with the exact intended arguments. The application handles user approval, so do not ask for confirmation in prose. Never claim a mutation succeeded until its tool result confirms it. When the user requests a graph, chart, trend, distribution, or visual comparison, first retrieve the required application data, aggregate it accurately, then call render_chart. Choose line or area for time trends, bar for comparisons, and pie only for a small part-to-whole dataset. After rendering, briefly explain the main observation in prose. You may answer general questions without tools.',
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
        if (execution.type === 'chart') {
          yield execution;
          responseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: { rendered: true },
            },
          });
          continue;
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
