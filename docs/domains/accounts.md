# Domain: Accounts

Cadastro de contas do usuário (banco, ícone, cor), apresentadas como cards. Módulo `accounts` na API-MS (Clean Architecture: `domain → application → infrastructure → presentation`), agregado pelo BFF e consumido pelo web.

## Purpose

Permitir que cada usuário cadastre/liste/edite/exclua suas contas, identificadas por um banco do catálogo, um ícone e uma cor. Isolamento total por usuário (recurso de outro usuário → `404`).

## Entities / Value Objects

- **`Account`** (aggregate root) — `services/api/src/modules/accounts/domain/account.ts`
  - Props: `id`, `userId`, `name`, `bankId`, `icon`, `color`, `createdAt`, `updatedAt`.
  - `create(...)` valida invariantes; `restore(props)` reidrata da persistência sem defaults; `update(patch, now)` aplica alterações parciais revalidando.
- Referências de catálogo (estáticas, `@finance/contracts/src/reference`): `bankId ∈ BANKS`, `icon ∈ ICONS` (iconKey lucide), `color ∈ COLORS` (colorToken do design system). Não são entidades — só ids/keys.

## Invariants

- `name` não-vazio após `trim`.
- `bankId`/`icon`/`color` devem pertencer aos respectivos catálogos (`isBankId`/`isIconKey`/`isColorToken`) — violação lança `InvalidAccountError`.
- `userId` sempre do JWT verificado (`AuthenticatedUser`), nunca do payload/cliente.
- Escopo por `user_id` em toda query; sem unicidade de nome (duplicatas permitidas).
- Sem vínculo com cartão/transação nesta feature.

## Use Cases (`application/use-cases`)

| Use case | Entrada | Regra |
|---|---|---|
| `CreateAccountUseCase` | `(userId, CreateAccountInput)` | gera UUID, `Account.create`, persiste; retorna agregado |
| `ListAccountsUseCase` | `(userId)` | `findAllByUser` — só do dono |
| `UpdateAccountUseCase` | `(userId, id, UpdateAccountInput)` | `findById(id,userId)`; ausente → `AccountNotFoundError` (404); aplica `update` + `save` |
| `DeleteAccountUseCase` | `(userId, id)` | `findById` escopado; ausente → `AccountNotFoundError`; `delete(id,userId)` |

Porta `AccountRepository` (`ACCOUNT_REPOSITORY` symbol): `create/save/findById(id,userId)/findAllByUser(userId)/delete(id,userId)` — todos escopados por `userId`.

## Events

Nenhum evento de domínio publicado nesta feature (CRUD síncrono).

## API Surface

- **API-MS** (`presentation/accounts.controller.ts`): CRUD REST, guard de `AuthenticatedUser`, `Idempotency-Key` nas escritas. Entidade TypeORM `AccountEntity` (`accounts`, índice `user_id`) nunca é exposta como contrato.
- **BFF** (`services/bff/src/accounts`): proxy escopado por sessão; molda `accountSchema` (sem `userId` — FR-023) e propaga `Idempotency-Key`.
- **Contrato** (`@finance/contracts/src/accounts/account.ts`): `accountSchema` (saída), `createAccountInput`/`updateAccountInput` (RHF+Zod no web).
- **Web** (`apps/web/features/accounts`): `use-accounts` (TanStack Query), `account-card.tsx` (card ícone+cor+banco), `account-form-modal.tsx` (popup RHF+Zod com `BankSelect`/`IconPicker`/`ColorPicker`), `accounts-view.tsx` (grade animada + estado vazio).

## Persistence

Tabela `accounts` — ver `data-model.md §1` e migration `create-accounts-table`. `AccountEntity`: `user_id uuid` (index), `name varchar(80)`, `bank_id varchar(40)`, `icon varchar(40)`, `color varchar(24)`, timestamps `timestamptz`.
