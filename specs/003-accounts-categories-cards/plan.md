# Implementation Plan: Cadastros — Contas, Categorias e Cartões de Crédito

**Branch**: `003-accounts-categories-cards` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-accounts-categories-cards/spec.md`

## Summary

Três cadastros de domínio financeiro — Contas, Categorias (com subcategorias recursivas, categorias padrão do sistema, ocultação e override por usuário) e Cartões de crédito — entregues como módulos de domínio na API-MS (Clean Architecture, modular monolith), agregados e moldados pelo BFF, e consumidos pela web Next.js. Toda leitura/escrita é escopada ao usuário autenticado (JWT Keycloak via sessão do BFF, feature 001). O frontend apresenta Contas e Cartões como cards (reaproveitando `card` e `credit-card-visual` do design system 002), Categorias como árvore por tipo (despesa/receita), com formulários de criar/editar em popup (modal) e transições animadas via `motion` (react motion). Componentes genéricos novos — seletor de banco, seletor de ícone, seletor de cor e o modal — vão para `packages/ui`. Bancos e bandeiras são um catálogo estático interno curado, exposto pelo BFF. Escritas aceitam `Idempotency-Key`.

**Nota de arquitetura (pedido do usuário × regras do repo)**: o pedido citou "microserviços". A regra não-negociável nº 8 do `AGENTS.md` e o ADR-002 estabelecem **modular monolith** (sem microserviços prematuros). Atendemos o espírito do pedido — fronteiras de domínio limpas, contratos explícitos, exposição mínima via BFF, monorepo — via módulos isolados na API-MS + BFF, preservando extração futura para serviços sem reescrita. Nenhum serviço novo é criado.

## Technical Context

**Language/Version**: TypeScript 5.7; Node.js ≥ 20; React 19; Next.js 15 (App Router); NestJS 11

**Primary Dependencies**:
- Backend: NestJS 11, TypeORM (PostgreSQL 17), Zod (`@finance/contracts`), `@finance/auth` (guard/`AuthenticatedUser`), `@finance/logger`
- Frontend: TanStack Query (server state), Redux Toolkit (client state — estado de UI do modal/drafts), `motion` (react motion — **a adicionar** em `apps/web` e `packages/ui`), React Hook Form + `@hookform/resolvers` (**a adicionar** em `apps/web`), Zod (via contracts), `lucide-react` (conjunto de ícones já presente)

**Storage**: PostgreSQL 17 via TypeORM. Novas tabelas: `accounts`, `categories` (auto-referenciada), `user_hidden_categories`, `user_category_overrides`, `credit_cards`. Bancos/bandeiras = catálogo estático em código (sem tabela). Alterações via migrations.

**Testing**: Jest (services/api, services/bff — unit de use cases com fakes + integração de repositório); Vitest + Testing Library (apps/web, packages/ui)

**Target Platform**: Web (browsers evergreen); dev local via docker compose (PostgreSQL 17 + Keycloak 26.1)

**Project Type**: Web app (Next.js) + modular monolith NestJS (API-MS) + BFF NestJS. Sem novos serviços.

**Performance Goals**: Listagem de cada cadastro renderizada < 1s (SC-006); abertura/fechamento de popup animada e fluida (~200–300ms, 60fps); reflexo de create/edit/delete na lista < 1s pós-confirmação.

**Constraints**: `userId` só do JWT verificado (regra 2); `limit` do cartão = DECIMAL no banco e string decimal (`moneySchema`) no contrato — nunca float (regra 1); entidades TypeORM nunca expostas como contrato HTTP (regra 9); BFF sem regra financeira (regra 6); escritas idempotentes (regra 7); BFF expõe só os campos necessários (FR-023).

**Scale/Scope**: 3 módulos de domínio; ~14 use cases; 5 tabelas novas; ~4 endpoints por cadastro no BFF + 1 de referência; ~4 componentes genéricos novos em `packages/ui`; 3 telas web (Contas, Categorias, Cartões).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` é template não preenchido — aplicam-se as regras não-negociáveis do `AGENTS.md`:

| Regra | Status |
|---|---|
| 1. Dinheiro DECIMAL/string, nunca float | PASS — `limit` do cartão usa `moneySchema` (string) no contrato e `numeric` no banco |
| 2. `userId` só do JWT via `AuthenticatedUser`; toda query escopada | PASS — use cases recebem `userId` do guard; nunca de body/query |
| 4. Clean Architecture nos módulos da API-MS | PASS — `domain/application/infrastructure/presentation` em cada módulo; use cases testáveis sem Nest/PG |
| 5. Redux = client state; TanStack Query = server state | PASS — dados dos cadastros via TanStack Query; Redux só para estado de UI (modal aberto/draft) |
| 6. BFF sem regras financeiras | PASS — BFF agrega, molda contrato, escopa por sessão e serve catálogo estático; nenhuma regra de cálculo |
| 7. Escritas com `Idempotency-Key`; atomicidade | PASS — create/update/delete aceitam `Idempotency-Key`; override/hide idempotentes |
| 8. Sem complexidade prematura (sem microserviços, sem BaseRepository) | PASS — modular monolith (ADR-002); repositórios concretos por domínio; "microserviços" do pedido atendido via fronteiras de módulo, não serviços novos |
| 9. Entidades TypeORM em `infrastructure/persistence/entities`, migrations | PASS — contratos HTTP separados em `@finance/contracts` |
| 10. Nunca logar segredos | PASS — sem dados sensíveis novos; `lastDigits` são só 4 dígitos (não é PAN completo) |

**Pós-Phase 1**: PASS (ver reavaliação ao final). Decisão de modelar categorias como árvore auto-referenciada única (categoria+subcategoria) → registrar ADR-011 na implementação.

## Project Structure

### Documentation (this feature)

```text
specs/003-accounts-categories-cards/
├── plan.md              # Este arquivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   ├── reference-api.md         # GET /reference/banks, /reference/brands, /reference/icons, /reference/colors
│   ├── accounts-api.md          # BFF /accounts CRUD
│   ├── categories-api.md        # BFF /categories CRUD + hide/restore/override + subcategorias
│   └── cards-api.md             # BFF /cards CRUD
├── checklists/
│   └── requirements.md
└── tasks.md             # Gerado por /speckit.tasks
```

### Source Code (repository root)

```text
packages/contracts/src/
├── reference/
│   ├── bank.ts                 # bankSchema (id, name, logo/color) + BANKS catálogo estático curado
│   ├── brand.ts                # brandSchema + CARD_BRANDS catálogo estático (Visa, Master, Elo, Amex...)
│   ├── icon.ts                 # iconKeySchema (enum de chaves de ícone lucide curadas) + ICONS
│   └── color.ts                # colorTokenSchema (paleta curada) + COLORS
├── accounts/
│   └── account.ts              # accountSchema, createAccountInput, updateAccountInput
├── categories/
│   └── category.ts             # categorySchema (nó de árvore), categoryTreeSchema, create/update inputs, categoryType
├── cards/
│   └── credit-card.ts          # creditCardSchema, createCreditCardInput, updateCreditCardInput
└── index.ts                    # re-exports

services/api/src/modules/
├── accounts/
│   ├── domain/                 # Account (entity de domínio), AccountRepository (porta), erros
│   ├── application/use-cases/  # create/list/update/delete-account
│   ├── infrastructure/persistence/{entities,repositories,migrations}
│   ├── presentation/           # accounts.controller.ts + HTTP DTOs
│   └── accounts.module.ts
├── categories/
│   ├── domain/                 # Category (nó recursivo), regras de tipo herdado, CategoryRepository, HiddenRepo, OverrideRepo
│   ├── application/use-cases/  # list-effective, create-custom, update, delete, add-subcategory, hide-default, restore-default, override-default
│   ├── infrastructure/persistence/{entities,repositories,migrations}   # + migration de seed das categorias padrão
│   ├── presentation/
│   └── categories.module.ts
└── cards/
    ├── domain/                 # CreditCard, validações (lastDigits, dueDay, closingDay, limit), CreditCardRepository
    ├── application/use-cases/  # create/list/update/delete-card
    ├── infrastructure/persistence/{entities,repositories,migrations}
    ├── presentation/
    └── cards.module.ts

services/bff/src/
├── reference/                  # reference.controller.ts (serve catálogos de @finance/contracts) + module
├── accounts/                   # accounts.controller.ts → API-MS; escopo por sessão; molda contrato
├── categories/                 # categories.controller.ts → API-MS
└── cards/                      # cards.controller.ts → API-MS

packages/ui/src/components/
├── modal.tsx                   # popup genérico (overlay + foco + esc), animado com motion
├── icon-picker.tsx             # grade de ícones lucide com busca; retorna iconKey
├── color-picker.tsx            # paleta de cores; retorna colorToken
└── bank-select.tsx             # seletor de banco a partir do catálogo (nome + logo)

apps/web/
├── app/(app)/
│   ├── contas/page.tsx         # substitui placeholder → AccountsView
│   ├── categorias/page.tsx     # nova rota
│   └── cartoes/page.tsx        # substitui placeholder → CardsView
├── features/accounts/
│   ├── accounts-api.ts         # chamadas ao BFF (credentials: 'include')
│   ├── use-accounts.ts         # TanStack Query (list/create/update/delete)
│   ├── account-card.tsx        # card de conta (ícone+cor+banco)
│   ├── account-form-modal.tsx  # RHF + Zod, dentro do Modal
│   └── accounts-view.tsx       # grade animada + estado vazio
├── features/categories/
│   ├── categories-api.ts
│   ├── use-categories.ts
│   ├── category-tree.tsx       # árvore recursiva por tipo (despesa/receita)
│   ├── category-form-modal.tsx
│   └── categories-view.tsx     # abas/seções despesa|receita, hide/restore, override
├── features/cards/
│   ├── cards-api.ts
│   ├── use-cards.ts
│   ├── card-form-modal.tsx     # evolui add-card-form.tsx existente para popup + real
│   └── cards-view.tsx          # grade de credit-card-visual + estado vazio
├── features/navigation/        # + item "Categorias" no sidebar
└── store/                      # + ui slice: modal aberto por cadastro (client state)
```

**Structure Decision**: Reaproveita o monorepo existente (ADR-001). Regras de negócio dos três cadastros ficam na API-MS como módulos Clean Architecture independentes (regra 4); o BFF apenas agrega, escopa por sessão e molda contratos (regra 6), expondo o mínimo necessário à web (FR-023). Componentes reutilizáveis genéricos (modal, seletores de ícone/cor/banco) vão para `packages/ui` (regra frontend nº 5); telas e composições específicas ficam em `apps/web/features/<domínio>`. O catálogo de bancos/bandeiras/ícones/cores mora em `@finance/contracts` (dados estáticos + schema) e é servido pelo BFF, evitando tabela e integração externa (clarificação 2026-08-17).

## Complexity Tracking

| Item | Justificativa | Alternativa rejeitada |
|---|---|---|
| Tabela `categories` auto-referenciada (categoria+subcategoria unificadas) | Subcategorias recursivas de profundidade arbitrária (clarificação) exigem árvore; unificar em uma tabela com `parentId` self-ref é o modelo mais simples que suporta recursão | Tabelas separadas `categories`+`subcategories` — não modela recursão sem uma terceira auto-referência; mais joins e duplicação de regra |
| Tabelas `user_hidden_categories` + `user_category_overrides` | Ocultar e personalizar categorias padrão por usuário sem afetar os demais (copy-on-write) exige estado por usuário separado das linhas do sistema | Copiar todas as categorias padrão para cada usuário no primeiro acesso — infla dados, complica atualização do conjunto padrão e a reversão ao original |
| Componente `modal` novo em `packages/ui` | Requisito FR-018 (todo form em popup) e ausência de modal no design system atual | Reusar biblioteca externa de dialog — dependência extra; o design system deve possuir seu próprio primitivo animado coerente com os tokens |
