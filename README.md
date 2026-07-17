# Leafmark Library

A full-stack personal library built as an Nx monorepo with Angular, NestJS,
Mongoose, and MongoDB.

## Requirements

- Node.js 24.18.0 (see `.nvmrc`)
- npm
- MongoDB running at `mongodb://localhost:27017`

## Run locally

```bash
nvm use
npm install
npm run dev
```

Open http://localhost:4200. The Angular development server proxies `/api` to
the NestJS API at http://localhost:3000.

The defaults work without an environment file. To customize them, copy
`.env.example` to `.env`.

## Commands

```bash
npm run dev       # Run the API and web app
npm run build     # Production builds
npm test          # Unit tests
npm run lint      # ESLint checks
npx nx graph      # Explore the monorepo graph
```

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
