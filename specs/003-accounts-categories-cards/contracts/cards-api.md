# Contract — Credit Cards (BFF)

Escopo por usuário. BFF → API-MS. Sem vínculo com conta (clarificação). Escritas com `Idempotency-Key`. `limit` = string decimal (regra 1).

`CreditCard` (saída):
```json
{
  "id": "uuid",
  "name": "Nubank Roxinho",
  "lastDigits": "1234",
  "dueDay": 10,
  "closingDay": 3,
  "limit": "5000.00",
  "brand": { "id": "mastercard", "name": "Mastercard", "color": "#EB001B", "logo": "mastercard" }
}
```
Sem `userId` na saída (FR-023).

## GET /cards
Lista cartões do usuário.

**200** `{ "cards": CreditCard[] }` (vazio → estado vazio na UI)

## POST /cards
Cria cartão.

**Body** (`createCreditCardInput`):
```json
{ "name": "Nubank Roxinho", "lastDigits": "1234", "dueDay": 10, "closingDay": 3, "limit": "5000.00", "brandId": "mastercard" }
```
Regras: `name` não-vazio; `lastDigits` = `^\d{4}$`; `dueDay`,`closingDay` inteiros 1–31; `limit` decimal string ≥ 0 (`moneySchema`); `brandId` ∈ CARD_BRANDS.

**201** `CreditCard` · **400** validação · **401**

## PATCH /cards/:id
Body parcial (`updateCreditCardInput`: subconjunto de `name|lastDigits|dueDay|closingDay|limit|brandId`).

**200** `CreditCard` · **400** · **401** · **404**

## DELETE /cards/:id
**204** · **401** · **404**

**Regra transversal**: recurso de outro usuário → `404` (FR-021).
