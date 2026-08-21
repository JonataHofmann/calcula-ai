---
description: "Task list for Backend NestJS Architecture Convention migration"
---

# Tasks: Backend NestJS Architecture Convention

**Input**: Design documents from `/specs/007-backend-module-restructure/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R7), data-model.md, contracts/ (module-anatomy.md, structural-checks.md)

**Tests**: No net-new test suites are requested. The spec requires that all existing co-located `*.spec.ts` stay green (FR-020) and that repository-integration specs (which test the removed custom repositories) be rewritten to target services. Those preservation/rewrite tasks are included inline per phase.

**Organization**: US1–US3 convert the **pilot module `api/accounts`** across three quality dimensions (anatomy → layering/DTO → logging), each independently verifiable per the spec. US4 rolls the proven pattern out to every remaining module and service.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/services, no dependency on an incomplete task)
- **[Story]**: US1–US4 (setup/foundational/polish carry no story label)

## Path Conventions

Monorepo: backend services at `services/{api,banking-ms,ai-ms,bff}/src/`; shared workspace at `packages/`; new backend-shared at `libs/`; frontend `apps/*` (out of scope).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Orthogonal, whole-workspace groundwork done first to de-risk (research R6, R7 step 1).

- [X] T001 Add `- "libs/*"` to the `packages:` list in `pnpm-workspace.yaml` (currently `apps/*`, `services/*`, `packages/*`).
- [X] T002 `git mv` the five backend-only packages into `libs/`: `packages/auth`→`libs/auth`, `packages/config`→`libs/config`, `packages/events`→`libs/events`, `packages/logger`→`libs/logger`, `packages/observability`→`libs/observability`. Do NOT rename their `@finance/*` package `name` fields (import specifiers must stay unchanged, per R6).
- [X] T003 Run `pnpm install` from repo root to relink workspace symlinks, then `pnpm -r build` and `pnpm -r test` to confirm all four services + apps still build and every spec still passes after the relocation (baseline: api 37, banking-ms 18, bff 8, ai-ms 1).
- [X] T004 [P] Add `scripts/check-architecture.sh` implementing CHK-1..CHK-8 from `specs/007-backend-module-restructure/contracts/structural-checks.md` (anatomy, no custom repos, controllers clean, loggers present, package boundary). Make it exit non-zero on any violation.
- [X] T005 [P] Create the convention reference doc skeleton at `docs/backend-architecture.md` seeded from `contracts/module-anatomy.md` (finalized in Polish, FR-022).

**Checkpoint**: `libs/` populated, all builds/tests green, conformance script runnable.

---

## Phase 2: Foundational (api service scaffolding — blocks the pilot)

**Purpose**: `api` service-wide structure every `api` module needs before/while converting. (The pilot module lives in `api`.)

**⚠️ CRITICAL**: Complete before Phase 3 pilot work.

- [X] T006 Create `services/api/src/database/`; `git mv` `services/api/src/infrastructure/database/data-source.ts` and `seed.ts` there; create `services/api/src/database/migrations/`; update the `migrations` glob in `data-source.ts` to point at `src/database/migrations/*` (research R1). Do not move migration files yet.
- [X] T007 Normalize `services/api/src/common/`: move `common/auth/` guards → `common/guards/` and its `@CurrentUser`/`@Public`/service-account decorators → `common/decorators/`; move `common/filters/domain-exception.filter.ts` → `common/filters/`; move `common/validation/zod-validation.pipe.ts` → `common/pipes/` (research R2). Update all import sites; keep guard/pipe/filter specs co-located and green.
- [X] T008 Convert `services/api/src/common/health/` into a feature module `services/api/src/modules/health/` (`health.module.ts`, `health.controller.ts` + co-located spec); remove `common/health/`; update `app.module.ts` imports.

**Checkpoint**: `api` has `database/`, normalized `common/`, and a `modules/health/`; api builds + tests green.

---

## Phase 3: User Story 1 - Standard module anatomy (Priority: P1) 🎯 MVP

**Goal**: `services/api/src/modules/accounts/` exhibits the exact standard anatomy — `dto/`, `converters/`, `entities/` + the three flat files, no legacy layout.

**Independent Test**: Inspect the accounts folder → matches convention exactly (CHK-1); accounts endpoints/behavior unchanged (accounts specs green).

- [X] T009 [US1] Create `services/api/src/modules/accounts/entities/`; `git mv` the ORM entity from `modules/accounts/infrastructure/persistence/entities/` into it as `account.entity.ts`.
- [X] T010 [US1] Create `services/api/src/modules/accounts/dto/`; add the input DTO(s) (body/params) and a distinct `account-response.dto.ts` (separate from the entity, FR-012), reusing existing DTO/schema shapes so response payloads stay equivalent.
- [X] T011 [US1] Create `services/api/src/modules/accounts/converters/account.converter.ts` with a static `toResponse(entity): AccountResponseDto` mapping (FR-013).
- [X] T012 [US1] Move `git mv` the accounts migration `…/persistence/migrations/1755500000000-create-accounts-table.ts` → `services/api/src/database/migrations/`.
- [X] T013 [US1] Create the flat skeletons `accounts.module.ts`, `accounts.controller.ts`, `accounts.service.ts` at `services/api/src/modules/accounts/` (moving/renaming from `presentation/` where applicable) so the folder now holds the three flat files + `dto/`/`converters/`/`entities/`. Wire `TypeOrmModule.forFeature([Account])` in the module (FR-005). Move co-located accounts `*.spec.ts` alongside the new files.
- [X] T014 [US1] Run `bash scripts/check-architecture.sh` scoped to accounts (CHK-1) and `cd services/api && pnpm test -- accounts`; confirm anatomy matches and all accounts specs pass.

**Checkpoint**: accounts folder conforms structurally; behavior unchanged. (Layering internals finished in US2.)

---

## Phase 4: User Story 2 - Strict layering and DTO boundary (Priority: P1)

**Goal**: The accounts controller carries no logic/entities/repos; `AccountsService` holds all logic, injects `Repository<Account>`, returns DTOs; the custom repository is gone.

**Independent Test**: CHK-2 (no `*.repository.ts` under accounts), CHK-3 (controller has no entity/repository refs), CHK-5 (response is a DTO via converter); accounts specs green.

- [X] T015 [US2] Fold the 4 accounts use-cases from `modules/accounts/application/use-cases/*` into methods on `services/api/src/modules/accounts/accounts.service.ts`; inject `@InjectRepository(Account) private readonly repo: Repository<Account>` and call the repository directly (FR-008, FR-009).
- [X] T016 [US2] Delete the custom repository + domain interface: `modules/accounts/domain/account.repository.ts` and `modules/accounts/infrastructure/persistence/repositories/account.repository.ts` (FR-009a); remove their provider registrations from the module.
- [X] T017 [US2] Flatten `services/api/src/modules/accounts/accounts.controller.ts` to routing/param decorators that delegate to the service and return `AccountResponseDto` via the converter; remove any entity import or business logic (FR-006, FR-007).
- [X] T018 [US2] Migrate any accounts domain value objects/enums/errors: shared ones → `services/api/src/common/types/`; module-local ones → a co-located `accounts.types.ts` or inline (research R3). Delete the now-empty `domain/`, `application/`, `infrastructure/`, `presentation/` directories under accounts.
- [X] T019 [US2] Rewrite the accounts repository-integration spec(s) (e.g. `account.repository.spec.ts`, which construct their own `DataSource` to test the removed repository) to exercise `AccountsService` instead; keep them co-located and green (FR-020).
- [X] T020 [US2] Run CHK-2/CHK-3/CHK-5 for accounts and `pnpm test -- accounts`; confirm no custom repo, clean controller, DTO responses, all specs pass.

**Checkpoint**: accounts fully clean-layered and behavior-preserving.

---

## Phase 5: User Story 3 - Consistent logging (Priority: P2)

**Goal**: accounts controller + service emit the per-class, leveled log trail; a reusable logging pattern is established for rollout.

**Independent Test**: Exercise accounts endpoints → controller entry log, service start/decision/completion logs at correct levels (CHK-6 + manual log inspection, quickstart Scenario C).

- [X] T021 [US3] Add `private readonly logger = new Logger(AccountsController.name)` to the accounts controller and log each endpoint entry (method + resource + relevant params) (FR-014, FR-015).
- [X] T022 [US3] Add `private readonly logger = new Logger(AccountsService.name)` to `AccountsService`; log operation start (`log`), not-found/conflict decisions (`warn`), completion with resource id (`log`), and unexpected errors (`error`) (FR-016, FR-017).
- [X] T023 [US3] Run CHK-6 and quickstart Scenario C against accounts; confirm loggers present and the leveled trail appears; document the pattern in `docs/backend-architecture.md`.

**Checkpoint**: Pilot module (accounts) fully proves US1+US2+US3. **MVP complete — stop and validate before rollout.**

---

## Phase 6: User Story 4 - Migration across all backend services (Priority: P2)

**Goal**: Apply the proven pattern (anatomy + layering + logging) to every remaining module and service; no legacy layout or custom repository remains anywhere.

**Independent Test**: CHK-1..CHK-8 pass across the whole backend; full `pnpm -r build && pnpm -r test` green.

### api — remaining modules

- [X] T024 [P] [US4] Convert `services/api/src/modules/cards/` (anatomy: dto/converters/entities + flat files; fold 4 use-cases into `CardsService` w/ `@InjectRepository(CreditCard)`; delete 2 repo files + domain iface; flatten controller; move migration `1755600000000-create-credit-cards-table.ts` → `src/database/migrations/`; delete legacy dirs; keep specs green).
- [X] T025 [P] [US4] Convert `services/api/src/modules/categories/` (3 entities: category, category-override, hidden-category; fold 7 use-cases into `CategoriesService` w/ three injected repositories; delete 6 repo files + domain ifaces; flatten controller; move the 5 category migrations → `src/database/migrations/`; converters per entity; delete legacy dirs incl. `application/use-cases/__testing__`; keep specs green).
- [X] T026 [P] [US4] Convert `services/api/src/modules/transactions/` (fold 10 use-cases + `application/shared` into `TransactionsService` w/ `@InjectRepository(Transaction)`; keep `infrastructure/persistence/lookups` as service collaborators or `common/types`; delete 2 repo files + domain iface; flatten controller; move 2 transaction migrations → `src/database/migrations/`; rewrite `transaction.repository.int.spec.ts` + `transaction.repository.filters.int.spec.ts` to target the service; delete legacy dirs; keep specs green).
- [X] T027 [P] [US4] Add class loggers + leveled logs to cards, categories, transactions controllers & services (FR-014..017).
- [X] T028 [US4] api finalize: remove any remaining empty legacy folders under `services/api/src`; run `scripts/check-architecture.sh` for api and `cd services/api && pnpm test`; confirm 0 `*.repository.ts`, 0 legacy dirs, all 37+ specs green.

### banking-ms

- [X] T029 [US4] banking-ms scaffolding: create `services/banking-ms/src/database/` and move its `data-source.ts` + the 2 migrations there (R1); normalize `common/` (guards/filters/pipes/decorators, R2); convert `common/health/` → `modules/health/`.
- [X] T030 [US4] Convert `services/banking-ms/src/modules/bank-connections/` (dto/converters/entities: bank-connection + api-linkage; fold 8 use-cases into `BankConnectionsService` w/ `@InjectRepository`; delete 2 repo files + domain iface; flatten controller; relocate `infrastructure/{pluggy,transactions-importer}` as service collaborators; delete legacy dirs; keep specs green).
- [X] T031 [US4] Preserve scheduling (research R5): relocate `services/banking-ms/src/modules/bank-connections/infrastructure/scheduling/` out of the deleted `infrastructure/` tree (into the module or `common/`) with **no behavioral change**; keep it wired via the module; do NOT introduce a `crons/` convention (FR-OOS-1).
- [X] T032 [US4] Add class loggers + leveled logs to banking-ms controller & service; run `scripts/check-architecture.sh` for banking-ms and `cd services/banking-ms && pnpm test`; confirm 18 specs green, 0 custom repos, 0 legacy dirs.

### bff (gateway)

- [X] T033 [US4] bff scaffolding: create `services/bff/src/common/` and move `src/shared/{api-client,banking-api-client,shared.module}.ts` there; keep `src/database/` with `SessionEntity` + its migration (R1); convert `src/health/` → `modules/health/`.
- [X] T034 [P] [US4] Convert bff proxy feature folders `accounts, cards, categories, transactions, bank-connections, reference` into `services/bff/src/modules/<name>/` with `dto/` + `converters/` and **no `entities/`** (R4); services acquire data via the injected HTTP clients and return response DTOs; controllers delegate + return DTOs only.
- [X] T035 [US4] Convert `services/bff/src/auth/` → `modules/auth/` keeping guards/decorators (guards may move to `common/guards/`) and `SessionEntity` under `src/database/`; move the session migration to `src/database/migrations/`.
- [X] T036 [US4] Add class loggers + leveled logs across bff controllers & services; run `scripts/check-architecture.sh` for bff and `cd services/bff && pnpm test` (openid-client stub `moduleNameMapper` must still resolve); confirm 8 specs green.

### ai-ms (minimal, no persistence)

- [X] T037 [P] [US4] Convert ai-ms: create `services/ai-ms/src/modules/health/` (`health.module.ts`, `health.controller.ts` + spec) from `src/health/`; move `src/providers/ai-provider.ts` into its owning module's service (or `src/common/`); **omit `entities/` and `converters/`** (FR-004); no `database/`.
- [X] T038 [P] [US4] Add class loggers + leveled logs to ai-ms controller/service; run `scripts/check-architecture.sh` for ai-ms and `cd services/ai-ms && pnpm test`; confirm the spec passes.

### cross-service verification

- [X] T039 [US4] Package boundary verification (CHK-7, SC-Pkg): confirm `auth/config/events/logger/observability` exist only under `libs/`, `contracts`/`ui` remain in `packages/`, and 0 `apps/*` source imports resolve to backend-only libs.
- [X] T040 [US4] Whole-backend conformance sweep (CHK-1..CHK-8): run `scripts/check-architecture.sh` at repo root, then `pnpm -r build && pnpm -r test`; confirm 0 legacy folders, 0 `*.repository.ts`, all loggers present, total passing specs ≥ baseline.

**Checkpoint**: Entire backend conforms; all builds/tests green.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T041 [P] Finalize `docs/backend-architecture.md` (FR-022): document the full convention incl. R1 (`database/`), R2 (extended `common/`), R4 (gateway no-entities), R5 (scheduling out of scope), so new modules are created in the standard shape unambiguously (SC-008).
- [X] T042 Run all quickstart.md validation scenarios (A–F) and record results.
- [X] T043 [P] Wire `scripts/check-architecture.sh` into CI / turbo pipeline so structural drift fails the build going forward.
- [X] T044 Final cleanup: remove any stray empty directories, dead imports, and unused `@finance/*` deps in service package.json files after the relocation; re-run `pnpm -r build && pnpm -r test`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: T001→T002→T003 sequential (move then install then verify); T004/T005 [P] after T003.
- **Foundational (P2)**: after Setup. Blocks Phase 3 (pilot is in api).
- **US1 (P3)**: after Foundational. MVP anatomy of accounts.
- **US2 (P4)**: after US1 (same accounts files — layering builds on the moved anatomy).
- **US3 (P5)**: after US2 (logs added to the finalized controller/service).
- **US4 (P6)**: after US3 (rollout replicates the proven pilot pattern). Internally: api modules T024–T027 are [P] across modules; T028 after them. banking-ms T029→T030→T031→T032. bff T033→T034/T035→T036. ai-ms T037→T038. Services are mutually [P]. T039/T040 after all service work.
- **Polish (P7)**: after US4.

### Within a module conversion

Anatomy (create dto/converters/entities + move entity/migration) → service fold (inject repository, delete custom repo) → controller flatten → delete legacy dirs → logging → verify.

### Parallel Opportunities

- Setup: T004, T005 in parallel.
- US4 api modules: T024 (cards), T025 (categories), T026 (transactions) in parallel — disjoint module folders.
- US4 across services: api / banking-ms / bff / ai-ms streams run in parallel by different developers.
- ai-ms T037 & T038 independent of everything else once Setup done.

---

## Parallel Example: US4 api modules

```bash
# Three disjoint api module conversions in parallel:
Task: "Convert services/api/src/modules/cards/ (T024)"
Task: "Convert services/api/src/modules/categories/ (T025)"
Task: "Convert services/api/src/modules/transactions/ (T026)"
```

---

## Implementation Strategy

### MVP First (Pilot module)

1. Setup (T001–T005) → 2. Foundational api scaffolding (T006–T008) → 3. US1 accounts anatomy → 4. US2 accounts layering → 5. US3 accounts logging → **STOP & VALIDATE accounts independently** (quickstart A–C). This is the reviewable proof of the whole convention.

### Incremental Delivery (Rollout)

After the pilot: convert remaining api modules, then banking-ms, bff, ai-ms — each independently testable and green at every step (FR-021). Verify package boundary + whole-backend conformance, then polish/CI-gate.

---

## Notes

- `@finance/*` package names are unchanged by the `libs/` move → consumer import specifiers do not change (R6); only the workspace glob + reinstall.
- No DB schema or HTTP API changes (Assumptions); migrations are moved, not edited.
- banking-ms scheduling is preserved as-is, NOT migrated to a convention (R5, FR-OOS-1).
- Commit after each task or module cluster; every commit must keep `pnpm -r build && pnpm -r test` green.
