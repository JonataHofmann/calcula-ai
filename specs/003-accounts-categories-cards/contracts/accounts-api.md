# Contract — Accounts (BFF)

Escopo por usuário da sessão (BFF resolve `userId`; web nunca envia). BFF → API-MS. Expõe só o necessário (FR-023): sem `userId` na saída. Escritas aceitam `Idempotency-Key` (regra 7).

`Account` (saída):
```json
{
  "id": "uuid",
  "name": "Conta Corrente",
  "bank": { "id": "nubank", "name": "Nubank", "color": "#820AD1", "logo": "nubank" },
  "icon": "wallet",
  "color": "primary",
  "createdAt": "2026-08-17T12:00:00Z"
}
```

## GET /accounts
Lista as contas do usuário.

**200** `{ "accounts": Account[] }` (vazio → `{ "accounts": [] }`, dispara estado vazio na UI)

## POST /accounts
Cria conta. Header opcional `Idempotency-Key`.

**Body** (`createAccountInput`):
```json
{ "name": "Conta Corrente", "bankId": "nubank", "icon": "wallet", "color": "primary" }
```
Regras: `name` não-vazio (≤80); `bankId` ∈ BANKS; `icon` ∈ ICONS; `color` ∈ COLORS.

**201** `Account` · **400** validação · **401** sem sessão

## PATCH /accounts/:id
Edita conta do usuário. Body parcial (`updateAccountInput`: qualquer subconjunto de `name|bankId|icon|color`).

**200** `Account` · **400** · **401** · **404** (não é do usuário / inexistente)

## DELETE /accounts/:id
Remove conta do usuário.

**204** · **401** · **404**

**Regra transversal**: `:id` que não pertence ao usuário → `404` (nunca revela existência de recurso de outro — FR-021).
