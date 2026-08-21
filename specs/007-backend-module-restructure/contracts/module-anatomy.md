# Contract: Standard Module Anatomy & Layering

**Feature**: 007-backend-module-restructure

This is the enforceable convention every backend module and service MUST satisfy. It is the interface this feature exposes to developers and reviewers.

## C1 — Folder & file anatomy

A feature module folder `src/modules/<name>/` MUST contain:

```
modules/<name>/
├── dto/                    # input + response DTOs (required wherever the module has a controller boundary)
├── converters/             # Entity↔DTO mappers (required wherever entities exist)
├── entities/               # TypeORM entities (OMIT when the module has no persistence — R4/ai-ms)
├── <name>.module.ts        # required
├── <name>.controller.ts    # required
├── <name>.service.ts       # required
└── <name>.service.spec.ts  # co-located tests (and *.controller.spec.ts as applicable)
```

No other layout is permitted (FR-003). Inapplicable folders are OMITTED, never created empty (FR-004).

Service-level layout:

```
src/
├── common/{types,middlewares,interceptors}[,guards,filters,pipes,decorators]
├── database/{data-source.ts,migrations/}      # only where persistence exists
└── modules/<name>/...
```

`common/` MUST NOT contain feature business logic (FR-002).

## C2 — Controller contract

- MUST use NestJS routing/param decorators (`@Get`, `@Post`, `@Body`, `@Param`, …).
- MUST only: receive request → delegate to its service → return a response DTO.
- MUST NOT contain business logic (FR-006).
- MUST NOT import or return an entity (FR-007).
- MUST NOT depend on any repository (FR-007).
- MUST depend only on its own service.
- MUST log endpoint entry (method + resource + relevant params) via a class logger (FR-015).

## C3 — Service contract

- MUST hold all business logic for the module (FR-008).
- MUST access persistence exclusively via injected TypeORM `Repository<Entity>` (`@InjectRepository`) (FR-009). *Exception (R4):* gateway (bff) services with no persistence acquire data via injected HTTP clients; they still return DTOs.
- MUST return DTOs, never entities (FR-009).
- MUST NOT use any custom `*.repository.ts` abstraction — none may exist after migration (FR-009a, SC-006).
- MUST log operation start, business decisions (warn), completion with resource id, and unexpected errors (error) at correct levels (FR-016, FR-017).

## C4 — DTO & converter contract

- Every controller boundary MUST define input DTOs (body/params) and a response DTO in `dto/` (FR-011).
- A response DTO MUST be a distinct type from the entity; the entity is never the response shape (FR-012).
- Entity↔DTO translation MUST be done only by a converter in `converters/` (FR-013).

## C5 — Logging contract

- Every service and controller MUST declare `private readonly logger = new Logger(<Class>.name)` (FR-014).
- Levels: `log` = normal flow; `warn` = expected-but-not-ideal (not-found, conflict); `error` = unexpected failure (FR-017).

## C6 — Package boundary contract

- `packages/` front-facing packages export only interfaces/DTOs/UI consumed by the frontend (FR-Pkg-1).
- Backend-only shared code lives in `libs/` and is never exposed from the front-facing package (FR-Pkg-2).
- No `apps/*` import resolves to backend-only shared code (FR-Pkg-3, SC-Pkg). `eslint-config` and `tsconfig` remain workspace tooling.
