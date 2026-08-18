---
description: "Task list — Transações"
---

# Tasks: Transações

**Input**: Design documents from `/specs/004-transactions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUÍDOS — a Definition of Done do `AGENTS.md` exige unit (use cases com fakes + domínio puro), integração (repositórios TypeORM env-gated `TEST_DATABASE_URL`) e testes de componentes (Vitest).

**Organization**: Tarefas agrupadas por user story (US1 CRUD avulsa P1, US2 Efetivar P2, US3 Recorrência+escopo P3, US4 Filtros/ordem/mês P4, US5 Atrasados P5), cada uma implementável e testável de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos distintos, sem dependência de tarefa incompleta)
- Caminhos relativos à raiz do monorepo. Backend = `services/api`, `services/bff`; shared = `packages/*`; web = `apps/web`.

## Convenções do repo (AGENTS.md)

- Clean Architecture na API-MS: `domain → application → infrastructure → presentation`.
- `userId` só do JWT (`AuthenticatedUser`); toda query escopada; recurso de outro usuário → `404`.
- Dinheiro DECIMAL/string (`moneyAmountSchema`); entidades TypeORM nunca viram contrato HTTP; schema via migration.
- Toda regra financeira (split, materialização, escopo) na API-MS; BFF só proxia/escopa/repassa `Idempotency-Key`. Frontend: RHF+Zod, TanStack Query = server state, Redux só UI.
- Datas persistidas em UTC; fronteiras de mês/hoje calculadas no frontend (fuso do usuário).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Contrato base e dependências.

- [X] T001 Criar `packages/contracts/src/transactions/transaction.ts` com enums (`transactionTypeSchema` `expense|income`, `recurrenceSchema` `single|fixed|installment` default `single`, `transactionStatusSchema` `pending|paid` default `pending`, `groupScopeSchema` `one|future|all`) e `transactionSchema` (DTO sem `userId`: id, description, dueDate, amount, effectiveAmount, recurrence, effectiveDate, type, notes, status, endDate, installmentCount, installmentNumber, groupId, categoryId, accountId, creditCardId — money via `moneyAmountSchema`); re-exportar em `packages/contracts/src/index.ts` (imports `.js`).
- [X] T002 [P] Confirmar deps presentes (`motion`, `react-hook-form`, `@hookform/resolvers` em `apps/web/package.json`); instalar se faltarem e rodar `pnpm install`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domínio, persistência, wiring e esqueletos compartilhados por TODAS as stories.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase.

- [X] T003 Completar schemas de input em `packages/contracts/src/transactions/transaction.ts`: `createTransactionInput` (união discriminada por `recurrence`: single, fixed com `endDate?`, installment com `installmentCount` + XOR `amount`/`totalAmount`), `superRefine` de origem por tipo (expense = XOR account/card; income = account, sem card), `updateTransactionInput` (campos editáveis parciais, sem status/effectiveDate/effectiveAmount/installmentNumber/groupId), `effectuateInput` (`date?`, `amount?`), `listTransactionsQuery` (dueFrom, dueTo, search, amount, recurrence, type, categoryId, accountId, creditCardId, sort, order), `overdueQuery` (`before`).
- [X] T004 [P] Domínio: helpers puros em `services/api/src/modules/transactions/domain/recurrence.ts` (`toCents`/`fromCents`, `splitInstallments(totalOrPerCents, count)` com ajuste na última parcela, `addMonthClamped(date, n)` com clamp de fim de mês, `nextOccurrence(dueDate, endDate?)`).
- [X] T005 [P] Domínio: erros em `services/api/src/modules/transactions/domain/errors.ts` (`InvalidTransactionError`, `TransactionNotFoundError`, `AlreadyPaidError`).
- [X] T006 Domínio: agregado em `services/api/src/modules/transactions/domain/transaction.ts` (`create`/`restore`/`update`/`effectuate`; invariantes de valor>0, origem por tipo, recorrência, categoria coerente; `effectuate` seta status/effectiveDate/effectiveAmount e bloqueia já-pago) — depende de T004, T005.
- [X] T007 [P] Domínio: portas em `services/api/src/modules/transactions/domain/transaction.repository.ts` (`TRANSACTION_REPOSITORY` symbol; create, createMany, save, saveMany, findById, find(query), findOverdue, findGroup, delete, deleteGroup — todas escopadas por `userId`) e `domain/lookups.ts` (`CategoryLookup`/`AccountLookup`/`CardLookup` symbols + interfaces existência+dono+tipo).
- [X] T008 [P] Infra: entidade em `services/api/src/modules/transactions/infrastructure/persistence/entities/transaction.entity.ts` (`@Entity('transactions')`, colunas snake_case, `numeric(18,2)` para amount/effectiveAmount, `timestamptz` para datas, índices user_id / user+due / user+status+due / group).
- [X] T009 Infra: migration `services/api/src/modules/transactions/infrastructure/persistence/migrations/1755600000000-create-transactions-table.ts` (cria tabela, índices e `CHECK`s de origem por tipo/valor>0/recorrência — defesa em profundidade).
- [X] T010 Infra: implementação do repositório em `services/api/src/modules/transactions/infrastructure/persistence/repositories/transaction.repository.ts` (todos os métodos da porta; `createMany`/`deleteGroup` atômicos; `find` monta filtros/ordenação; `findOverdue` status=pending & due<before) — depende de T007, T008.
- [X] T011 [P] Infra: lookups em `services/api/src/modules/transactions/infrastructure/persistence/lookups/{category,account,card}.lookup.ts` (consultam `categories`/`accounts`/`credit_cards`, read-only, escopo `userId`; falha → tratada como 404) — depende de T007.
- [X] T012 Presentation + module: `services/api/src/modules/transactions/presentation/transactions.controller.ts` (esqueleto com `@CurrentUser`, `ZodValidationPipe`, `toDto()` sem userId) e `services/api/src/modules/transactions/transactions.module.ts` (providers: repo, lookups, use cases); registrar em `services/api/src/app.module.ts` — depende de T006, T010, T011.
- [X] T013 [P] BFF: `services/bff/src/transactions/transactions.module.ts` + `transactions.controller.ts` (esqueleto proxy via `ApiClient`, `tokenOf(req)`, repassa query/`scope`/`Idempotency-Key`); registrar em `services/bff/src/app.module.ts`.
- [X] T014 [P] Web: esqueleto da feature — `apps/web/features/transactions/transactions-api.ts` (fetch ao BFF, `credentials: 'include'`), `apps/web/features/transactions/use-transactions.ts` (hooks TanStack Query), `apps/web/app/(app)/transacoes/page.tsx` (rota → `TransactionsView`), item no sidebar navigation, `apps/web/features/transactions/transactions-view.tsx` (shell do layout).
- [X] T015 [P] Testes de domínio (Jest) em `services/api/src/modules/transactions/domain/*.spec.ts`: `recurrence.spec.ts` (split fecha soma, clamp de mês) e `transaction.spec.ts` (invariantes de origem/valor/recorrência, `effectuate` bloqueia pago).

**Checkpoint**: domínio + persistência + wiring prontos — stories podem começar.

---

## Phase 3: User Story 1 — CRUD de transação avulsa (Priority: P1) 🎯 MVP

**Goal**: Criar/listar/editar/excluir transação `single` (despesa com conta OU cartão; receita com conta) via popup, com escopo por usuário.

**Independent Test**: Criar despesa `single` com conta pelo popup, ver na tabela do mês, editar, excluir; despesa com cartão aceita; sem/ambas origens recusada; transação de outro usuário → 404. (Cenário 1 do quickstart.)

### Tests for User Story 1 ⚠️

- [X] T016 [P] [US1] Unit dos use cases (fakes de repo/lookups) em `services/api/src/modules/transactions/application/use-cases/{create-transaction,list-transactions,update-transaction,delete-transaction,get-transaction}/*.spec.ts` (single: create/list mês/update/delete; isolamento por usuário → 404).
- [X] T017 [P] [US1] Teste de proxy do BFF em `services/bff/src/transactions/transactions.controller.spec.ts` (repassa body/headers, escopa por sessão).
- [X] T018 [P] [US1] Componentes web (Vitest) em `apps/web/features/transactions/transaction-form-modal.spec.tsx` (origem por tipo) e `transactions-table.spec.tsx` (render + ações editar/excluir).

### Implementation for User Story 1

- [X] T019 [US1] Use case create (single) em `services/api/src/modules/transactions/application/use-cases/create-transaction/create-transaction.ts` (valida via lookups; `groupId` null; 1 linha).
- [X] T020 [P] [US1] Use case list (mês, escopo do usuário) em `application/use-cases/list-transactions/list-transactions.ts` (intervalo `dueFrom`/`dueTo`).
- [X] T021 [P] [US1] Use cases get/update/delete (sem grupo) em `application/use-cases/{get-transaction,update-transaction,delete-transaction}/*.ts` (escopo por usuário; not found → 404).
- [X] T022 [US1] Endpoints no controller `presentation/transactions.controller.ts`: `POST /transactions`, `GET /transactions`, `GET /transactions/:id`, `PATCH /transactions/:id`, `DELETE /transactions/:id` (204) — wiring dos use cases T019–T021.
- [X] T023 [US1] Endpoints proxy no BFF `services/bff/src/transactions/transactions.controller.ts` (POST/GET/GET:id/PATCH/DELETE) repassando `Idempotency-Key`.
- [X] T024 [US1] Web: `apps/web/features/transactions/transaction-form-modal.tsx` (RHF+Zod dentro do `Modal`; campos single; origem por tipo reutilizando seletores de conta/cartão/categoria) + hooks create/update/delete em `use-transactions.ts`.
- [X] T025 [US1] Web: `apps/web/features/transactions/transactions-table.tsx` (colunas + ações editar/excluir) integrada em `transactions-view.tsx` (lista do mês corrente).

**Checkpoint**: US1 funcional e testável — MVP entregável.

---

## Phase 4: User Story 2 — Efetivar pendente (Priority: P2)

**Goal**: Botão Efetivar → popup (data=hoje, valor=previsto) → `paid` com `effectiveDate`/`effectiveAmount`; efetivar pago é bloqueado.

**Independent Test**: Efetivar `single` pendente com defaults → `paid`; alterar valor preserva previsto; reefetivar bloqueado. (Cenário 2 do quickstart.)

### Tests for User Story 2 ⚠️

- [X] T026 [P] [US2] Unit do use case em `services/api/src/modules/transactions/application/use-cases/effectuate-transaction/effectuate-transaction.spec.ts` (pending→paid; preserva `amount`; `AlreadyPaidError`).
- [X] T027 [P] [US2] Componente web em `apps/web/features/transactions/effectuate-modal.spec.tsx` (defaults hoje/previsto).

### Implementation for User Story 2

- [X] T028 [US2] Use case em `application/use-cases/effectuate-transaction/effectuate-transaction.ts` (single/installment: seta status/effectiveDate/effectiveAmount; bloqueia pago).
- [X] T029 [US2] Endpoint `POST /transactions/:id/effectuate` no controller (retorna `{ transaction, next: null }`) + proxy no BFF.
- [X] T030 [US2] Web: `apps/web/features/transactions/effectuate-modal.tsx` (popup data+valor) + botão Efetivar na tabela + hook effectuate em `use-transactions.ts`.

**Checkpoint**: US1 + US2 funcionais independentemente.

---

## Phase 5: User Story 3 — Recorrência parcelada/fixa e escopo de grupo (Priority: P3)

**Goal**: Parcelada gera N linhas (split de centavos, mesmo `groupId`); fixa materializa próxima ocorrência na efetivação (respeita `endDate`); editar/excluir ocorrência de grupo pergunta escopo (one/future/all, inclui pagas).

**Independent Test**: Criar parcelada 3x → 3 linhas com soma = total; criar fixa → efetivar gera próxima pendente; editar/excluir grupo aplica ao escopo escolhido incluindo pagas. (Cenários 3, 4, 5 do quickstart.)

### Tests for User Story 3 ⚠️

- [X] T031 [P] [US3] Unit em `application/use-cases/create-transaction/create-transaction.installment.spec.ts` (N linhas, installmentNumber, vencimentos mensais, soma fecha) e `create-transaction.fixed.spec.ts` (1 linha + groupId).
- [X] T032 [P] [US3] Unit em `application/use-cases/effectuate-transaction/effectuate-transaction.fixed.spec.ts` (gera próxima; respeita `endDate`).
- [X] T033 [P] [US3] Unit de escopo em `application/use-cases/{update-transaction,delete-transaction}/*.scope.spec.ts` (one/future/all; inclui pagas; delete de grupo idempotente).
- [X] T034 [P] [US3] Integração de repositório (env-gated) em `services/api/src/modules/transactions/infrastructure/persistence/repositories/transaction.repository.int.spec.ts` (`createMany` atômico, `findGroup`, `deleteGroup` idempotente).
- [X] T035 [P] [US3] Componente web em `apps/web/features/transactions/group-scope-modal.spec.tsx`.

### Implementation for User Story 3

- [X] T036 [US3] Estender create use case (`create-transaction.ts`): installment (`splitInstallments` + `createMany` N linhas, `groupId`) e fixed (1 linha + `groupId`).
- [X] T037 [US3] Estender effectuate use case (`effectuate-transaction.ts`): fixed gera próxima ocorrência atômica (`nextOccurrence`, respeita `endDate`); resposta inclui `next`.
- [X] T038 [US3] Escopo em update/delete use cases: `scope` one/future/all sobre `groupId` (inclui pagas; update preserva campos de efetivação das pagas; delete idempotente) — usa `findGroup`/`saveMany`/`deleteGroup`.
- [X] T039 [US3] Controller: `scope` (query) em `PATCH`/`DELETE`; `POST` retorna `{ transactions: [] }` (N para installment); `effectuate` retorna `next`; BFF repassa `scope`.
- [X] T040 [US3] Web: campos de recorrência no `transaction-form-modal.tsx` (installment: count + `amount`↔`totalAmount`; fixed: `endDate?`) + `apps/web/features/transactions/group-scope-modal.tsx` acionado ao editar/excluir ocorrência de grupo.

**Checkpoint**: US1–US3 funcionais independentemente.

---

## Phase 6: User Story 4 — Filtrar, buscar e ordenar por mês (Priority: P4)

**Goal**: Listagem escopada por mês com navegação anterior/próximo; filtros (busca, intervalo, valor "contém", recorrência, tipo, categoria, conta, cartão); ordenação por cabeçalho.

**Independent Test**: Navegar entre meses; aplicar filtros isolados/combinados; alternar ordenação por coluna. (Cenário 6 do quickstart.)

### Tests for User Story 4 ⚠️

- [X] T041 [P] [US4] Integração de repositório (env-gated) em `transaction.repository.filters.int.spec.ts` (search/amount-like/recurrence/type/refs; sort asc/desc; intervalo de mês).
- [X] T042 [P] [US4] Componentes web em `apps/web/features/transactions/transactions-filters.spec.tsx` e `transactions-table.sort.spec.tsx` (ordenação por cabeçalho).

### Implementation for User Story 4

- [X] T043 [US4] Estender `find` do repositório + list use case: `search` (ILIKE description/notes/amount::text), `amount` (ILIKE amount::text), `recurrence`, `type`, `categoryId`, `accountId`, `creditCardId`, `sort`, `order`.
- [X] T044 [US4] Controller `GET /transactions`: mapear `listTransactionsQuery` (ZodValidationPipe na query); BFF repassa todos os params.
- [X] T045 [P] [US4] Web: `apps/web/features/transactions/transactions-filters.tsx` (barra de filtros) + navegação de mês em `transactions-view.tsx` (calcula `dueFrom`/`dueTo` no fuso do usuário).
- [X] T046 [P] [US4] Web: ordenação por cabeçalho em `transactions-table.tsx` + slice Redux de UI (`apps/web/features/transactions/transactions-ui.slice.ts`: mês, filtros, ordenação).

**Checkpoint**: US1–US4 funcionais independentemente.

---

## Phase 7: User Story 5 — Pendentes de meses anteriores (Priority: P5)

**Goal**: Toggle "mostrar pendentes de meses anteriores" → grid acima com não-pagas vencidas antes do mês corrente; some ao efetivar.

**Independent Test**: Pendente vencida em mês anterior aparece ao ativar; efetivar remove; sem atrasados → estado vazio. (Cenário 7 do quickstart.)

### Tests for User Story 5 ⚠️

- [X] T047 [P] [US5] Unit do use case em `application/use-cases/list-overdue/list-overdue.spec.ts` (status=pending & due<before; escopo do usuário).
- [X] T048 [P] [US5] Componente web em `apps/web/features/transactions/overdue-grid.spec.tsx` (lista + estado vazio).

### Implementation for User Story 5

- [X] T049 [US5] Use case `application/use-cases/list-overdue/list-overdue.ts` + `findOverdue` no repositório (já na porta) + `GET /transactions/overdue?before=` no controller e proxy no BFF.
- [X] T050 [US5] Web: `apps/web/features/transactions/overdue-grid.tsx` + toggle em `transactions-view.tsx` (calcula `before` = início do mês corrente no fuso do usuário) + hook overdue em `use-transactions.ts` + flag no slice de UI.

**Checkpoint**: todas as user stories funcionais independentemente.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T051 [P] Registrar **ADR-012** (cross-module read via portas de lookup) em `docs/adr/`.
- [X] T052 [P] Polir animações/`motion` dos popups (~200–300ms, `prefers-reduced-motion`) e transições de lista.
- [X] T053 Rodar validação do `quickstart.md` (cenários 1–8) end-to-end.
- [X] T054 [P] `pnpm lint` + `pnpm typecheck` + `pnpm test` verdes em contracts/api/bff/web.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — BLOQUEIA todas as stories.
- **User Stories (Phase 3–7)**: dependem da Foundational. US1 é MVP; US2–US5 podem seguir em paralelo (times distintos) ou em ordem de prioridade. US2/US3 tocam o mesmo agregado/effectuate — sequenciar US2 antes de US3 evita conflito no mesmo arquivo.
- **Polish (Phase 8)**: depois das stories desejadas.

### User Story Dependencies

- **US1 (P1)**: após Foundational. Sem dependência de outras stories.
- **US2 (P2)**: após Foundational. Independente (usa dados de US1 em teste, mas testável isolada).
- **US3 (P3)**: após Foundational. Estende create/effectuate — coordenar com US2 (mesmo arquivo `effectuate-transaction.ts`).
- **US4 (P4)**: após Foundational. Estende `find`/list — independente de US2/US3.
- **US5 (P5)**: após Foundational. Independente.

### Within Each User Story

- Testes primeiro (devem falhar antes da implementação).
- Domínio → use case → controller → BFF → web.

### Parallel Opportunities

- Setup: T002 [P].
- Foundational: T004/T005/T007/T008/T011/T013/T014/T015 [P] (arquivos distintos) após suas dependências.
- Dentro de cada story, tarefas [P] (testes, use cases em arquivos distintos, componentes web) rodam juntas.
- Após a Foundational, US1, US4 e US5 podem ser tocadas por devs distintos em paralelo.

---

## Parallel Example: User Story 1

```bash
# Testes US1 juntos:
Task: "Unit dos use cases em application/use-cases/*/*.spec.ts"
Task: "Proxy BFF em services/bff/src/transactions/transactions.controller.spec.ts"
Task: "Componentes web em features/transactions/{transaction-form-modal,transactions-table}.spec.tsx"

# Use cases US1 em paralelo (arquivos distintos):
Task: "list-transactions.ts"
Task: "get/update/delete-transaction.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRÍTICO) → 3. Phase 3 US1 → 4. **VALIDAR** US1 isolada → 5. Deploy/demo.

### Incremental Delivery

Foundational → US1 (MVP) → US2 → US3 → US4 → US5, cada uma testada e entregue sem quebrar as anteriores.

---

## Notes

- [P] = arquivos distintos, sem dependência incompleta.
- Regra financeira só na API-MS (regra 6); BFF nunca calcula split/escopo.
- Money sempre string (`moneyAmountSchema`); `userId` só do JWT; recurso de outro usuário → 404.
- Verificar que os testes falham antes de implementar; commit por tarefa ou grupo lógico.
