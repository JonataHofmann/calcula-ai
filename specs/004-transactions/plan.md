# Implementation Plan: Transações

**Branch**: `004-transactions` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-transactions/spec.md`

## Summary

Cadastro de **Transações** financeiras (despesas/receitas) como um novo módulo de domínio na API-MS (Clean Architecture, modular monolith), agregado pelo BFF e consumido pela web Next.js. Uma transação tem descrição, vencimento, valor (decimal string), tipo (expense/income), recorrência (single/fixed/installment), status (pending/paid), categoria obrigatória e uma origem de valor exclusiva por tipo (despesa: conta **ou** cartão; receita: conta). Toda a lógica financeira — split de parcelas, materialização de fixas na efetivação, escopo de grupo — vive no domínio da API-MS (regra 6: BFF não tem regra financeira). O frontend apresenta a listagem em tabela **escopada por mês** (navegação entre meses), com filtros, busca e ordenação por cabeçalho, um grid superior opcional de **pendentes de meses anteriores**, e todos os formulários (criar/editar/efetivar) em **popup** (reutilizando o `Modal` do design system 002), com transições via `motion`. Datas persistidas em **UTC**; o frontend calcula "hoje"/fronteiras de mês pelo fuso do usuário.

## Technical Context

**Language/Version**: TypeScript 5.7; Node.js ≥ 20; React 19; Next.js 15 (App Router); NestJS 11

**Primary Dependencies**:
- Backend: NestJS 11, TypeORM (PostgreSQL 17), Zod (`@finance/contracts`), `@finance/auth` (guard/`AuthenticatedUser`), `@finance/logger`
- Frontend: TanStack Query (server state), Redux Toolkit (client state — modal aberto/draft/mês/filtros de UI), `motion`, React Hook Form + `@hookform/resolvers/zod`, Zod (via contracts), `lucide-react`

**Storage**: PostgreSQL 17 via TypeORM. Nova tabela única `transactions` (auto-agrupada por `group_id`). Referencia (sem FK física obrigatória, validação por use case escopada ao usuário) `categories`, `accounts`, `credit_cards`. Alterações via migration.

**Testing**: Jest (services/api — unit de use cases com fakes + integração de repositório env-gated `TEST_DATABASE_URL`; services/bff — proxy); Vitest + Testing Library (apps/web)

**Target Platform**: Web (browsers evergreen); dev local via docker compose (PostgreSQL 17 + Keycloak 26.1)

**Project Type**: Web app (Next.js) + modular monolith NestJS (API-MS) + BFF NestJS. Sem novos serviços.

**Performance Goals**: Registrar transação avulsa < 30s (SC-001); efetivar em ≤ 2 cliques com reflexo imediato (SC-003); listagem de um mês renderizada < 1s; popup animado ~200–300ms/60fps.

**Constraints**: `userId` só do JWT verificado (regra 2); `amount`/`effectiveAmount` = `numeric(18,2)` no banco e string decimal (`moneyAmountSchema`) no contrato — nunca float (regra 1); split de parcela e materialização de fixa só no domínio da API-MS (regra 6); entidades TypeORM nunca expostas como contrato HTTP (regra 9); escritas idempotentes com `Idempotency-Key` (regra 7); categoria/conta/cartão de outro usuário → 404 (FR-022); datas em UTC.

**Scale/Scope**: 1 módulo de domínio; ~7 use cases (create, list, list-overdue, update[scope], delete[scope], effectuate, get); 1 tabela nova; ~6 endpoints no BFF; 1 tela web (Transações) com tabela/filtros/mês/grid + 2 popups (form, efetivar) + 1 modal de escopo de grupo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` é template não preenchido — aplicam-se as regras não-negociáveis do `AGENTS.md`:

| Regra | Status |
|---|---|
| 1. Dinheiro DECIMAL/string, nunca float | PASS — `amount`/`effectiveAmount` via `moneyAmountSchema` (string) no contrato e `numeric(18,2)` no banco; split calculado em centavos inteiros |
| 2. `userId` só do JWT via `AuthenticatedUser`; toda query escopada | PASS — use cases recebem `userId` do guard; refs (categoria/conta/cartão) validadas por lookup escopado ao mesmo `userId` |
| 4. Clean Architecture nos módulos da API-MS | PASS — `domain/application/infrastructure/presentation`; regras de recorrência/efetivação testáveis sem Nest/PG |
| 5. Redux = client state; TanStack Query = server state | PASS — transações via TanStack Query; Redux só para UI (modal, mês selecionado, filtros locais, draft) |
| 6. BFF sem regras financeiras | PASS — split de parcela, geração de ocorrência fixa e efetivação vivem no domínio da API-MS; BFF só proxia e escopa por sessão |
| 7. Escritas com `Idempotency-Key`; atomicidade | PASS — create/effectuate/update/delete aceitam `Idempotency-Key`; geração das N parcelas em uma transação atômica |
| 8. Sem complexidade prematura (sem microserviços, sem BaseRepository) | PASS — modular monolith (ADR-002); um módulo `transactions`; repositório concreto próprio; lookups por porta, não BaseRepository |
| 9. Entidades TypeORM em `infrastructure/persistence/entities`, migrations | PASS — contrato HTTP separado em `@finance/contracts`; `toDto` sem `userId` |
| 10. Nunca logar segredos | PASS — sem dados sensíveis; nenhum PAN (cartão referenciado por id, `lastDigits` fica no módulo cards) |

**Pós-Phase 1**: PASS (ver reavaliação ao final). Cross-module read (transações validam categoria/conta/cartão de outros módulos via portas de lookup) → registrar ADR-012 na implementação.

## Project Structure

### Documentation (this feature)

```text
specs/004-transactions/
├── plan.md              # Este arquivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   └── transactions-api.md      # BFF /transactions CRUD + /overdue + /effectuate + escopo de grupo
├── checklists/
│   └── requirements.md
└── tasks.md             # Gerado por /speckit.tasks
```

### Source Code (repository root)

```text
packages/contracts/src/
├── transactions/
│   └── transaction.ts          # transactionType, recurrence, status, transactionSchema (DTO),
│                               #   createTransactionInput (discriminated union por recurrence),
│                               #   updateTransactionInput, effectuateInput, listTransactionsQuery,
│                               #   groupScope enum
└── index.ts                    # + re-export de transactions/transaction.js

services/api/src/modules/transactions/
├── domain/
│   ├── transaction.ts          # Transaction (agregado): invariantes de origem/tipo/valor/recorrência; effectuate()
│   ├── recurrence.ts           # helpers puros: splitInstallments(total|per,count), addMonthClamped(date), nextOccurrence()
│   ├── transaction.repository.ts  # porta: create/createMany/save/saveMany/findById/find(query)/findOverdue/findGroup/delete/deleteGroup
│   ├── lookups.ts              # portas CategoryLookup/AccountLookup/CardLookup (existência+tipo+dono)
│   └── errors.ts               # InvalidTransactionError, TransactionNotFoundError, AlreadyPaidError
├── application/use-cases/
│   ├── create-transaction/     # single/fixed → 1 linha; installment → N linhas (mesmo groupId)
│   ├── list-transactions/      # filtros + ordenação + intervalo dueDate (mês) — escopo do usuário
│   ├── list-overdue/           # status=pending & dueDate < :before
│   ├── update-transaction/     # escopo one|future|all (inclui pagas — clarificação)
│   ├── delete-transaction/     # escopo one|future|all (idempotente)
│   └── effectuate-transaction/ # pending→paid + effectiveDate/Amount; fixed gera próxima ocorrência
├── infrastructure/persistence/
│   ├── entities/transaction.entity.ts
│   ├── repositories/transaction.repository.ts
│   ├── lookups/{category,account,card}.lookup.ts   # implementam portas consultando as tabelas dos outros módulos (read-only, escopado)
│   └── migrations/1755600000000-create-transactions-table.ts
├── presentation/
│   └── transactions.controller.ts  # + HTTP wiring (ZodValidationPipe, CurrentUser)
└── transactions.module.ts

services/bff/src/transactions/
├── transactions.controller.ts  # → API-MS; escopo por sessão; repassa query/scope/Idempotency-Key
└── transactions.module.ts

apps/web/
├── app/(app)/transacoes/page.tsx        # nova rota → TransactionsView (+ item no sidebar navigation)
└── features/transactions/
    ├── transactions-api.ts              # chamadas ao BFF (credentials: 'include')
    ├── use-transactions.ts              # TanStack Query (list/overdue/create/update/delete/effectuate)
    ├── transactions-view.tsx            # layout: mês-navegador + grid de atrasados (toggle) + tabela + filtros
    ├── transactions-table.tsx           # tabela com ordenação por cabeçalho + ação Efetivar/editar/excluir
    ├── transactions-filters.tsx         # busca, intervalo, valor(like), recorrência, tipo, categoria, conta, cartão
    ├── transaction-form-modal.tsx       # RHF+Zod dentro do Modal (single/fixed/installment; origem por tipo)
    ├── effectuate-modal.tsx             # popup data(hoje)+valor(previsto) → confirmar
    └── group-scope-modal.tsx            # pergunta escopo (só esta / esta e futuras / todas)
```

**Structure Decision**: Reaproveita o monorepo (ADR-001). Toda regra de negócio de transações — origem exclusiva por tipo, valor > 0, split de parcelas com ajuste de centavos, materialização da ocorrência fixa na efetivação, escopo de grupo — fica na API-MS como módulo Clean Architecture independente (regra 4/6). O BFF apenas proxia, escopa por sessão e repassa query/headers (regra 6). As referências a categoria/conta/cartão são validadas por **portas de lookup** escopadas ao usuário (existência + coerência de tipo + dono), preservando fronteiras de módulo sem FK cross-módulo rígida. O frontend usa o `Modal` genérico (002) para os três popups e reaproveita os seletores de categoria/conta/cartão existentes; a tabela ordenável e a barra de filtros são específicas da feature (ficam em `apps/web/features/transactions`). Escopo mensal e cálculo de fronteiras de data ocorrem no cliente (fuso do usuário); a API recebe/entrega instantes UTC e filtra por intervalo `dueFrom`/`dueTo` que o frontend informa.

## Complexity Tracking

| Item | Justificativa | Alternativa rejeitada |
|---|---|---|
| Portas de lookup cross-módulo (Category/Account/Card) no módulo transactions | Validar dono + coerência de tipo da categoria e existência/dono da origem (FR-006/007/008/022) exige ler estado de outros módulos; portas mantêm o domínio testável e a fronteira explícita | FK físicas cross-módulo + join direto — acopla schema entre módulos e vaza detalhe de persistência para o domínio; injetar repositórios concretos de outros módulos — acopla a implementações, não a contratos |
| `createMany`/geração eager das N parcelas em uma escrita atômica | FR-011 exige gerar todas as linhas na criação com `groupId` comum e vencimentos mensais; atomicidade evita grupos parciais | Gerar parcelas sob demanda (lazy) — quebra FR-011 e a listagem/So­ma por mês; materializar via job — complexidade operacional desnecessária |
| Materialização lazy da fixa (ocorrência nasce só na efetivação) | Clarificação/Assumption: fixa mantém no máximo uma pendente por vez; evita pré-gerar séries infinitas | Pré-gerar X ocorrências futuras — arbitra horizonte, infla dados e diverge do pedido |
