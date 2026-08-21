# Implementation Plan: Backend NestJS Architecture Convention

**Branch**: `007-backend-module-restructure` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-backend-module-restructure/spec.md`

## Summary

Migrate all four NestJS backend services (`api`, `banking-ms`, `ai-ms`, `bff`) from their current per-module DDD/hexagonal layering (`domain/`, `application/use-cases/`, `infrastructure/persistence/{entities,repositories,migrations}`, `presentation/`) to a single flat convention: `src/common/{types,middlewares,interceptors}` plus `src/modules/<name>/{dto,converters,entities}` with the three flat files `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`. Controllers carry no business logic and never touch entities or repositories; services hold all logic, access persistence exclusively via injected TypeORM `Repository<Entity>` (`@InjectRepository`), and return DTOs produced by per-module converters. The ~14 custom `*.repository.ts` classes and their domain interfaces are removed; the ~34 use-case classes fold into service methods. Per-class native NestJS `Logger` with correct levels is applied uniformly. Backend-only shared packages (`auth`, `config`, `events`, `logger`, `observability`) relocate from `packages/` to a new `libs/`; front-consumed `contracts` and `ui` stay in `packages/`. The refactor preserves every HTTP endpoint and DB schema; each step keeps all builds green and all co-located `*.spec.ts` passing.

## Technical Context

**Language/Version**: TypeScript `^5.7.3`; Node (no `engines` pin; `@types/node ^22.13.1` → target Node 22).

**Primary Dependencies**: NestJS `^11` (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`); `@nestjs/typeorm ^11` + `typeorm ^0.3.20` + `pg ^8` (api, banking-ms, bff); `class-validator ^0.15` / `class-transformer ^0.5` (all); `zod ^3.24` + `@nestjs/swagger ^11` (api, banking-ms); `@nestjs/schedule ^5` (api, banking-ms); `openid-client ^6` + `cookie-parser` (bff). Workspace deps `@finance/{auth,config,contracts,events,logger,observability,ui}`.

**Storage**: PostgreSQL via TypeORM — api (4 module schemas, 9 migrations), banking-ms (1 module, 2 migrations), bff (session only, 1 migration). ai-ms: no persistence.

**Testing**: jest `^29` + ts-jest, `rootDir: src`, `testRegex: .*\.spec\.ts$`; co-located `*.spec.ts` (api 37, banking-ms 18, bff 8, ai-ms 1). api also has integration specs (`*.int.spec.ts` / repository specs) that construct their own `DataSource`.

**Target Platform**: Linux server (Node process per service).

**Project Type**: pnpm + turbo monorepo — 4 NestJS backend services (`services/*`), 3 frontend apps (`apps/*`), shared workspace packages (`packages/*`) plus a new backend-shared `libs/*`.

**Performance Goals**: None new. This is a structural/behavioral refactor; runtime behavior, latency, and throughput must remain equivalent to pre-migration.

**Constraints**: Zero functional regression (FR-019); no change to public HTTP APIs or DB schema (Assumptions); every intermediate migration step MUST leave all service builds succeeding and all tests passing (FR-021); tests stay co-located within their module (FR-020).

**Scale/Scope**: 4 services; 5 persistence feature modules (api: accounts, cards, categories, transactions; banking-ms: bank-connections) + bff gateway feature folders (accounts, cards, categories, transactions, bank-connections, reference) + ai-ms minimal (health + provider); ~14 custom `*.repository.ts` files removed (api 12, banking-ms 2); ~34 use-case classes folded (api 25, banking-ms 8, +1 shared); 12 migrations preserved; 64 specs must stay green; 5 packages relocated to `libs/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated template — every principle, section, and governance rule is still a `[PLACEHOLDER]`. There are no ratified principles to check against.

**Gate result: PASS (vacuous).** No governance constraints apply. Notably, this feature is itself a codification of Clean Architecture / SOLID conventions, so it is consistent with the kind of principles a future constitution would likely hold. Re-check after Phase 1: still PASS — no new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/007-backend-module-restructure/
├── plan.md              # This file
├── research.md          # Phase 0 output — 7 design decisions (R1–R7)
├── data-model.md        # Phase 1 output — structural model + per-service module inventory
├── quickstart.md        # Phase 1 output — conformance/validation guide
├── contracts/           # Phase 1 output — the convention contract + structural checks
│   ├── module-anatomy.md
│   └── structural-checks.md
├── checklists/
│   └── requirements.md  # (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root — target layout)

```text
libs/                         # NEW — backend-shared (relocated from packages/)
├── auth/
├── config/
├── events/
├── logger/
└── observability/

packages/                     # front-shared + tooling only
├── contracts/                # front-consumed (stays)
├── ui/                       # front-consumed (stays)
├── eslint-config/            # tooling (stays)
└── tsconfig/                 # tooling (stays)

services/
├── api/src/
│   ├── common/               # types/, middlewares/, interceptors/ (+ guards/, filters/, pipes/ — see R2)
│   ├── database/             # DataSource + centralized migrations (see R1)
│   └── modules/<accounts|cards|categories|transactions>/
│       ├── dto/              # input + response DTOs
│       ├── converters/       # Entity↔DTO
│       ├── entities/         # TypeORM entities
│       ├── <name>.module.ts
│       ├── <name>.controller.ts
│       ├── <name>.service.ts
│       └── <name>.service.spec.ts (co-located tests)
├── banking-ms/src/           # same shape; single module bank-connections; scheduling stays (R5)
├── bff/src/                  # gateway: modules/* with dto/converters, mostly NO entities/ (R4)
│   ├── common/
│   ├── database/             # SessionEntity + its migration
│   └── modules/<accounts|cards|categories|transactions|bank-connections|reference|auth>/
└── ai-ms/src/                # minimal: modules/health only; NO entities/ or converters/ (no persistence)

apps/                         # frontend — out of scope (web, admin, mobile)
```

**Structure Decision**: Monorepo, per-service `src/common/` + `src/modules/<name>/` convention as above. Each service adopts only the folders applicable to its role (FR-004): ai-ms omits `entities/`/`converters/`; bff omits `entities/` in HTTP-proxy modules. A non-module `src/database/` holds the TypeORM `DataSource` and migrations, which have no slot in the module anatomy (R1). `common/` is extended with `guards/`, `filters/`, `pipes/` where they exist, as framework cross-cutting concerns alongside the directive's `types/`/`middlewares/`/`interceptors/` (R2). `@finance/*` package names are unchanged by the `libs/` move, so consumer import specifiers do not churn — only workspace globs and any tsconfig path aliases update (R6).

## Complexity Tracking

No constitution violations (constitution is an empty template). No entries required.
