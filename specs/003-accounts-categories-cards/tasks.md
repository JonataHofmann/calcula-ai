---
description: "Task list — Cadastros (Contas, Categorias, Cartões de Crédito)"
---

# Tasks: Cadastros — Contas, Categorias e Cartões de Crédito

**Input**: Design documents from `/specs/003-accounts-categories-cards/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUÍDOS — a Definition of Done do `AGENTS.md` exige unit (use cases com fakes), integração (repositórios TypeORM) e testes de componentes.

**Organization**: Tarefas agrupadas por user story (US1 Contas P1, US2 Categorias P2, US3 Cartões P3), cada uma implementável e testável de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos distintos, sem dependência de tarefa incompleta)
- Caminhos são relativos à raiz do monorepo. Backend = `services/api`, `services/bff`; shared = `packages/*`; web = `apps/web`.

## Convenções do repo (AGENTS.md)

- Clean Architecture nos módulos da API-MS: `domain → application → infrastructure → presentation`.
- `userId` só do JWT (`AuthenticatedUser`); toda query escopada; recurso de outro usuário → `404`.
- Dinheiro DECIMAL/string (`moneySchema`); entidades TypeORM nunca viram contrato HTTP; schema via migration.
- BFF só agrega/molda contrato; escritas aceitam `Idempotency-Key`. Frontend: RHF+Zod, TanStack Query = server state, Redux só UI.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependências e dados de referência compartilhados.

- [X] T001 Adicionar dependências: `motion` em `apps/web/package.json` e `packages/ui/package.json`; `react-hook-form` + `@hookform/resolvers` em `apps/web/package.json`; rodar `pnpm install`.
- [X] T002 [P] Criar catálogos estáticos + schemas Zod de referência em `packages/contracts/src/reference/bank.ts` (`bankSchema` + `BANKS`), `brand.ts` (`brandSchema` + `CARD_BRANDS`), `icon.ts` (`iconKeySchema` + `ICONS`), `color.ts` (`colorTokenSchema` + `COLORS`); re-exportar em `packages/contracts/src/index.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Componentes genéricos e endpoints de referência usados por TODAS as stories.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase.

- [X] T003 [P] Componente `Modal` genérico animado em `packages/ui/src/components/modal.tsx` (overlay, trap de foco, fechar em `Esc`/backdrop, entrada/saída via `AnimatePresence` do `motion`, respeitar `prefers-reduced-motion`); exportar em `packages/ui/src/index.ts`.
- [X] T004 [P] `IconPicker` em `packages/ui/src/components/icon-picker.tsx` (grade de ícones `lucide-react` a partir de `ICONS` + busca; `value`/`onChange` retorna `iconKey`).
- [X] T005 [P] `ColorPicker` em `packages/ui/src/components/color-picker.tsx` (paleta a partir de `COLORS`; retorna `colorToken`).
- [X] T006 [P] `BankSelect` em `packages/ui/src/components/bank-select.tsx` (seleção a partir de `BANKS`, exibe nome + logo/cor; retorna `bankId`).
- [X] T007 BFF: módulo de referência em `services/bff/src/reference/reference.module.ts` + `reference.controller.ts` servindo `GET /reference/{banks,brands,icons,colors}` a partir de `@finance/contracts`; registrar em `services/bff/src/app.module.ts` (guard de sessão).
- [X] T008 [P] Web: cliente + hook de referência em `apps/web/features/reference/reference-api.ts` e `apps/web/features/reference/use-reference.ts` (TanStack Query, `credentials: 'include'`).
- [X] T009 [P] Testes de componente (Vitest) para os primitivos: `packages/ui/src/components/modal.spec.tsx`, `icon-picker.spec.tsx`, `color-picker.spec.tsx`, `bank-select.spec.tsx`.

**Checkpoint**: primitivos de UI + catálogos prontos — stories podem começar.

---

## Phase 3: User Story 1 — Contas (Priority: P1) 🎯 MVP

**Goal**: Usuário cria/lista/edita/exclui contas com banco, ícone e cor; apresentadas como cards.

**Independent Test**: Autenticar, criar conta via popup (banco/ícone/cor), ver card, editar e excluir; usuário B não vê contas de A. (Cenários 1 e 2 do quickstart.)

### Contract + Domain

- [X] T010 [P] [US1] Contratos de conta em `packages/contracts/src/accounts/account.ts` (`accountSchema`, `createAccountInput`, `updateAccountInput`); exportar no index.
- [X] T011 [P] [US1] Entidade de domínio `Account` em `services/api/src/modules/accounts/domain/account.ts` (invariantes: name não-vazio; `bankId`/`icon`/`color` pertencem aos catálogos).
- [X] T012 [P] [US1] Porta `AccountRepository` + erros em `services/api/src/modules/accounts/domain/account.repository.ts` e `.../domain/errors.ts`.

### Application (use cases)

- [X] T013 [P] [US1] Use case `create-account` em `services/api/src/modules/accounts/application/use-cases/create-account/` (input/output; recebe `userId`).
- [X] T014 [P] [US1] Use case `list-accounts` em `.../application/use-cases/list-accounts/` (escopado por `userId`).
- [X] T015 [P] [US1] Use case `update-account` em `.../application/use-cases/update-account/` (404 se não for do usuário).
- [X] T016 [P] [US1] Use case `delete-account` em `.../application/use-cases/delete-account/`.

### Infrastructure

- [X] T017 [US1] Entidade TypeORM `AccountEntity` em `services/api/src/modules/accounts/infrastructure/persistence/entities/account.entity.ts` (tabela `accounts`, índice `user_id`).
- [X] T018 [US1] Implementação `TypeOrmAccountRepository` em `.../infrastructure/persistence/repositories/account.repository.ts`.
- [X] T019 [US1] Migration `create_accounts_table` em `.../infrastructure/persistence/migrations/`.

### Presentation + wiring

- [X] T020 [US1] Controller + HTTP DTOs em `services/api/src/modules/accounts/presentation/accounts.controller.ts` (guard `AuthenticatedUser`, `Idempotency-Key` nas escritas).
- [X] T021 [US1] `accounts.module.ts` e registro em `services/api/src/app.module.ts`.
- [X] T022 [US1] BFF: `services/bff/src/accounts/accounts.module.ts` + `accounts.controller.ts` (proxy→API-MS, escopo por sessão, molda `Account` sem `userId`, propaga `Idempotency-Key`); registrar em `services/bff/src/app.module.ts`.

### Web

- [X] T023 [P] [US1] Cliente `apps/web/features/accounts/accounts-api.ts` (CRUD via BFF, `credentials: 'include'`).
- [X] T024 [US1] Hook `apps/web/features/accounts/use-accounts.ts` (TanStack Query: list + mutations create/update/delete com invalidation).
- [X] T025 [P] [US1] `apps/web/features/accounts/account-card.tsx` (card com ícone+cor+banco; reusa `card` do DS).
- [X] T026 [US1] `apps/web/features/accounts/account-form-modal.tsx` (RHF + Zod de `@finance/contracts`, dentro de `Modal`, usando `BankSelect`/`IconPicker`/`ColorPicker`).
- [X] T027 [US1] `apps/web/features/accounts/accounts-view.tsx` (grade animada `AnimatePresence` + estado vazio com CTA) e ligar em `apps/web/app/(app)/contas/page.tsx` (substituir placeholder).

### Tests (US1)

- [X] T028 [P] [US1] Unit dos use cases com fakes de repositório em `services/api/src/modules/accounts/application/use-cases/**/*.spec.ts` (inclui isolamento por usuário / 404).
- [X] T029 [P] [US1] Integração do repositório em `services/api/src/modules/accounts/infrastructure/persistence/repositories/account.repository.spec.ts`.
- [X] T030 [P] [US1] Componentes: `apps/web/features/accounts/account-card.spec.tsx` e `account-form-modal.spec.tsx` (validação de campo obrigatório).

**Checkpoint**: MVP entregue — cadastro de Contas funcional e testável de ponta a ponta.

---

## Phase 4: User Story 2 — Categorias (Priority: P2)

**Goal**: Categorias por tipo (despesa/receita) com subcategorias recursivas; padrão do sistema ocultáveis e personalizáveis (override copy-on-write) por usuário; personalizadas próprias.

**Independent Test**: Ver padrões agrupadas por tipo; ocultar/restaurar (isolado por usuário); editar padrão vira override; criar personalizada; adicionar sub e sub-sub. (Cenário 3 do quickstart.)

### Contract + Domain

- [X] T031 [P] [US2] Contratos em `packages/contracts/src/categories/category.ts` (`categoryNodeSchema` recursivo, `categoryTreeSchema`, `createCategoryInput`, `updateCategoryInput`, `categoryType`, campo `source`); exportar no index.
- [X] T032 [P] [US2] Domínio `Category` (nó recursivo) em `services/api/src/modules/categories/domain/category.ts` (invariante: `type` do filho == raiz; distinção system/custom).
- [X] T033 [P] [US2] Portas + erros em `.../domain/` : `category.repository.ts`, `hidden-category.repository.ts`, `category-override.repository.ts`, `errors.ts`.

### Application (use cases)

- [X] T034 [US2] `list-effective-categories` em `.../application/use-cases/list-effective-categories/` (padrão − ocultas + overrides ∪ custom; agrupa por tipo; monta árvore recursiva).
- [X] T035 [P] [US2] `create-custom-category` em `.../application/use-cases/create-custom-category/`.
- [X] T036 [P] [US2] `add-subcategory` em `.../application/use-cases/add-subcategory/` (herda `type` da raiz; filha é custom do usuário).
- [X] T037 [US2] `update-category` em `.../application/use-cases/update-category/` (custom → edita direto; padrão → cria/atualiza override).
- [X] T038 [US2] `delete-category` em `.../application/use-cases/delete-category/` (custom → hard delete + subárvore em transação; padrão → oculta idempotente).
- [X] T039 [P] [US2] `restore-default-category` em `.../application/use-cases/restore-default-category/` (remove ocultação; idempotente).
- [X] T040 [P] [US2] `revert-category-override` em `.../application/use-cases/revert-category-override/` (remove override; idempotente).

### Infrastructure

- [X] T041 [US2] Entidades TypeORM em `.../infrastructure/persistence/entities/`: `category.entity.ts` (self-ref `parent_id`, cascade), `user-hidden-category.entity.ts`, `user-category-override.entity.ts`.
- [X] T042 [US2] Repositórios TypeORM em `.../infrastructure/persistence/repositories/` (category, hidden, override) com `UNIQUE(user_id, category_id)`.
- [X] T043 [US2] Migration `create_categories_table` (self-ref FK + índices) em `.../migrations/`.
- [X] T044 [US2] Migration `seed_default_categories` (categorias + subcategorias padrão, `owner_id NULL`, `is_system true`) em `.../migrations/`.
- [X] T045 [P] [US2] Migrations `create_user_hidden_categories_table` e `create_user_category_overrides_table` em `.../migrations/`.

### Presentation + wiring

- [X] T046 [US2] Controller + DTOs em `.../presentation/categories.controller.ts` (endpoints do contrato: CRUD, `:parentId/subcategories`, `:id/restore`, `:id/override`; guard; idempotência).
- [X] T047 [US2] `categories.module.ts` + registro em `services/api/src/app.module.ts`.
- [X] T048 [US2] BFF: `services/bff/src/categories/{categories.module.ts,categories.controller.ts}` (lista efetiva agrupada por tipo, `source`, sem `ownerId`); registrar em `app.module.ts`.

### Web

- [X] T049 [P] [US2] `apps/web/features/categories/categories-api.ts`.
- [X] T050 [US2] `apps/web/features/categories/use-categories.ts` (TanStack Query + mutations: create, subcategory, update, delete/hide, restore, revert override).
- [X] T051 [P] [US2] `apps/web/features/categories/category-tree.tsx` (árvore recursiva; badge de `source`; ações restaurar/reverter em padrões).
- [X] T052 [US2] `apps/web/features/categories/category-form-modal.tsx` (RHF+Zod, `Modal`, `IconPicker`/`ColorPicker`, seletor de tipo).
- [X] T053 [US2] `apps/web/features/categories/categories-view.tsx` (seções Despesa/Receita) e nova rota `apps/web/app/(app)/categorias/page.tsx`.
- [X] T054 [P] [US2] Adicionar item "Categorias" ao sidebar em `apps/web/features/navigation/`.

### Tests (US2)

- [X] T055 [P] [US2] Unit dos use cases com fakes em `.../application/use-cases/**/*.spec.ts` (lista efetiva, aplicação de override, hide idempotente, herança de tipo, cascata de deleção, isolamento por usuário).
- [X] T056 [P] [US2] Integração dos repositórios em `.../infrastructure/persistence/repositories/*.spec.ts` (self-ref, unique, cascade).
- [X] T057 [P] [US2] Componente `apps/web/features/categories/category-tree.spec.tsx` (recursão + ações).

**Checkpoint**: Categorias completas e independentes das demais stories.

---

## Phase 5: User Story 3 — Cartões de Crédito (Priority: P3)

**Goal**: Cadastro de cartões (nome, 4 dígitos, vencimento, fechamento, limite, bandeira) apresentados como card visual de cartão.

**Independent Test**: Criar cartão via popup com validações (dígitos, dias 1–31, limite ≥ 0); ver card visual; editar e excluir. (Cenário 4 do quickstart.)

### Contract + Domain

- [X] T058 [P] [US3] Contratos em `packages/contracts/src/cards/credit-card.ts` (`creditCardSchema`, `createCreditCardInput`, `updateCreditCardInput`; `limit` = `moneySchema`); exportar no index.
- [X] T059 [P] [US3] Domínio `CreditCard` em `services/api/src/modules/cards/domain/credit-card.ts` (validações: `lastDigits` `^\d{4}$`; `dueDay`/`closingDay` 1–31; `limit` ≥ 0; `brandId` ∈ catálogo).
- [X] T060 [P] [US3] Porta `CreditCardRepository` + erros em `.../domain/`.

### Application (use cases)

- [X] T061 [P] [US3] `create-card` em `services/api/src/modules/cards/application/use-cases/create-card/`.
- [X] T062 [P] [US3] `list-cards` em `.../application/use-cases/list-cards/`.
- [X] T063 [P] [US3] `update-card` em `.../application/use-cases/update-card/`.
- [X] T064 [P] [US3] `delete-card` em `.../application/use-cases/delete-card/`.

### Infrastructure

- [X] T065 [US3] Entidade TypeORM `CreditCardEntity` em `.../infrastructure/persistence/entities/credit-card.entity.ts` (`limit numeric(18,2)`, `last_digits char(4)`, índice `user_id`).
- [X] T066 [US3] `TypeOrmCreditCardRepository` em `.../infrastructure/persistence/repositories/credit-card.repository.ts`.
- [X] T067 [US3] Migration `create_credit_cards_table` em `.../migrations/`.

### Presentation + wiring

- [X] T068 [US3] Controller + DTOs em `.../presentation/cards.controller.ts` (guard; idempotência).
- [X] T069 [US3] `cards.module.ts` + registro em `services/api/src/app.module.ts`.
- [X] T070 [US3] BFF: `services/bff/src/cards/{cards.module.ts,cards.controller.ts}` (molda `CreditCard` sem `userId`, `limit` string); registrar em `app.module.ts`.

### Web

- [X] T071 [P] [US3] `apps/web/features/cards/cards-api.ts`.
- [X] T072 [US3] `apps/web/features/cards/use-cards.ts` (TanStack Query + mutations).
- [X] T073 [US3] Evoluir `apps/web/features/cards/add-card-form.tsx` → `card-form-modal.tsx` (RHF+Zod, `Modal`, seletor de bandeira; validações do contrato).
- [X] T074 [US3] `apps/web/features/cards/cards-view.tsx` (grade de `credit-card-visual` do DS + estado vazio) e ligar em `apps/web/app/(app)/cartoes/page.tsx` (substituir placeholder + mock `cards-data.ts`).

### Tests (US3)

- [X] T075 [P] [US3] Unit dos use cases com fakes em `.../application/use-cases/**/*.spec.ts` (validações + isolamento por usuário/404).
- [X] T076 [P] [US3] Integração do repositório em `.../infrastructure/persistence/repositories/credit-card.repository.spec.ts`.
- [X] T077 [P] [US3] Componente `apps/web/features/cards/card-form-modal.spec.tsx` (validação de dígitos/dias/limite).

**Checkpoint**: Todos os três cadastros entregues.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Acabamento, acessibilidade, documentação e verificações transversais.

- [X] T078 [P] Garantir `prefers-reduced-motion` em `Modal` e nas listas animadas (`packages/ui`, views web).
- [X] T079 [P] ADR-011 (categorias como árvore auto-referenciada única + hide/override) em `docs/decisions/ADR-011-categories-tree.md`.
- [X] T080 [P] Docs de domínio: `docs/domains/accounts.md`, `docs/domains/categories.md`, `docs/domains/credit-cards.md`.
- [X] T081 Verificação transversal de segurança/idempotência: teste garantindo `404` para recurso de outro usuário e efeito idempotente de escritas repetidas (FR-021, regra 7) nos três módulos.
- [X] T082 [P] Passe de acessibilidade: foco/`Esc`/`aria` no `Modal`, navegação por teclado em `IconPicker`/`ColorPicker`/`BankSelect`.
- [X] T083 Rodar quickstart e `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (Definition of Done).

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → stories. Foundational bloqueia todas as stories (todas usam `Modal`; Contas/Cartões usam catálogos; todas usam ícone/cor).
- **User Stories**: prioridade P1 → P2 → P3. São independentes entre si (módulos/tabelas/telas distintos) e podem ser feitas em paralelo por times diferentes após a Foundational. Ordem recomendada = prioridade.
- **Dentro de cada story**: contratos + domínio → use cases → infraestrutura (entidade → repo → migration) → presentation → módulo/registro → BFF → web → testes. Web pode iniciar contra o contrato assim que o BFF expõe o endpoint.
- **Polish**: após as stories cobertas serem entregues.

## Parallel Opportunities

- **Setup/Foundational**: T002 ∥ (T003, T004, T005, T006) ∥ T008, T009; T007 depende de T002.
- **US1**: T010, T011, T012 em paralelo; use cases T013–T016 em paralelo; T023/T025 em paralelo; testes T028–T030 em paralelo.
- **US2**: T031, T032, T033 em paralelo; T035/T036/T039/T040 em paralelo; T045 em paralelo com T043/T044; testes T055–T057 em paralelo.
- **US3**: T058, T059, T060 em paralelo; use cases T061–T064 em paralelo; testes T075–T077 em paralelo.
- **Entre stories**: US1, US2, US3 podem correr em paralelo após o Checkpoint da Phase 2.

## Implementation Strategy

- **MVP** = Phase 1 + Phase 2 + **US1 (Contas)**. Entrega um cadastro completo, animado, em card, isolado por usuário.
- **Incremento 2**: US2 (Categorias) — maior valor de domínio (base para orçamentos/relatórios futuros).
- **Incremento 3**: US3 (Cartões).
- **Fechamento**: Phase 6 (polish, a11y, ADR, docs, DoD).

## Independent Test Criteria (resumo)

- **US1**: criar/editar/excluir conta em popup com banco/ícone/cor; card reflete; usuário B isolado.
- **US2**: padrões por tipo; ocultar/restaurar isolado; editar padrão = override; criar personalizada; sub e sub-sub recursivas.
- **US3**: criar cartão com validações; card visual de cartão; editar/excluir.
