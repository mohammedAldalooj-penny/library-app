import { Injectable } from '@nestjs/common';
import type { Book, BookToolName } from '@library-app/shared-models';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { ToolApprovalService } from '../../mcp/approvals/tool-approval.service';
import { BooksService } from '../books.service';

export interface LibraryMcpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
}

@Injectable()
export class BooksMcpServer {
  constructor(
    private readonly books: BooksService,
    private readonly approvals: ToolApprovalService,
  ) {}

  createServer(): McpServer {
    const server = new McpServer({
      name: 'leafmark-library',
      version: '1.0.0',
    });

    server.registerTool(
      'list_books',
      {
        title: 'List books',
        description:
          'List the books in the library, optionally searching by title, author, ISBN, or description.',
        inputSchema: { query: z.string().trim().optional() },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      async ({ query }) => this.result(await this.books.findAll(query)),
    );

    server.registerTool(
      'get_book',
      {
        title: 'Get book',
        description: 'Get one library book by its id.',
        inputSchema: { id: z.string().min(1) },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      async ({ id }) => this.result(await this.books.findOne(id)),
    );

    server.registerTool(
      'create_book',
      {
        title: 'Create book',
        description: 'Add a book to the library after user approval.',
        inputSchema: {
          title: z.string().trim().min(1).max(200),
          author: z.string().trim().min(1).max(120),
          isbn: z.string().trim().optional(),
          description: z.string().trim().max(2000).optional(),
          publishedYear: z.number().int().min(0).optional(),
          approvalId: z.string().min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ approvalId, ...input }) =>
        this.executeApproved(approvalId, 'create_book', input, () =>
          this.books.create(input),
        ),
    );

    server.registerTool(
      'update_book',
      {
        title: 'Update book',
        description: 'Update a library book after user approval.',
        inputSchema: {
          id: z.string().min(1),
          title: z.string().trim().min(1).max(200).optional(),
          author: z.string().trim().min(1).max(120).optional(),
          isbn: z.string().trim().nullable().optional(),
          description: z.string().trim().max(2000).nullable().optional(),
          publishedYear: z.number().int().min(0).nullable().optional(),
          approvalId: z.string().min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ approvalId, id, ...input }) =>
        this.executeApproved(approvalId, 'update_book', { id, ...input }, () =>
          this.books.update(id, input),
        ),
    );

    server.registerTool(
      'delete_book',
      {
        title: 'Delete book',
        description: 'Permanently delete a library book after user approval.',
        inputSchema: {
          id: z.string().min(1),
          approvalId: z.string().min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      async ({ id, approvalId }) =>
        this.executeApproved(approvalId, 'delete_book', { id }, () =>
          this.books.remove(id),
        ),
    );

    server.registerTool(
      'checkout_book',
      {
        title: 'Check out book',
        description: 'Mark a library book as checked out after user approval.',
        inputSchema: {
          id: z.string().min(1),
          approvalId: z.string().min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ id, approvalId }) =>
        this.executeApproved(approvalId, 'checkout_book', { id }, () =>
          this.books.checkout(id),
        ),
    );

    server.registerTool(
      'check_in_book',
      {
        title: 'Check in book',
        description: 'Return a checked-out book after user approval.',
        inputSchema: {
          id: z.string().min(1),
          approvalId: z.string().min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ id, approvalId }) =>
        this.executeApproved(approvalId, 'check_in_book', { id }, () =>
          this.books.checkIn(id),
        ),
    );

    return server;
  }

  async listTools(): Promise<LibraryMcpTool[]> {
    return this.withClient(async (client) => {
      const response = await client.listTools();
      return response.tools.map((tool) => {
        const inputSchema = structuredClone(tool.inputSchema) as Record<
          string,
          unknown
        >;
        const properties = inputSchema['properties'] as
          Record<string, unknown> | undefined;
        if (properties) {
          delete properties['approvalId'];
        }
        const required = inputSchema['required'];
        if (Array.isArray(required)) {
          inputSchema['required'] = required.filter(
            (field) => field !== 'approvalId',
          );
        }
        return {
          name: tool.name,
          description: tool.description,
          inputSchema,
          readOnly: tool.annotations?.readOnlyHint === true,
        };
      });
    });
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    return this.withClient(async (client) => {
      const response = (await client.callTool({
        name,
        arguments: args,
      })) as CallToolResult;
      if (response.isError) {
        const text = response.content.find((item) => item.type === 'text');
        throw new Error(text?.type === 'text' ? text.text : 'MCP tool failed');
      }
      return response.structuredContent?.['result'] ?? response.content;
    });
  }

  async describeAction(
    name: BookToolName,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (name === 'create_book') {
      return `add “${String(args['title'])}” by ${String(args['author'])}`;
    }
    const book = (await this.callTool('get_book', {
      id: args['id'],
    })) as Book;
    const verb: Record<BookToolName, string> = {
      create_book: 'add',
      update_book: 'update',
      delete_book: 'permanently delete',
      checkout_book: 'check out',
      check_in_book: 'check in',
    };
    return `${verb[name]} “${book.title}” by ${book.author}`;
  }

  private async withClient<T>(
    callback: (client: Client) => Promise<T>,
  ): Promise<T> {
    const server = this.createServer();
    const client = new Client({ name: 'leafmark-chat', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    try {
      return await callback(client);
    } finally {
      await client.close();
      await server.close();
    }
  }

  private result(output: unknown): CallToolResult {
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: { result: output },
    };
  }

  private async executeApproved(
    approvalId: string,
    toolName: BookToolName,
    args: Record<string, unknown>,
    action: () => Promise<unknown>,
  ): Promise<CallToolResult> {
    await this.approvals.consume(approvalId, toolName, args);
    try {
      const output = await action();
      await this.approvals.complete(approvalId);
      return this.result(output);
    } catch (error) {
      await this.approvals.fail(approvalId);
      throw error;
    }
  }
}
