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

## API

- `GET /api/health`
- `GET /api/books?q=search`
- `GET /api/books/:id`
- `POST /api/books`
- `PATCH /api/books/:id`
- `DELETE /api/books/:id`
- `GET /api/chats`
- `POST /api/chats`
- `GET /api/chats/:id/messages`
- `POST /api/chats/:id/messages` (streaming NDJSON response)
- `DELETE /api/chats/:id`
