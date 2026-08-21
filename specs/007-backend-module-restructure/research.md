# Phase 0 Research: Backend NestJS Architecture Convention

**Feature**: 007-backend-module-restructure | **Date**: 2026-08-20

The directive is prescriptive but does not cover every artifact present in the current codebase. This document resolves each gap with a concrete decision so the convention is unambiguous before task breakdown. No blocking `NEEDS CLARIFICATION` remain.

---

## R1 — Home for TypeORM DataSource and migrations

**Decision**: A non-module `src/database/` folder per persistence service holds the migration-CLI `DataSource` (`data-source.ts`, plus `seed.ts` where present) and a single `src/database/migrations/` directory. Existing per-module migrations (api: 9 across 4 modules; banking-ms: 2) are moved here unchanged. `bff` already uses `src/database/`; keep it. Entities stay in `modules/<name>/entities/` and are referenced by `autoLoadEntities: true` (already set) so the runtime `forRoot` needs no explicit entity list.

**Rationale**: The module anatomy in the directive is exactly `dto/` + `converters/` + `entities/` + three flat files — migrations have no slot, and they are infrastructure/config, not feature code. Centralizing under `src/database/` matches the existing bff layout and the existing per-service `infrastructure/database/data-source.ts`. Migration *files* are timestamped and their SQL is unchanged, so relocating them is a path move with no schema effect (FR-019).

**Alternatives considered**: (a) Keep migrations under `modules/<name>/entities/migrations/` — rejected: adds a folder the directive does not sanction and scatters CLI config. (b) Put migrations in `common/` — rejected: `common/` is for shared *types/middlewares/interceptors*, not DB config.

---

## R2 — Home for framework guards, filters, and pipes

**Decision**: `src/common/` contains the directive's `types/`, `middlewares/`, `interceptors/`, **and** `guards/`, `filters/`, `pipes/` where the service has them. Current api/banking-ms `common/{auth,filters,validation}` map as: `auth/` (JWT/service-account guards, `@CurrentUser`/`@Public` decorators) → `common/guards/` (+ `common/decorators/` for the decorators); `filters/` (domain-exception filter) → `common/filters/`; `validation/` (zod pipe) → `common/pipes/`. The `common/health/` controller+module becomes a normal `modules/health/` feature module.

**Rationale**: NestJS guards, exception filters, and pipes are first-class cross-cutting constructs distinct from middlewares and interceptors; they must live somewhere. The directive lists the *minimum* required `common/` subfolders, not an exhaustive whitelist, so extending `common/` with the remaining framework categories is the smallest consistent choice and keeps all cross-cutting code under one roof (FR-002: `common/` holds shared framework code, not feature logic).

**Alternatives considered**: (a) Force guards/filters/pipes into `middlewares/`/`interceptors/` — rejected: semantically wrong and misleads readers. (b) A separate top-level `src/framework/` — rejected: introduces a second cross-cutting root competing with `common/`.

---

## R3 — Collapsing the DDD `domain/` + `application/use-cases/` layers into a single service

**Decision**: For each module, the many use-case classes (api 25, banking-ms 8, + shared helpers) become **methods on the single `<name>.service.ts`**. Domain repository *interfaces* (`domain/*.repository.ts`) are deleted (FR-009a); the service injects `Repository<Entity>` directly. Pure domain value objects, enums, and domain-error types that are shared across modules move to `common/types/`; those used by only one module stay as local types within that module (co-located, e.g. a `<name>.types.ts` or inlined in the service). Where a distinct in-memory *domain model* exists separately from the ORM *persistence entity*, the two are unified into the single `entities/<name>.entity.ts`, and the converter maps that entity to the response DTO. Business rules previously in domain services move into the service method that owns the operation.

**Rationale**: The target has exactly one service per module holding all business logic (FR-008, FR-010, single-responsibility at the class-per-role level). Use cases are operations, i.e. service methods. This is the largest per-module effort and is where behavior-preservation risk concentrates, so tests (co-located `*.spec.ts`, which already exercise use cases) are the safety net and must stay green at each step (FR-020, FR-021).

**Alternatives considered**: (a) Keep use-case classes as private collaborators of the service — rejected: reintroduces the `application/` layer the convention removes and blurs "all logic in the service." (b) One service per use case — rejected: violates one-service-per-module.

---

## R4 — `bff` gateway: services without repositories

**Decision**: `bff` feature modules (accounts, cards, categories, transactions, bank-connections, reference) adopt the full shape **minus `entities/`** — their services acquire data through the existing injected HTTP clients (`api-client`, `banking-api-client`) rather than TypeORM repositories, and still return response DTOs built by converters. The `auth` session module keeps its `SessionEntity` (the one persistence entity in bff) under `src/database/` per R1. The HTTP clients live in `common/` (relocated from `src/shared/`).

**Rationale**: FR-009's "persistence exclusively via injected TypeORM repositories" governs *persistence*; the gateway's job is composition over upstream services, which is legitimate non-persistence data access. FR-004 explicitly allows omitting inapplicable folders (no persistence → no `entities/`). The DTO boundary and converter rules (FR-011..013) still apply so no upstream shape leaks unshaped through the gateway.

**Alternatives considered**: (a) Force a fake repository over HTTP — rejected: misrepresents the data source and adds a pointless abstraction the spec removed elsewhere. (b) Skip DTOs in bff and pass upstream payloads through — rejected: violates FR-011/FR-012.

---

## R5 — Existing scheduled jobs vs. "crons out of scope"

**Decision**: `banking-ms` currently depends on `@nestjs/schedule ^5` and has `infrastructure/scheduling/` (and api/banking-ms both pin the package). Because crons are explicitly out of scope (FR-OOS-1), scheduling code is **left functionally intact** and is *not* refactored into any new convention or `crons/` folder. It is relocated minimally so the service still builds: schedule-related providers move under the module they serve (e.g. `modules/bank-connections/`) or `common/` if cross-cutting, wired by that module, with no behavioral change. A permanent home for scheduled jobs is deferred to a future feature.

**Rationale**: The spec's Assumptions stated "no scheduled-job usage today"; recon shows this is inaccurate for banking-ms. Rather than expand scope, the plan honors FR-OOS-1 by preserving the existing jobs untouched in behavior while still satisfying "no legacy layered folders remain" (SC-006) — the scheduling code moves out of the DDD `infrastructure/` tree but keeps doing exactly what it does now.

**Alternatives considered**: (a) Migrate scheduling into a new `crons/` convention now — rejected: directly contradicts FR-OOS-1. (b) Delete/disable scheduling — rejected: changes behavior (FR-019).

**Note surfaced to stakeholders**: The spec Assumption "no scheduled-job usage today" should be read as superseded by this decision; scheduling exists and is preserved as-is.

---

## R6 — Relocating backend-only packages to `libs/`

**Decision**: Create top-level `libs/` and move `auth`, `config`, `events`, `logger`, `observability` there from `packages/`. Keep `contracts` and `ui` (front-consumed) and `eslint-config`, `tsconfig` (tooling) in `packages/`. Mechanics: (1) add `- "libs/*"` to `pnpm-workspace.yaml` (currently `apps/*`, `services/*`, `packages/*`); (2) `git mv` each of the 5 dirs; (3) `pnpm install` to relink workspace symlinks. Package **names are unchanged** (`@finance/auth`, etc.), so no consumer import specifier changes. There are **no root tsconfig path aliases** (services resolve `@finance/*` via pnpm's `node_modules` symlinks by package name), so no alias edits are needed; `@finance/tsconfig` stays in `packages/` and `extends` paths keep resolving.

**Rationale**: Recon confirms 0 frontend source imports of these 5 packages and none are declared in any `apps/*` package.json (FR-Pkg-2, FR-Pkg-3, SC-Pkg). Because the workspace resolves by package name, physically moving the folder is low-churn: it is a directory move + one workspace-glob line + reinstall, not a rename cascade.

**Alternatives considered**: (a) Rename the npm scope (e.g. `@finance-lib/*`) — rejected: forces edits at every import site for no benefit. (b) Leave them in `packages/` and rely on lint rules to bar frontend imports — rejected: FR-Pkg-2 requires physical relocation to `libs/`.

---

## R7 — Migration sequencing (keeping every step green)

**Decision**: Sequence to satisfy FR-021 (each step builds + tests pass):

1. **Package relocation first** (R6) — independent of module refactors; verify all four services + apps still build and install.
2. **Per module, one at a time**, smallest-blast-radius module first (proves the pattern, US1/US2 independent test): introduce `entities/` (move ORM entity), `dto/`, `converters/`; fold use cases into the service injecting `Repository<Entity>`; delete the custom `*.repository.ts` + domain interface; flatten controller to delegation + DTO return; move tests alongside and keep them green.
3. **`common/` normalization** per service (R2) once its modules are converted.
4. **`database/` centralization** (R1) per service.
5. **Logging pass** (US3, FR-014..017) applied per class as each module is touched, finalized in a sweep.
6. **ai-ms and bff** adapted to their minimal/gateway shapes (R3/R4).
7. **Final conformance sweep** — structural checks (contracts/structural-checks.md), full `pnpm -r build` + `pnpm -r test`, confirm 0 legacy folders and 0 `*.repository.ts` remain (SC-006).

Recommended module order: **api/accounts** (4 use cases, self-contained) → api/cards → api/categories (7 use cases + overrides/hidden) → api/transactions (10 use cases, most complex) → banking-ms/bank-connections (8 use cases + scheduling, R5) → bff modules → ai-ms.

**Rationale**: Package move is orthogonal and de-risks first. Converting one simple module first delivers the MVP proof (US1/US2 are independently testable per spec) and establishes the pattern reviewers check the rest against. Co-located tests provide per-step regression detection (FR-020).

**Alternatives considered**: (a) Big-bang all services at once — rejected: violates FR-021's green-at-each-step requirement and makes regressions un-bisectable. (b) Logging as a separate final-only project — rejected: cheaper to apply per class while the file is already open.
