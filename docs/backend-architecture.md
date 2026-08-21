# Backend Architecture Convention

> **Status**: finalized (feature `007-backend-module-restructure`).
> Source of truth for the convention every backend NestJS service (`api`, `banking-ms`, `ai-ms`, `bff`) MUST follow.

## Standard module anatomy

A feature module lives at `src/modules/<name>/` and contains exactly:

```
modules/<name>/
├── dto/                    # input + response DTOs
├── converters/             # Entity↔DTO mappers (omit where no entities)
├── entities/               # TypeORM entities (omit when no persistence)
├── <name>.module.ts
├── <name>.controller.ts
├── <name>.service.ts
└── <name>.service.spec.ts  # co-located tests
```

No other layout is permitted. Inapplicable folders are omitted, never created empty.

## Service-level layout

```
src/
├── common/{types,middlewares,interceptors}[,guards,filters,pipes,decorators]
├── database/{data-source.ts,migrations/,seed.ts?}   # only where persistence exists (R1)
└── modules/<name>/...
```

`common/` holds shared framework code only — never feature business logic.

## Contracts (summary)

- **Controller**: routing/param decorators → delegate to service → return response DTO. No business logic, no entity import/return, no repository dependency. Logs endpoint entry.
- **Service**: all business logic; persistence via injected `Repository<Entity>` (`@InjectRepository`); returns DTOs, never entities; no custom `*.repository.ts`. Logs start / decisions (warn) / completion / errors (error).
- **DTO & converter**: input + response DTOs in `dto/`; response DTO is a distinct type from the entity; Entity↔DTO translation only in `converters/`.
- **Logging**: every service and controller declares `private readonly logger = new Logger(<Class>.name)`. Levels: `log` normal, `warn` expected-but-not-ideal, `error` unexpected.
- **Package boundary**: backend-only shared code lives in `libs/`; front-consumed packages (`contracts`, `ui`) stay in `packages/`; no `apps/*` import resolves to a backend-only lib.

## Service-specific notes

- **R1 — `database/`**: persistence services (`api`, `banking-ms`, `bff`) keep TypeORM wiring in `src/database/`: the `DataSource` (`data-source.ts`), all migrations under `database/migrations/`, and any `seed.ts`. Migrations are centralized per service (not scattered under modules); the `migrations` glob in `data-source.ts` points at `src/database/migrations/*`. `ai-ms` has no persistence, so it has no `database/`.
- **R2 — extended `common/`**: beyond the base `types/`, `middlewares/`, `interceptors/`, a persistence/HTTP service's `common/` also carries `guards/`, `filters/`, `pipes/`, and `decorators/` (e.g. `@CurrentUser`, `@Public`, service-account decorators; the domain-exception filter; the zod validation pipe). These are framework cross-cutting concerns shared across modules — never feature logic.
- **R4 — gateway (bff) modules have no `entities/`**: bff proxy modules follow the standard anatomy minus `entities/`. Their services acquire data through injected HTTP clients (not TypeORM repositories) and return response DTOs typed by `@finance/contracts`. Because a pure proxy forwards the upstream service's already-shaped DTO unchanged, bff modules also omit `dto/` and `converters/` — those folders appear only when a module actually builds a new response shape. The single bff persistence entity (`SessionEntity`) lives under `src/database/`, not in a feature module.
- **R5 — scheduling preserved as-is, out of scope**: banking-ms scheduling was relocated out of the removed `infrastructure/` tree (into its module or `common/`) with no behavioral change and stays wired via the module. No `crons/` convention is introduced (FR-OOS-1); scheduling is intentionally not part of this convention.

## Conformance

Run `scripts/check-architecture.sh` (implements CHK-1..CHK-8). It exits non-zero on any structural violation.
