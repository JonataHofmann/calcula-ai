# Agent Guide: Backend (API-MS)

## Module anatomy

```
services/api/src/modules/transactions/
├── domain/
│   ├── entities/           # pure TS classes, business invariants
│   ├── value-objects/      # Money, TransactionType, etc.
│   ├── repositories/       # interfaces only
│   ├── services/           # domain services (multi-entity rules)
│   └── errors/             # domain errors (extend Error)
├── application/
│   ├── use-cases/
│   │   └── create-transaction/
│   │       ├── create-transaction.use-case.ts
│   │       ├── create-transaction.input.ts
│   │       └── create-transaction.output.ts
│   ├── dto/
│   └── ports/              # non-repository dependencies (clock, id gen, event bus)
├── infrastructure/
│   └── persistence/
│       ├── entities/       # TypeORM entities (*.entity.ts)
│       ├── repositories/   # TypeORM implementations of domain interfaces
│       └── migrations/
├── presentation/
│   ├── controllers/
│   └── dto/                # HTTP DTOs with validation
└── transactions.module.ts
```

## Rules

- Use cases receive dependencies via constructor (interfaces). Unit tests use fakes.
- Controllers: map HTTP <-> use case only. No business logic.
- Money: `NUMERIC(14,2)` in PostgreSQL, decimal string in DTOs. Never float.
- Every query scoped by `userId` from `AuthenticatedUser` (JWT). Never from body/query.
- Transfers: single TypeORM transaction, `transferId` links both legs, rollback on failure.
- Idempotency: financial writes accept `Idempotency-Key` header; repeated key returns
  the original result, never duplicates.
- Domain events published via `@finance/events` `EventBus` (in-memory for now).
- Migrations: `pnpm --filter @finance/api migration:run`. Never `synchronize: true`.

## Authentication

- **API-MS**: global `JwtAuthGuard` (`services/api/src/common/auth/`) verifies
  `Authorization: Bearer <JWT>` via `KeycloakTokenVerifier` (`@finance/auth`).
  New routes are protected by default; opt out with `@Public()` (health only).
  Inject identity with `@CurrentUser()` (`AuthenticatedUser`). Currently
  `id = keycloakUserId` (ADR-010).
- **BFF**: OIDC Authorization Code + PKCE flow in `services/bff/src/auth/`
  (`GET /auth/login`, `GET /auth/callback`, `GET /auth/me`, `POST /auth/logout`).
  Sessions in PostgreSQL table `sessions` (tokens AES-256-GCM encrypted);
  browser gets only the signed httpOnly cookie `finance_session`. Global
  `SessionAuthGuard`: 30 min inactivity, silent refresh <60s before expiry.
  BFF migration: `sessions` table in `services/bff/src/auth/session/migrations/`.
- **Env (BFF)**: `SESSION_SECRET` (≥32 chars), `BFF_PUBLIC_URL`, `WEB_URL`,
  `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`.
- Never log tokens, cookies, `code` or `state`.

## Testing

- Unit: domain entities/VOs + use cases with fake repositories (jest, no Nest context).
- Integration: TypeORM repositories against real PostgreSQL (docker compose).
- Run: `pnpm turbo run test --filter=@finance/api`.
