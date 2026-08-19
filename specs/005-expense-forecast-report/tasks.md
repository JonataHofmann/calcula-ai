---

description: "Task list for Relatório de Previsão de Despesas"
---

# Tasks: Relatório de Previsão de Despesas

**Input**: Design documents from `/specs/005-expense-forecast-report/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/forecast.md, quickstart.md

**Tests**: Included — this repo's existing convention colocates a `.spec.ts`/`.spec.tsx` next to every use case and component (e.g. `recurrence.spec.ts`, `list-transactions.spec.ts`, `effectuate-modal.spec.tsx`); tasks below follow that established pattern rather than skipping tests.

**Organization**: Tasks are grouped by user story (US1 = P1, US2 = P2) per spec.md, so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to US1 or US2 from spec.md
- File paths are exact, relative to repo root

## Path Conventions (from plan.md Project Structure)

- Contracts: `packages/contracts/src/transactions/`
- Backend: `services/api/src/modules/transactions/`
- Frontend: `apps/web/features/transactions/`, `apps/web/app/(app)/`, `apps/web/features/navigation/`

---

## Phase 1: Setup

**Purpose**: Shared contract schema — no new dependencies/tooling needed, this is an existing monorepo.

- [X] T001 Create `packages/contracts/src/transactions/forecast.ts` with `forecastQuerySchema`, `forecastRowSchema`, `forecastResponseSchema` per `contracts/forecast.md` (reuse `moneyAmountSchema` from `./transaction.ts` for `amount` fields)
- [X] T002 Export the new schemas/types from `packages/contracts/src/transactions/index.ts` (or equivalent barrel) and confirm they surface through `packages/contracts/src/index.ts`

**Checkpoint**: `@finance/contracts` builds and exports `ForecastQuery`/`ForecastResponse` types consumable by both backend and frontend.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nothing beyond the shared contract schemas (Phase 1) blocks both stories — the backend aggregation logic itself belongs entirely to US1 (see Structure Decision in plan.md: US2 adds no backend behavior, only a frontend filter over the same endpoint). No additional foundational tasks are required.

**Checkpoint**: Foundation ready — proceed to Phase 3 (US1).

---

## Phase 3: User Story 1 - Visualizar previsão de despesas por mês (Priority: P1) 🎯 MVP

**Goal**: Tabela com uma linha por parcelamento/despesa fixa e uma coluna por mês (a partir do mês do filtro global), com "-" onde o compromisso não se aplica, e uma linha de total.

**Independent Test**: Com parcelamentos e despesas fixas cadastrados, abrir o relatório (horizonte padrão fixo, ex. chamando a API diretamente com `months` fixo) e verificar linhas/colunas/total conforme `quickstart.md` § "Validar US1".

### Tests for User Story 1 ⚠️

> Write these first, confirm they fail before implementation.

- [X] T003 [P] [US1] Unit tests for `GetForecastUseCase` in `services/api/src/modules/transactions/application/use-cases/get-forecast/get-forecast.spec.ts` covering: (a) `installment` cells populated only within the group's parcel range, (b) `fixed` cells projected beyond the single persisted pending row using `addMonthClamped`/`nextOccurrence`, (c) `fixed` with `endDate` yields `null` cells after termination, (d) `type = receita` excluded, (e) `recurrence = single` excluded, (f) rows/values scoped strictly to `userId` (no cross-user leakage), (g) empty result when user has no `installment`/`fixed` expenses, (h) totals row sums non-null cells per month
- [X] T004 [P] [US1] Component tests for the report table in `apps/web/features/transactions/forecast-report.spec.tsx` covering: renders one row per API row with correct label (`"carro (36x)"`, `"aluguel (fixa)"`), renders `"-"` for `null` cells, renders BR-formatted totals row, renders the empty-state message when `rows` is empty

### Implementation for User Story 1

- [X] T005 [US1] Implement `GetForecastUseCase.execute(userId, query: ForecastQuery)` in `services/api/src/modules/transactions/application/use-cases/get-forecast/get-forecast.ts` (mirrors `list-transactions.ts`'s constructor/DI pattern): resolve the month list from `query.from`/`query.months`; fetch `installment` groups via existing `TransactionRepository` methods (date-range/group query) and map each parcel to its month column; fetch each open `fixed` transaction and project forward with `addMonthClamped`/`nextOccurrence` from `recurrence.ts` for months beyond the last persisted occurrence, honoring `endDate`; build `rows` (grouped/keyed by `groupId`) and a `totals` row summing non-null cells per month, all money handled via `toCents`/`fromCents` (never float)
- [X] T006 [US1] Add `GET /transactions/forecast` endpoint to `services/api/src/modules/transactions/presentation/transactions.controller.ts`: validate query with `forecastQuerySchema`, call `GetForecastUseCase` with the authenticated `userId`, map result to `ForecastResponse` DTO (depends on T005)
- [X] T007 [P] [US1] Register `GetForecastUseCase` as a provider in `services/api/src/modules/transactions/transactions.module.ts`
- [X] T008 [P] [US1] Implement `getForecast(query: ForecastQuery)` in new `apps/web/features/transactions/forecast-api.ts`, following the existing `apiFetch` + `withQuery` convention from `transactions-api.ts`
- [X] T009 [US1] Implement `forecast-report.tsx` in `apps/web/features/transactions/forecast-report.tsx`: table rendering `months` as columns, `rows` with description/installment-count label, `"-"` for null cells, BR money formatting (`1.000,00`), a totals row, and an empty state per FR-011 (depends on T008)
- [X] T010 [US1] Create route `apps/web/app/(app)/previsao-despesas/page.tsx` rendering `forecast-report.tsx`, reading the current month from the global period store (`apps/web/store/period-slice.ts`) to build the `from` (`YYYY-MM`) param, with a fixed/default `months` value for this story (depends on T009)
- [X] T011 [P] [US1] Add `{ label: 'Previsão de Despesas', href: '/previsao-despesas', icon: ... }` entry to `NAV_ITEMS` in `apps/web/features/navigation/nav-items.ts` (pick an unused `lucide-react` icon, e.g. `TrendingDown` or `CalendarRange`)

**Checkpoint**: User Story 1 fully functional and independently testable — table renders real installment/fixed data with correct month columns and totals.

---

## Phase 4: User Story 2 - Selecionar o horizonte de meses (Priority: P2)

**Goal**: Filtro com as opções 1/3/6/12/24/36 controlando o número de colunas exibidas, preservado ao trocar o mês do filtro global.

**Independent Test**: Abrir o relatório, trocar o horizonte entre as opções e confirmar que o número de colunas muda mantendo o mês 1; mudar o filtro global de mês e confirmar que o mês 1 muda preservando o horizonte já escolhido (per `quickstart.md` § "Validar US2").

### Tests for User Story 2 ⚠️

- [X] T012 [P] [US2] Component tests for the horizon filter in `apps/web/features/transactions/forecast-horizon-filter.spec.tsx` covering: exactly the options 1/3/6/12/24/36 are rendered, selecting an option calls the change handler with that value, the currently selected value is reflected in the UI
- [X] T013 [P] [US2] Integration test in `forecast-report.spec.tsx` (extend T004's file) covering: changing the horizon selection re-requests the report with the new `months` value while keeping `from` unchanged, and changing the global period's month re-requests with a new `from` while keeping `months` unchanged

### Implementation for User Story 2

- [X] T014 [P] [US2] Implement `forecast-horizon-filter.tsx` in `apps/web/features/transactions/forecast-horizon-filter.tsx`: a select/segmented control with exactly the options 1, 3, 6, 12, 24, 36
- [X] T015 [US2] Wire `forecast-horizon-filter.tsx` into `apps/web/app/(app)/previsao-despesas/page.tsx`, holding the selected horizon in local/session component state (not persisted server-side, per spec.md Assumptions), replacing T010's fixed default `months` value, and recomputing `from` reactively whenever the global period store's month changes while keeping the selected horizon (depends on T010, T014)

**Checkpoint**: User Stories 1 and 2 both work independently and together — horizon changes and global period changes each update the correct part of the table without a full reload (SC-002).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across both stories.

- [X] T016 [P] Verify Brazilian money formatting (`1.000,00`) and empty-state copy against FR-012/FR-011 across all cells and the totals row
- [X] T017 Run `specs/005-expense-forecast-report/quickstart.md` end-to-end validation manually (both US1 and US2 sections, including the cross-user isolation check and the empty-state check)
- [X] T018 [P] Run `pnpm --filter api test`, `pnpm --filter web test`, `pnpm --filter web typecheck`, `pnpm --filter api typecheck` and fix any failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Empty (see note above) — does not block anything beyond Setup
- **US1 (Phase 3)**: Depends on Setup (T001–T002) for the contract schemas
- **US2 (Phase 4)**: Depends on US1's page/component existing (T009, T010) since the horizon filter is embedded into the same page — not independently deployable before US1, but independently testable once US1's table renders
- **Polish (Phase 5)**: Depends on both US1 and US2 being complete

### Within Each Story

- Tests (T003/T004, T012/T013) before their corresponding implementation tasks; confirm they fail first
- Backend use-case (T005) before controller endpoint (T006) before module registration ordering (T007 can run parallel to T006 since different file)
- `forecast-api.ts` (T008) before `forecast-report.tsx` (T009) before route wiring (T010) before nav entry (T011, parallel-safe)

### Parallel Opportunities

- T001 and T002 are sequential (T002 depends on T001's file existing) — not parallel
- T003 and T004 (tests, different files/layers) — parallel
- T007 (module registration) can run parallel to T006 (controller) once T005 exists — different files
- T008 (frontend API) can start parallel to T005/T006/T007 (backend) since the contract schema (T001/T002) is the only shared dependency
- T011 (nav entry) parallel to T009/T010 — different file
- T012 and T013 (US2 tests) — parallel
- T014 (horizon filter component) parallel to T012/T013 tests before it, and parallel to any remaining US1 polish
- T016 and T018 in Polish — parallel; T017 is manual and sequential

---

## Parallel Example: User Story 1

```bash
# After T001–T002 (contracts) are done, launch in parallel:
Task: "Unit tests for GetForecastUseCase in services/api/.../get-forecast.spec.ts"
Task: "Component tests for forecast-report.tsx in apps/web/.../forecast-report.spec.tsx"
Task: "Implement getForecast in apps/web/features/transactions/forecast-api.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Phase 2: Foundational — nothing to do, proceed directly
3. Complete Phase 3: User Story 1 (T003–T011)
4. **STOP and VALIDATE**: run `quickstart.md` § "Validar US1" independently (backend can be exercised with a fixed `months` value even without the UI filter)
5. Demo the table with a fixed horizon — this is already the core value requested

### Incremental Delivery

1. Setup → Foundation ready (no foundational work needed)
2. Add US1 → validate independently → this is the MVP
3. Add US2 → validate independently (horizon switching + global period reactivity) → full feature complete
4. Phase 5 polish and full test/typecheck sweep

---

## Notes

- [P] tasks touch different files with no unmet dependencies
- [Story] label traces every task back to spec.md's US1/US2
- Money is always centavos internally (`toCents`/`fromCents`) — never float arithmetic, per constraint in plan.md
- No new persisted entity or migration in any task — everything is derived at request time (see data-model.md)
- Commit after each task or logical group; stop at each Checkpoint to validate independently
