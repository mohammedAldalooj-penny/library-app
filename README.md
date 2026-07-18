# Leafmark Library

A full-stack personal library built as an Nx monorepo with Angular, NestJS,
Mongoose, MongoDB, and Gemini on Vertex AI.

## Requirements

- Node.js 24.18.0 (see `.nvmrc`)
- npm
- MongoDB running at `mongodb://localhost:27017`

## Run locally

```bash
nvm use
npm install
npm start
```

Open http://localhost:4200. The Angular development server proxies `/api` to
the NestJS API at http://localhost:3000.

The defaults work without an environment file. To customize them, copy
`.env.example` to `.env`. AI chat requires a base64-encoded Google Cloud
service-account JSON value in `GOOGLE_CREDS_B64`; keep it server-side only.

## Commands

```bash
npm start               # Run the API and web app
npm run serve:web       # Run only Angular
npm run serve:api       # Run only NestJS
npm run seed            # Idempotently add the starter books
npm run health:api      # Confirm the running API is healthy
npm run check           # Lint, type-check, test, and build everything
npm run build:web       # Build only Angular
npm run build:api       # Build only NestJS
npm run format          # Format the workspace
npm run format:check    # Check formatting without changing files
```

Nx caches repeatable checks and builds, so subsequent runs are typically
faster.

## Structure

- `apps/library` — Angular 22 web application
- `apps/api` — NestJS 11 REST API
- `libs/shared/models` — framework-neutral API contracts
- `apps/library-e2e` — Playwright browser tests
- `apps/api-e2e` — Jest API tests

The API is organized by feature. Under `apps/api/src/app/books`, the `http`
and `mcp` adapters sit beside the shared `BooksService`, so both protocols use
the same business rules. The top-level `mcp` feature contains only the generic
MCP transport and cross-cutting approval infrastructure.

## API

- `GET /api/health`
- `GET /api/books?q=search`
- `GET /api/books/:id`
- `POST /api/books`
- `PATCH /api/books/:id`
- `POST /api/books/:id/checkout`
- `POST /api/books/:id/check-in`
- `DELETE /api/books/:id`
- `GET /api/chats`
- `POST /api/chats`
- `GET /api/chats/:id/messages`
- `POST /api/chats/:id/messages` (streaming NDJSON response)
- `GET /api/chats/:id/approval`
- `POST /api/chats/:id/approvals/:approvalId`
- `DELETE /api/chats/:id`
- `POST /api/mcp` (stateless Streamable HTTP MCP server)

## MCP library tools

The chat discovers and calls `list_books`, `get_book`, `create_book`,
`update_book`, `delete_book`, `checkout_book`, and `check_in_book` through the
MCP server. Both REST and MCP are adapters over the same `BooksService`; the AI
does not query MongoDB directly.

Read-only tools run immediately. Every write creates a short-lived approval
bound to the exact tool and arguments. The user must approve it in chat, and
the MCP handler validates and consumes that approval once before it calls the
service.
