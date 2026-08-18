# Domain: Credit Cards

Cadastro de cartões de crédito (nome, 4 últimos dígitos, dia de vencimento/fechamento, limite, bandeira), apresentados como card visual simulando um cartão real. Módulo `cards` na API-MS, agregado pelo BFF, consumido pelo web.

## Purpose

Cada usuário cadastra/lista/edita/exclui seus cartões. Nenhum dado sensível de cartão é armazenado — apenas os 4 dígitos finais (não é PAN). Isolamento por usuário (recurso de outro → `404`).

## Entities / Value Objects

- **`CreditCard`** (aggregate root) — `services/api/src/modules/cards/domain/credit-card.ts`
  - Props: `id`, `userId`, `name`, `lastDigits`, `dueDay`, `closingDay`, `limit` (string decimal), `brandId`, timestamps.
  - `create(...)` valida; `restore(props)` reidrata; `update(patch, now)` aplica parcial revalidando.
- `brandId ∈ CARD_BRANDS` (catálogo estático em `@finance/contracts/src/reference/brand.ts`).

## Invariants

- `name` não-vazio.
- `lastDigits` casa `^\d{4}$` (exatamente 4 dígitos).
- `dueDay` e `closingDay` inteiros 1–31.
- `limit` ≥ 0, mantido como **string decimal** (regra 1 — dinheiro nunca como float); persistido em `numeric(18,2)`.
- `brandId` pertence ao catálogo (`isCardBrandId`). Violações lançam `InvalidCreditCardError`.
- `userId` do JWT verificado; toda query escopada por `user_id`.
- Segurança: `last_digits` são só os 4 finais — sem PAN, CVV ou validade completa (regra 10).

## Use Cases (`application/use-cases`)

| Use case | Entrada | Regra |
|---|---|---|
| `CreateCardUseCase` | `(userId, CreateCreditCardInput)` | gera UUID, `CreditCard.create`, persiste |
| `ListCardsUseCase` | `(userId)` | `findAllByUser` — só do dono |
| `UpdateCardUseCase` | `(userId, id, UpdateCreditCardInput)` | `findById(id,userId)`; ausente → `CreditCardNotFoundError` (404); `update` + `save` |
| `DeleteCardUseCase` | `(userId, id)` | `findById` escopado; ausente → `CreditCardNotFoundError`; `delete(id,userId)` |

Porta `CreditCardRepository` (`CREDIT_CARD_REPOSITORY` symbol): `create/save/findById(id,userId)/findAllByUser(userId)/delete(id,userId)`.

## Events

Nenhum evento de domínio nesta feature.

## API Surface

- **API-MS** (`presentation/cards.controller.ts`): CRUD REST, guard `AuthenticatedUser`, `Idempotency-Key` nas escritas. `CreditCardEntity` (`credit_cards`, índice `user_id`, `limit numeric(18,2)`, `last_digits char(4)`) nunca exposta como contrato.
- **BFF** (`services/bff/src/cards`): proxy por sessão; molda `creditCardSchema` (sem `userId`, `limit` como string) e propaga `Idempotency-Key`.
- **Contrato** (`@finance/contracts/src/cards/credit-card.ts`): `creditCardSchema` (saída), `createCreditCardInput`/`updateCreditCardInput`; `limit` via `moneyAmountSchema` (regex duas casas).
- **Web** (`apps/web/features/cards`): `use-cards` (TanStack Query), `card-item.tsx` (usa `CreditCardVisual` do DS + overlay editar/excluir; `tone` alternado por índice), `card-form-modal.tsx` (popup RHF+Zod, seletor de bandeira), `cards-view.tsx` (grade animada + estado vazio).

## Persistence

Tabela `credit_cards` — ver `data-model.md §5` e migration `create_credit_cards_table`. TypeORM retorna `numeric` como string, preservando `limit` sem perda de precisão.
