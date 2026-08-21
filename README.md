# Finance Platform

Personal finance control platform with an AI financial assistant.

Modular monolith (API-MS) + BFF + AI-MS + Next.js, built as a pnpm/Turborepo
monorepo with Clean Architecture and clear bounded contexts, prepared for
future microservice and microfrontend extraction — without premature complexity.

## Architecture

```
                    ┌──────────────┐
                    │   Keycloak   │
                    └──────┬───────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
          Next.js                     Mobile
             │                           │
             └─────────────┬─────────────┘
                           │
                          BFF
                    ┌──────┴──────┐
                    ▼             ▼
                 API-MS         AI-MS
                    │             │
                    │          9Router
                    │             │
                    │      Claude / OpenAI
                    ▼
                PostgreSQL
```

## Stack

- **Backend**: Node.js, NestJS, TypeScript, TypeORM, PostgreSQL
- **Frontend**: Next.js (App Router), React, Tailwind CSS, Redux Toolkit (client state), TanStack Query (server state)
- **AI**: AI-MS with provider abstraction, 9Router model routing, tool-based data access
- **Auth**: Keycloak (OAuth2 / OIDC / JWT)
- **Monorepo**: pnpm + Turborepo

## Getting started

```bash
pnpm install
docker compose up -d           # PostgreSQL + Keycloak (see docker/postgres-init.md)
cp .env.example .env
pnpm build
pnpm dev                       # all apps/services in watch mode
```

| App/Service | Port |
| ----------- | ---- |
| web         | 3030 |
| api         | 3031 |
| bff         | 3032 |
| ai-ms       | 3033 |
| banking-ms  | 3034 |
| admin       | 3040 |
| Keycloak    | 8080 |
| PostgreSQL  | 5432 |

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Documentation

- [AGENTS.md](./AGENTS.md) — guide for AI coding agents (start here)
- [docs/architecture](./docs/architecture) — system overview
- [docs/decisions](./docs/decisions) — ADRs
- [docs/agents](./docs/agents) — per-area development guides
