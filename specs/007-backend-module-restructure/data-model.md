# Phase 1 Data Model: Backend NestJS Architecture Convention

**Feature**: 007-backend-module-restructure | **Date**: 2026-08-20

This feature is an architecture convention, so the "data model" is the **structural model** of the target organization plus the concrete per-service inventory of what gets migrated. No database schema changes (Assumptions; FR-019).

---

## Structural entities and their relationships

| Structural entity | Location | Definition | Rules |
|---|---|---|---|
| **Feature Module** | `src/modules/<name>/` | Cohesive unit owning its dto/converters/entities + module/controller/service files | MUST contain the three flat files; MUST contain only the sub-folders that apply (FR-003, FR-004) |
| **Module wiring** | `<name>.module.ts` | NestJS `@Module` registering controller, service, and `TypeOrmModule.forFeature([...])` | Exports only what other modules consume (FR-005) |
| **Controller** | `<name>.controller.ts` | HTTP boundary: routing/param decorators, delegate to service, return response DTO | No business logic; no entity import/return; no repository dependency (FR-006, FR-007) |
| **Service** | `<name>.service.ts` | All business logic for the module | Injects `Repository<Entity>` via `@InjectRepository`; returns DTOs, never entities (FR-008, FR-009, FR-009a) |
| **Input DTO** | `dto/*.dto.ts` | Body/param shape entering the controller | Validated (class-validator / zod pipe); lives in `dto/` (FR-011) |
| **Response DTO** | `dto/*-response.dto.ts` | Output shape leaving the controller | Distinct type from the entity, always (FR-012) |
| **Converter** | `converters/<name>.converter.ts` | Static Entity↔DTO mapping | Sole place entity→response-DTO translation happens (FR-013) |
| **Entity** | `entities/<name>.entity.ts` | TypeORM persistence model | Owned by one module; never crosses the controller boundary (FR-012) |
| **Class Logger** | field on every service & controller | `new Logger(<Class>.name)` | Entry log (controller), start/decision/completion logs (service), correct levels (FR-014..017) |
| **Common shared code** | `src/common/{types,middlewares,interceptors,guards,filters,pipes,decorators}` | Cross-module framework code | No feature business logic (FR-002; extended per research R2) |
| **Database config** | `src/database/{data-source.ts,migrations/,seed.ts?}` | TypeORM CLI DataSource + migrations | Non-module infrastructure (research R1) |
| **Backend-shared lib** | `libs/<name>/` | Cross-service backend concern | Relocated from `packages/`; name unchanged (FR-Pkg-2; research R6) |
| **Front-shared package** | `packages/{contracts,ui}/` | Interfaces/DTOs/UI consumed by frontend | Only front-consumed artifacts (FR-Pkg-1) |

### Dependency flow (runtime)

```
Controller ──delegates──▶ Service ──@InjectRepository──▶ Repository<Entity> (TypeORM)
    │                        │
    └──returns Response DTO ◀─┴── Converter(Entity → Response DTO)
```

Controllers depend only on their service (FR-006, FR-007, FR-010). One class per role (SOLID).

### Logging model (per class)

| Point | Level | Emitted by | Content |
|---|---|---|---|
| Endpoint entry | `log` | Controller | HTTP method + resource + relevant params (FR-015) |
| Operation start | `log` | Service | Operation name + key input (FR-016) |
| Expected-but-not-ideal (not-found, conflict) | `warn` | Service | The condition + identifying value (FR-016, FR-017) |
| Operation completion | `log` | Service | Affected resource id (FR-016) |
| Unexpected failure | `error` | Service | Error context (FR-017) |

---

## Per-service migration inventory

### services/api (TypeORM; 4 modules, 37 specs)

| Module | Use-cases to fold → service methods | Custom repos to remove | Migrations to move | Entities |
|---|---|---|---|---|
| accounts | 4 | 2 (`domain/account.repository.ts` interface + persistence impl) | 1 | account |
| cards | 4 | 2 (credit-card) | 1 | credit-card |
| categories | 7 | 6 (category, category-override, hidden-category — interface + impl each) | 5 | category, category-override, hidden-category |
| transactions | 10 | 2 (transaction) | 2 | transaction (+ lookups) |

Plus: `common/{auth,filters,validation}` → normalized `common/` (R2); `common/health/` → `modules/health/`; `infrastructure/database/data-source.ts` + `seed.ts` → `src/database/` (R1). Integration specs (`*.int.spec.ts`, repository specs) that build their own `DataSource` are rewritten to target the service directly (they currently test the removed custom repositories).

### services/banking-ms (TypeORM; 1 module, 18 specs)

| Module | Use-cases to fold | Custom repos to remove | Migrations to move | Entities |
|---|---|---|---|---|
| bank-connections | 8 | 2 (bank-connection) | 2 | bank-connection (+ api-linkage) |

Plus: `infrastructure/{pluggy,transactions-importer}` fold into the module (collaborators of the service); `infrastructure/scheduling/` preserved as-is, relocated minimally (R5); `common/` normalized; `database/` centralized.

### services/bff (gateway; TypeORM session only, 8 specs)

Feature modules: accounts, cards, categories, transactions, bank-connections, reference → `modules/<name>/{dto,converters}` **without `entities/`** (R4); services use injected HTTP clients. `auth/` → `modules/auth/` keeping `SessionEntity` under `src/database/` (R1). `shared/` (api-client, banking-api-client) → `common/`. `health/` → `modules/health/`. No custom `*.repository.ts` exist.

### services/ai-ms (no persistence, 1 spec)

Minimal: `health/` → `modules/health/` (module + controller); `providers/ai-provider.ts` → its owning module's service or `common/`. **Omits `entities/` and `converters/`** (FR-004). No typeorm, no `database/`.

### Package relocation (R6)

| Package | Frontend-consumed? | Action |
|---|---|---|
| contracts | Yes (web: 64 files) | Stays in `packages/` |
| ui | Yes (web: 195 refs) | Stays in `packages/` |
| eslint-config | Tooling | Stays in `packages/` |
| tsconfig | Tooling | Stays in `packages/` |
| auth | No | → `libs/auth` |
| config | No | → `libs/config` |
| events | No | → `libs/events` |
| logger | No | → `libs/logger` |
| observability | No | → `libs/observability` |
