# Feature Specification: Backend NestJS Architecture Convention

**Feature Branch**: `007-backend-module-restructure`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "mude a arquitetura dos backends — Diretrizes de Arquitetura API (NestJS): estrutura de pastas com `src/common/{types,middlewares,interceptors}` e `src/modules/<name>/{dto,converters,entities}` + `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`; controllers sem lógica de negócio (só delegam e retornam DTOs, nunca Entities); services com toda a lógica e acesso a banco via TypeORM `@InjectRepository`, retornando DTOs; converters Entity↔DTO; DTOs obrigatórios para entrada e saída; logging com `Logger` nativo do NestJS por classe; Clean Architecture + SOLID; fluxo Controller → Service → Repository (TypeORM)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Standard module anatomy (Priority: P1)

A backend developer opens any feature module and finds the exact same anatomy: a `<name>/` folder containing `dto/`, `converters/`, `entities/`, and the three flat files `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`. Cross-module shared code lives under `src/common/` (`types/`, `middlewares/`, `interceptors/`). A developer can predict exactly where any piece of code lives without prior knowledge of the module.

**Why this priority**: A single, predictable module shape is the core of the change. Even one module converted to this anatomy proves the pattern and makes navigation and review predictable.

**Independent Test**: Convert one module (e.g. `accounts`) to the standard anatomy, confirm its endpoints and behavior are unchanged, and confirm the folder/file set matches the convention exactly.

**Acceptance Scenarios**:

1. **Given** a converted module, **When** a developer inspects its folder, **Then** it contains `dto/`, `converters/`, `entities/`, and the flat `*.module.ts`, `*.controller.ts`, `*.service.ts` files, with no other layout.
2. **Given** cross-module shared types, middlewares, or interceptors, **When** a developer looks for them, **Then** they are found only under `src/common/{types,middlewares,interceptors}`.
3. **Given** a converted module, **When** the service is built and its tests run, **Then** all previously passing behavior still passes with no functional regression.

---

### User Story 2 - Strict layering and DTO boundary (Priority: P1)

A developer (or reviewer) can trust that every controller is free of business logic, that no entity ever crosses the API boundary, and that all business logic and database access is concentrated in services. Requests flow strictly `Controller → Service → Repository (TypeORM)`; controllers never touch repositories. Every input and output at the controller boundary is a DTO, and entity↔DTO translation is done by converters.

**Why this priority**: The layering and the DTO boundary are what make the structure a *clean* architecture rather than just a folder rename. This is the enforceable behavioral contract of the feature and is independently valuable.

**Independent Test**: For a converted module, verify controllers contain only delegation + DTO return, verify no endpoint response exposes an entity shape, and verify services obtain data exclusively via injected TypeORM repositories and return DTOs.

**Acceptance Scenarios**:

1. **Given** any controller, **When** its methods are inspected, **Then** they only receive the request, delegate to a service, and return a response DTO — with no business logic and no entity import or return.
2. **Given** any service, **When** it accesses persistence, **Then** it does so exclusively through injected TypeORM repositories and returns DTOs to the controller, never entities.
3. **Given** a response payload, **When** it is produced, **Then** it is built from a converter mapping an entity to a response DTO, and a distinct response DTO exists separate from the entity.
4. **Given** a controller, **When** its dependencies are inspected, **Then** it depends only on its service and never directly on a repository.

---

### User Story 3 - Consistent logging across services and controllers (Priority: P2)

An operator reading logs sees a consistent, per-class, leveled log trail: every controller logs the entry of each endpoint (method + resource + relevant params), and every service logs the start, key business decisions (e.g. conflict, not-found), and completion (with the resource id) of each operation, using the correct level (normal flow, expected-but-not-ideal, unexpected error).

**Why this priority**: Consistent logging is a cross-cutting quality attribute that pays off in operability. It depends on the module/service structure existing first, so it is P2, but it is independently verifiable.

**Independent Test**: Exercise a converted module's endpoints and confirm the emitted logs follow the per-class, leveled, entry/step/completion convention.

**Acceptance Scenarios**:

1. **Given** any service or controller, **When** it is instantiated, **Then** it holds a class-named logger.
2. **Given** an endpoint is called, **When** the controller handles it, **Then** an entry log records the method, resource, and relevant params.
3. **Given** a business decision such as a conflict or not-found, **When** it occurs in a service, **Then** it is logged at the expected-but-not-ideal level, while unexpected failures are logged at the error level and normal steps at the normal level.

---

### User Story 4 - Migration completes across all backend services (Priority: P2)

A maintainer verifies that every backend service has been migrated to the convention, with no residual legacy layout remaining, so the whole backend is uniform.

**Why this priority**: Full coverage is the end state but depends on the pattern proven in the earlier stories; partial migration already delivers value.

**Independent Test**: Enumerate all backend modules across all services and confirm each conforms, with no legacy layered folders remaining.

**Acceptance Scenarios**:

1. **Given** the full backend, **When** all modules are enumerated, **Then** each conforms to the standard anatomy and layering.
2. **Given** the full backend, **When** the aggregate test suite runs, **Then** it passes with no functional regression relative to before the migration.
3. **Given** a service whose role does not require persistence, **When** it is migrated, **Then** it omits the folders that do not apply (e.g. `entities/`) rather than introducing empty persistence artifacts.

---

### Edge Cases

- **Business logic that spans modules**: Shared pure types/interfaces/enums go to `common/types/`; genuinely shared behavior must have an agreed home rather than being duplicated across services.
- **Scheduled/recurring jobs (crons)**: Out of scope for this feature. There is no scheduled-job usage today; a home for crons will be decided when the first one is introduced, and is not part of this convention.
- **Custom repository abstraction**: The existing custom `*.repository.ts` classes per module are removed. Services depend directly on the TypeORM `Repository<Entity>` injected via `@InjectRepository`; there is no separate repository layer.
- **Front-shared packages vs backend-shared code**: Still in scope. The shared workspace package is trimmed to front-shared interfaces/DTOs only, and backend-only shared code (logging, configuration, events, observability, server-side auth helpers) is relocated to a dedicated backend-shared location (`libs/`).
- **Entity leakage**: Any place currently returning an entity from a controller must be converted to a response DTO; the migration must find and fix all such leaks.
- **Import churn & sequencing**: Moving code changes import paths; each migration step must leave all builds green and all tests passing.
- **Tests co-location**: Existing tests are co-located next to the code they cover; the convention must state that tests stay co-located within the module.

## Requirements *(mandatory)*

### Functional Requirements

#### Folder & module anatomy

- **FR-001**: Each backend service MUST organize code as `src/common/` (shared) plus `src/modules/<name>/` (one folder per feature module).
- **FR-002**: `src/common/` MUST contain `types/` (shared types, interfaces, enums), `middlewares/` (framework middlewares), and `interceptors/` (framework interceptors), and MUST NOT contain feature business logic.
- **FR-003**: Each feature module folder MUST contain `dto/`, `converters/`, `entities/`, and the flat files `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`.
- **FR-004**: Folders that do not apply to a module MUST be omitted rather than created empty (e.g. a module or service with no persistence has no `entities/`).
- **FR-005**: Each NestJS module MUST wire its controller and service and register its entities, and MUST export only what other modules need to consume.

#### Layering & responsibilities

- **FR-006**: Controllers MUST contain no business logic; they only receive the request, delegate to their service, and return a response DTO, using the framework's routing/parameter decorators.
- **FR-007**: Controllers MUST NOT import or return entities, and MUST NOT depend on repositories directly.
- **FR-008**: Services MUST hold all business logic for their module.
- **FR-009**: Services MUST access the database exclusively through injected TypeORM repositories and MUST return DTOs (never entities) to controllers.
- **FR-009a**: The existing custom `*.repository.ts` classes MUST be removed; services depend directly on the injected TypeORM `Repository<Entity>` with no intermediate custom repository layer.
- **FR-010**: The runtime dependency flow MUST be `Controller → Service → Repository (TypeORM)`, and each class MUST have a single responsibility (Clean Architecture / SOLID).

#### DTOs & converters

- **FR-011**: DTOs MUST be defined for both input (body/params) and output (response) at every controller boundary, and MUST live in the module's `dto/` folder.
- **FR-012**: A response DTO MUST always be a distinct type from the entity — entities are never used as the response shape.
- **FR-013**: Entity↔DTO translation MUST be performed by converters located in the module's `converters/` folder.

#### Logging

- **FR-014**: Every service and every controller MUST instantiate a logger named after its class.
- **FR-015**: Controllers MUST log the entry of each endpoint including the HTTP method, the resource, and the relevant params.
- **FR-016**: Services MUST log the start of an operation, relevant business decisions (e.g. conflict, not-found), and completion including the affected resource id.
- **FR-017**: Log levels MUST be used correctly — normal flow at the normal level, expected-but-not-ideal situations (not-found, conflict) at the warning level, and unexpected errors at the error level.

#### Shared packages

- **FR-Pkg-1**: The shared front-facing workspace package MUST contain only interfaces, DTOs, and artifacts actually consumed by the frontend.
- **FR-Pkg-2**: Backend-only shared code (logging, configuration, events, observability, server-side auth helpers) MUST NOT be exposed from the front-facing package and MUST be relocated to a dedicated backend-shared location (`libs/`) that remains reusable across services.
- **FR-Pkg-3**: Frontend applications MUST NOT depend on any backend-only shared code after the change. TypeScript base config and lint config packages are build tooling and remain as workspace tooling regardless of this rule.

#### Out of scope

- **FR-OOS-1**: Scheduled/cron jobs are out of scope; no `crons/` folder or scheduled-job convention is introduced by this feature.

#### Migration integrity

- **FR-018**: All backend services in scope MUST adopt the convention, each using only the folders applicable to its role.
- **FR-019**: The migration MUST preserve all existing backend behavior — every endpoint and persistence operation behaves identically before and after.
- **FR-020**: All existing automated tests MUST pass after the migration and MUST remain discoverable, co-located within their module.
- **FR-021**: The migration MUST be sequenced so that each intermediate step leaves all service builds succeeding and all tests passing.
- **FR-022**: The convention MUST be documented so future modules are created in the standard shape without ambiguity.

### Key Entities *(include if feature involves data)*

- **Feature Module**: A cohesive unit of backend functionality (e.g. accounts, transactions, categories, cards, bank-connections) owning its `dto/`, `converters/`, `entities/`, module, controller, and service.
- **DTO**: The input and output shapes at the controller boundary; response DTOs are always distinct from entities.
- **Converter**: A per-module mapper translating between entities and DTOs.
- **Entity**: A persistence model owned by a module and never exposed across the controller boundary.
- **Common Shared Code**: Cross-module types/interfaces/enums, middlewares, and interceptors under `src/common/`.
- **Class Logger**: A per-class logging convention applied uniformly to services and controllers.
- **Shared Front-Facing Package**: The workspace package limited to interfaces/DTOs consumed by the frontend.
- **Backend-Shared Code**: Cross-service backend concerns (logging, configuration, events, observability, server-side auth) relocated to `libs/`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of backend feature modules conform to the standard anatomy (`dto/`, `converters/`, `entities/`, plus the three flat files), verifiable by an automated structural check.
- **SC-002**: 0 controllers contain business logic and 0 controllers import or return an entity.
- **SC-003**: 0 API responses expose an entity shape — every response is a response DTO produced via a converter.
- **SC-004**: 100% of services access persistence only through injected TypeORM repositories.
- **SC-005**: 100% of services and controllers declare a class-named logger, and endpoint entry / operation start / completion are logged with correct levels.
- **SC-006**: 0 backend modules retain a legacy layered layout after migration, and 0 custom `*.repository.ts` classes remain.
- **SC-Pkg**: The shared front-facing package exports only interface/DTO/front-shared artifacts (0 backend-only exports), and 0 frontend imports resolve to backend-only shared code.
- **SC-007**: The full backend test suite passes at 100% of its pre-migration pass rate, and every backend service builds successfully after the migration.
- **SC-008**: A new developer can correctly predict which folder/file any given piece of module code belongs in for at least 9 of 10 sample cases, using only the documented convention.

## Assumptions

- Persistence continues to use TypeORM with entities; the change is organizational and behavioral (layering/logging), not a change of database technology.
- The backend services in scope are the four workspace services (the main API, the banking microservice, the AI microservice, and the aggregation/gateway service); services adopt only the folders applicable to their role, and frontend applications are out of scope.
- Tests remain co-located within each module.
- The migration is a structural/behavioral refactor with no intended change to public HTTP APIs or database schema; response payload shapes remain equivalent to today's, now formalized as response DTOs.
- Folder/file names follow the exact terms in the directive (`common`, `types`, `middlewares`, `interceptors`, `modules`, `dto`, `converters`, `entities`, `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`).
- Custom repository classes are removed (services use injected TypeORM `Repository<Entity>` directly); scheduled/cron jobs are out of scope; the shared-package cleanup (front-shared-only + backend-only code relocated to `libs/`) remains in scope.
- This specification supersedes the earlier draft of the backend restructure for this feature; where the two differ (no separate `repositories/` or `crons/` folder, no `domain/` folder, addition of `common/` and logging conventions), this directive governs.
