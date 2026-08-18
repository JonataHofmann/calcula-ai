# Contract: Transactions API (BFF)

**Feature**: `004-transactions` | **Date**: 2026-08-17

Endpoints expostos pelo **BFF** (`services/bff/src/transactions`), consumidos pela web com `credentials: 'include'`. O BFF escopa por sessão (deriva o token/`userId` do cookie), **não** aplica regra financeira (regra 6) e proxia para a API-MS repassando query, `scope` e `Idempotency-Key`. Contratos Zod em `@finance/contracts/src/transactions/transaction.ts`.

## DTO: Transaction

`userId`, `createdAt`, `updatedAt` **nunca** aparecem no DTO (regra 9). Valores monetários são **string decimal** (`moneyAmountSchema`, ex.: `"100.00"`), nunca número.

```json
{
  "id": "b1f2...uuid",
  "description": "Internet",
  "dueDate": "2026-08-10T03:00:00.000Z",
  "amount": "129.90",
  "effectiveAmount": null,
  "recurrence": "fixed",
  "effectiveDate": null,
  "type": "expense",
  "notes": null,
  "status": "pending",
  "endDate": null,
  "installmentCount": null,
  "installmentNumber": null,
  "groupId": "9c0a...uuid",
  "categoryId": "3d4e...uuid",
  "accountId": "7a8b...uuid",
  "creditCardId": null
}
```

Enums: `type ∈ {expense, income}`; `recurrence ∈ {single, fixed, installment}`; `status ∈ {pending, paid}`; `scope ∈ {one, future, all}`.

## GET /transactions

Listagem **escopada a um mês** (o frontend calcula `dueFrom`/`dueTo` no fuso do usuário — R4). Filtro/ordenação server-side (R5).

**Query params** (todos opcionais exceto `dueFrom`/`dueTo`):

| Param | Tipo | Efeito |
|---|---|---|
| `dueFrom` | ISO instant | limite inferior de `dueDate` (início do mês) |
| `dueTo` | ISO instant | limite superior de `dueDate` (fim do mês) |
| `search` | string | ILIKE em `description`, `notes` e `amount::text` |
| `amount` | string | ILIKE parcial sobre `amount::text` (ex.: `"12"` casa `12.00`/`112.50`) |
| `recurrence` | enum | filtra por recorrência |
| `type` | enum | filtra por tipo |
| `categoryId` | uuid | filtra por categoria |
| `accountId` | uuid | filtra por conta |
| `creditCardId` | uuid | filtra por cartão |
| `sort` | enum coluna | `dueDate\|amount\|description\|status\|type\|recurrence` (default `dueDate`) |
| `order` | `asc\|desc` | default `asc` |

**200** → `{ "transactions": Transaction[] }` (só do usuário; sem paginação — clarificação Q3).

## GET /transactions/overdue

Grid de "pendentes de meses anteriores" (FR-021).

**Query**: `before` (ISO instant = início do mês corrente no fuso do usuário).
**200** → `{ "transactions": Transaction[] }` — `status = pending` e `dueDate < before`, escopado ao usuário. Lista vazia quando não há atrasados.

## POST /transactions

Cria transação. Header `Idempotency-Key` (regra 7). Body = `createTransactionInput` (união discriminada por `recurrence`):

**single**
```json
{ "recurrence": "single", "type": "expense", "description": "Mercado",
  "dueDate": "2026-08-12T03:00:00.000Z", "amount": "89.90",
  "categoryId": "uuid", "accountId": "uuid", "notes": null }
```

**installment** (informar `installmentCount` e **um** de `amount` (por parcela) **ou** `totalAmount`):
```json
{ "recurrence": "installment", "type": "expense", "description": "Notebook",
  "dueDate": "2026-08-05T03:00:00.000Z", "installmentCount": 3,
  "totalAmount": "3000.00", "categoryId": "uuid", "creditCardId": "uuid" }
```

**fixed** (`endDate` opcional):
```json
{ "recurrence": "fixed", "type": "expense", "description": "Aluguel",
  "dueDate": "2026-08-05T03:00:00.000Z", "amount": "1800.00",
  "endDate": null, "categoryId": "uuid", "accountId": "uuid" }
```

Regras de body (Zod `superRefine` + domínio):
- `type=expense` ⇒ exatamente um de `accountId`/`creditCardId`; `type=income` ⇒ `accountId` e sem `creditCardId`.
- `installment`: exatamente um de `amount`/`totalAmount`; o ausente é calculado; `installmentCount >= 1`.
- `fixed`: `endDate` nulo ou `>= dueDate`.

**201** → `{ "transactions": Transaction[] }` — `single`/`fixed` retornam 1 item; `installment` retorna as N parcelas geradas (R1).
**400** → body inválido (origem/valor/parcelas/tipo).
**404** → `categoryId`/`accountId`/`creditCardId` inexistente ou de outro usuário (FR-022).

## PATCH /transactions/:id

Edita transação (inclusive `paid` — FR-001; preserva `status`/`effectiveDate`/`effectiveAmount`). Header `Idempotency-Key`.

**Query**: `scope` (`one|future|all`) — obrigatório quando a transação tem `groupId`; ignorado para `single`.
**Body**: `updateTransactionInput` = campos editáveis parciais (`description`, `dueDate`, `amount`, `notes`, `categoryId`, `accountId`, `creditCardId`, `type`, `endDate`). Não permite alterar `status`/`effectiveDate`/`effectiveAmount`/`installmentNumber`/`groupId` diretamente.

**200** → `{ "transactions": Transaction[] }` (linhas afetadas pelo escopo, incluindo pagas — R3).
**404** → id inexistente/de outro usuário.

## DELETE /transactions/:id

Exclui. **Query** `scope` (`one|future|all`) como no PATCH. Idempotente para grupo (R11).

**204** → sem corpo.
**404** → id inexistente/de outro usuário (não idempotente para `one` inexistente; `all`/`future` de grupo parcialmente excluído **não** erra).

## POST /transactions/:id/effectuate

Efetiva uma pendente (FR-015/016/017). Header `Idempotency-Key`. Body = `effectuateInput`:

```json
{ "date": "2026-08-18T03:00:00.000Z", "amount": "129.90" }
```
- `date` default = hoje (frontend, fuso do usuário); `amount` default = `amount` previsto.

**200** → `{ "transaction": Transaction, "next": Transaction | null }` — `transaction` = a linha agora `paid`; `next` = próxima ocorrência gerada quando `fixed` (R10), senão `null`.
**409** → já `paid` (`AlreadyPaidError`).
**404** → id inexistente/de outro usuário.

## Regra transversal

- Todo endpoint é escopado ao usuário autenticado; qualquer transação/categoria/conta/cartão de outro usuário → **404** (FR-022, regra 2).
- Escritas aceitam `Idempotency-Key` e são atômicas (parcelas em uma unidade; efetivação de fixa + próxima ocorrência em uma unidade) — regra 7.
- Nenhuma regra financeira no BFF (split, materialização, escopo) — só na API-MS (regra 6).
