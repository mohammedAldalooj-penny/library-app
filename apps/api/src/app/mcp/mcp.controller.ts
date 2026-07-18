import { Controller, Delete, Get, Post, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { BooksMcpServer } from './books-mcp.server';

@Controller('mcp')
export class McpController {
  constructor(private readonly booksMcp: BooksMcpServer) {}

  @Post()
  async handle(@Req() request: Request, @Res() response: Response) {
    const server = this.booksMcp.createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  }

  @Get()
  getNotAllowed(@Res() response: Response): void {
    this.methodNotAllowed(response);
  }

  @Delete()
  deleteNotAllowed(@Res() response: Response): void {
    this.methodNotAllowed(response);
  }

  private methodNotAllowed(response: Response): void {
    response.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed' },
      id: null,
    });
  }
}
