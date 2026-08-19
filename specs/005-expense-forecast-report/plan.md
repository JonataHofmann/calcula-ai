# Implementation Plan: Relatório de Previsão de Despesas

**Branch**: `005-expense-forecast-report` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-expense-forecast-report/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Relatório tabular onde cada linha é um compromisso recorrente do usuário (grupo de `installment` ou uma despesa `fixed`) e cada coluna é um mês, começando no mês selecionado no filtro global de período. Um filtro de horizonte (1/3/6/12/24/36 meses) controla o número de colunas. Abordagem técnica: `installment` é consultado diretamente (todas as parcelas já existem como linhas no banco); `fixed` é projetado em memória para os meses futuros ainda não materializados, reaproveitando os helpers puros `addMonthClamped`/`nextOccurrence` já existentes no domínio de transações (ver `research.md`). Nenhuma nova entidade é persistida; um novo use-case e endpoint são adicionados ao módulo `transactions` já existente.

## Technical Context

**Language/Version**: TypeScript 5.7 (monorepo), Node.js >=22

**Primary Dependencies**: NestJS (backend), TypeORM (persistência), zod (`@finance/contracts`, schemas compartilhados), Next.js App Router + Redux Toolkit (frontend), Tailwind (`@finance/ui`)

**Storage**: PostgreSQL via TypeORM — nenhuma migration nova (relatório é derivado de dados de `transactions` já existentes, sem nova tabela)

**Testing**: Backend — Jest, arquivos `*.spec.ts` colocados ao lado do código (padrão já usado em `transactions/domain` e `transactions/application/use-cases`). Frontend — Vitest, arquivos `*.spec.tsx` colocados ao lado do componente (padrão já usado em `apps/web/features/transactions`)

**Target Platform**: Web (aplicação já existente, mesma stack)

**Project Type**: Web application monorepo (frontend `apps/web` + backend `services/api`, contratos compartilhados em `packages/contracts`)

**Performance Goals**: Consistente com o restante da aplicação — resposta do relatório deve ser percebida como instantânea (SC-001: total visível em <10s incluindo navegação, o que implica resposta de API na casa dos milissegundos para os volumes esperados de um usuário único)

**Constraints**: Não introduzir nova tabela/persistência; reaproveitar `TransactionRepository`/`recurrence.ts` existentes; valores monetários sempre em centavos internamente (`toCents`/`fromCents`), nunca float; escopo restrito a `type = despesa` e ao usuário autenticado

**Scale/Scope**: Um usuário por requisição; volume esperado = dezenas de compromissos recorrentes por usuário, horizonte máximo de 36 colunas — sem necessidade de paginação ou otimizações especiais

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` ainda é o template não preenchido do projeto (placeholders `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`, etc.) — não há princípios/gates ratificados para avaliar. Gate tratado como **passa por ausência de critérios formais**; nenhuma violação a justificar em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-expense-forecast-report/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── forecast.md      # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/contracts/src/transactions/
└── forecast.ts                     # NOVO: forecastQuerySchema, forecastResponseSchema, forecastRowSchema

services/api/src/modules/transactions/
├── domain/
│   └── recurrence.ts                # existente — reaproveitado (addMonthClamped, nextOccurrence, toCents/fromCents)
├── application/use-cases/
│   └── get-forecast/
│       ├── get-forecast.ts          # NOVO use-case (mesmo padrão de list-transactions.ts)
│       └── get-forecast.spec.ts     # NOVO
└── presentation/
    └── transactions.controller.ts   # editado — novo endpoint GET /transactions/forecast

apps/web/features/transactions/       # ou novo apps/web/features/forecast/, decisão de Fase 2 (tasks)
├── forecast-report.tsx               # NOVO componente de tabela
├── forecast-report.spec.tsx          # NOVO
├── forecast-api.ts                   # NOVO (segue padrão de transactions-api.ts: apiFetch + withQuery)
└── forecast-horizon-filter.tsx       # NOVO componente do filtro 1/3/6/12/24/36
```

**Structure Decision**: Feature adiciona-se inteiramente dentro do módulo `transactions` já existente (backend) e da área de transações do frontend, sem criar módulo novo — não há hoje nenhum outro relatório/agregação que justifique um módulo `reports` separado (ver `research.md`, Decision 3). A decisão final entre reaproveitar `apps/web/features/transactions/` ou criar `apps/web/features/forecast/` fica para o detalhamento em `/speckit.tasks`, guiada por onde o link/rota do relatório for exposto na navegação.

## Complexity Tracking

*Nenhuma violação — tabela não aplicável (constitution é template vazio, nenhum gate formal violado).*
