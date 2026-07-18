import { BooksService } from '../books/books.service';
import { BooksMcpServer } from './books-mcp.server';
import { hashArguments, ToolApprovalService } from './tool-approval.service';

describe('BooksMcpServer', () => {
  const books = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    checkout: jest.fn(),
    checkIn: jest.fn(),
  };
  const approvals = {
    consume: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  };
  let server: BooksMcpServer;

  beforeEach(() => {
    jest.clearAllMocks();
    server = new BooksMcpServer(
      books as unknown as BooksService,
      approvals as unknown as ToolApprovalService,
    );
  });

  it('discovers read and write tools without exposing approval ids to Gemini', async () => {
    const tools = await server.listTools();
    const list = tools.find((tool) => tool.name === 'list_books');
    const create = tools.find((tool) => tool.name === 'create_book');

    expect(list?.readOnly).toBe(true);
    expect(create?.readOnly).toBe(false);
    expect(
      (create?.inputSchema['properties'] as Record<string, unknown>)[
        'approvalId'
      ],
    ).toBeUndefined();
  });

  it('calls the shared BooksService for reads', async () => {
    books.findAll.mockResolvedValue([{ _id: '1', title: 'Dune' }]);

    await expect(server.callTool('list_books', { query: 'dune' })).resolves.toEqual(
      [{ _id: '1', title: 'Dune' }],
    );
    expect(books.findAll).toHaveBeenCalledWith('dune');
  });

  it('revalidates an exact approval before a mutation', async () => {
    approvals.consume.mockResolvedValue(undefined);
    approvals.complete.mockResolvedValue(undefined);
    books.create.mockResolvedValue({
      _id: '1',
      title: 'Dune',
      author: 'Frank Herbert',
    });
    const args = { title: 'Dune', author: 'Frank Herbert' };

    await server.callTool('create_book', {
      ...args,
      approvalId: 'approval-1',
    });

    expect(approvals.consume).toHaveBeenCalledWith(
      'approval-1',
      'create_book',
      args,
    );
    expect(books.create).toHaveBeenCalledWith(args);
    expect(approvals.complete).toHaveBeenCalledWith('approval-1');
  });
});

describe('hashArguments', () => {
  it('binds approval to values while ignoring object key order', () => {
    expect(hashArguments({ title: 'Dune', author: 'Frank Herbert' })).toBe(
      hashArguments({ author: 'Frank Herbert', title: 'Dune' }),
    );
    expect(hashArguments({ title: 'Dune' })).not.toBe(
      hashArguments({ title: 'Foundation' }),
    );
  });
});
