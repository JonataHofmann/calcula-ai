# Phase 1 Data Model: Transações

**Feature**: `004-transactions` | **Date**: 2026-08-17 | **Depends on**: [research.md](./research.md)

## Entidade: Transaction (tabela `transactions`)

Uma linha = uma ocorrência (parcela ou período fixo ou lançamento avulso). Agrupada logicamente por `group_id`.

| Coluna (DB) | Campo (domínio/DTO) | Tipo PG | Nulo | Regra / Observação |
|---|---|---|---|---|
| `id` | `id` | `uuid` PK | não | uuid v4 gerado no domínio |
| `user_id` | — (nunca no DTO) | `uuid` | não | dono; do JWT (regra 2); indexado |
| `description` | `description` | `varchar(120)` | não | trim, 1..120 |
| `due_date` | `dueDate` | `timestamptz` | não | vencimento, instante UTC (R4) |
| `amount` | `amount` | `numeric(18,2)` | não | valor previsto; para `installment` = valor por parcela; `> 0` (R2/R7) |
| `effective_amount` | `effectiveAmount` | `numeric(18,2)` | sim | valor efetivo (R6); preenchido na efetivação |
| `recurrence` | `recurrence` | `varchar(16)` | não | `single` \| `fixed` \| `installment`; default `single` |
| `effective_date` | `effectiveDate` | `timestamptz` | sim | data de pagamento (R6); UTC |
| `type` | `type` | `varchar(16)` | não | `expense` \| `income` |
| `notes` | `notes` | `text` | sim | opcional |
| `status` | `status` | `varchar(16)` | não | `pending` \| `paid`; default `pending` |
| `end_date` | `endDate` | `timestamptz` | sim | fim da fixa (R10); `>= due_date` inicial quando presente |
| `installment_count` | `installmentCount` | `int` | sim | total de parcelas; `>= 1` quando `installment` |
| `installment_number` | `installmentNumber` | `int` | sim | parcela atual 1-based; `1..installment_count` |
| `group_id` | `groupId` | `uuid` | sim | agrupa parcelas/ocorrências fixas; nulo em `single`; indexado |
| `category_id` | `categoryId` | `uuid` | não | ref `categories` (dono + tipo coerente — R9) |
| `account_id` | `accountId` | `uuid` | sim | ref `accounts` (origem) |
| `credit_card_id` | `creditCardId` | `uuid` | sim | ref `credit_cards` (origem) |
| `created_at` | — | `timestamptz` | não | `@CreateDateColumn` |
| `updated_at` | — | `timestamptz` | não | `@UpdateDateColumn` |

> Entidade TypeORM vive em `infrastructure/persistence/entities/transaction.entity.ts` e **nunca** é exposta como contrato HTTP (regra 9). `toDto()` omite `user_id`, `created_at`, `updated_at`.

## Índices

- `idx_transactions_user_id` (`user_id`) — isolamento por usuário.
- `idx_transactions_user_due` (`user_id`, `due_date`) — listagem mensal por intervalo.
- `idx_transactions_user_status_due` (`user_id`, `status`, `due_date`) — grid de atrasados (pending & due < before).
- `idx_transactions_group` (`group_id`) — operações de escopo de grupo.

## Invariantes (agregado `Transaction`)

Validados no domínio (`create`/`restore`/`update`), espelhados no contrato (Zod `superRefine`) e reforçados por `CHECK` na migration (defesa em profundidade — R7):

1. **Valor**: `amount > 0`. `effectiveAmount` (quando presente) `> 0`.
2. **Origem por tipo**:
   - `type = expense` ⇒ exatamente **um** de {`accountId`, `creditCardId`} preenchido (XOR).
   - `type = income` ⇒ `accountId` preenchido e `creditCardId` nulo.
3. **Categoria**: `categoryId` obrigatório; a categoria deve existir, pertencer ao `userId` e ter `type` = `type` da transação (checado por `CategoryLookup`).
4. **Origem existente e do dono**: `accountId`/`creditCardId` (o que estiver presente) deve existir e pertencer ao `userId` (checado por `AccountLookup`/`CardLookup`); senão → 404 (FR-022).
5. **Recorrência**:
   - `single`: `groupId`, `installmentCount`, `installmentNumber`, `endDate` nulos.
   - `installment`: `installmentCount >= 1`; `installmentNumber ∈ 1..installmentCount`; `groupId` não nulo; `endDate` nulo.
   - `fixed`: `groupId` não nulo; `installmentCount`/`installmentNumber` nulos; `endDate` nulo **ou** `>= dueDate` da primeira ocorrência.
6. **Efetivação**: só `pending` pode ser efetivada (senão `AlreadyPaidError`). `paid` ⇒ `effectiveDate` e `effectiveAmount` preenchidos.

## Transições de estado

```text
            create
              │
              ▼
          ┌────────┐   effectuate(date?, amount?)   ┌──────┐
          │pending │ ─────────────────────────────► │ paid │
          └────────┘                                 └──────┘
              │                                          │
   update(campos editáveis)                    update(campos editáveis;
   delete                                       preserva status/effectiveDate/effectiveAmount)
                                                delete
```

- **effectuate** numa `fixed` pendente: além de `pending→paid`, gera atomicamente a próxima ocorrência `pending` (`dueDate + 1 mês`, mesmo `groupId`), salvo se ultrapassar `endDate` (R10).
- **update/delete** com `scope` (`one|future|all`) aplicam-se ao intervalo do grupo **incluindo linhas `paid`** (R3); `update` preserva os campos de efetivação das pagas.
- Não há transição `paid→pending` (efetivar de novo é bloqueado — FR-017).

## Regras derivadas de criação

- **single** → 1 linha, `groupId = null`.
- **installment** → `groupId = uuid()`; N linhas com `installmentNumber` 1..N, `dueDate_k = addMonthClamped(dueDate, k-1)`, `amount` = valor por parcela (R2). Escrita atômica (`createMany`).
- **fixed** → `groupId = uuid()`; 1 linha `pending`. Próximas nascem na efetivação (R1/R10).

## Referências externas (read-only, escopadas)

| Porta (domínio) | Consulta | Uso |
|---|---|---|
| `CategoryLookup.find(id, userId)` | `categories` | existência + dono + `type` (FR-008) |
| `AccountLookup.exists(id, userId)` | `accounts` | existência + dono (FR-006/007) |
| `CardLookup.exists(id, userId)` | `credit_cards` | existência + dono (FR-006) |

Sem FK física cross-módulo (R9). Falha de lookup por dono/inexistência → 404.
