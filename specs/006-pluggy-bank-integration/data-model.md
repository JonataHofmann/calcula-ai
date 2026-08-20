# Data Model: Pluggy Bank Integration

Todas as tabelas abaixo vivem no schema Postgres `banking` (mesma instância do
`docker-compose.yml`), propriedade exclusiva do `services/banking-ms`. Nenhuma
delas é acessada diretamente pelo `services/api` (ver R4/R5 em `research.md`).

## Entidade: Bank Connection (tabela `bank_connection`)

| Coluna (DB) | Campo (domínio/DTO) | Tipo PG | Nulo | Regra |
|---|---|---|---|---|
| `id` | `id` | UUID (PK) | Não | Gerado na criação |
| `user_id` | `userId` | UUID | Não | Vem do `AuthenticatedUser` (JWT); todo acesso é filtrado por este campo |
| `pluggy_item_id` | `pluggyItemId` | TEXT | Não | Id do Item na Pluggy; único por linha |
| `institution_id` | `institutionId` | TEXT | Não | Id do conector Pluggy (banco/emissor) |
| `institution_name` | `institutionName` | TEXT | Não | Nome exibido ao usuário |
| `status` | `status` | ENUM(`active`,`needs_attention`,`disconnected`) | Não | Ver Transições de estado |
| `created_at` | `createdAt` | TIMESTAMPTZ | Não | Definido na criação |
| `last_synced_at` | `lastSyncedAt` | TIMESTAMPTZ | Sim | Atualizado a cada sync bem-sucedido |
| `updated_at` | `updatedAt` | TIMESTAMPTZ | Não | Atualizado a cada mudança |

**Unicidade**: `(user_id, pluggy_item_id)` único — impede duplicar a mesma
conexão (FR-004). Duas conexões distintas para a mesma instituição só são
permitidas se a Pluggy retornar `itemId`s diferentes (credenciais/consentimento
diferentes).

## Entidade: Linked Account (tabela `linked_account`)

| Coluna (DB) | Campo (domínio/DTO) | Tipo PG | Nulo | Regra |
|---|---|---|---|---|
| `id` | `id` | UUID (PK) | Não | |
| `bank_connection_id` | `bankConnectionId` | UUID (FK → `bank_connection.id`) | Não | `ON DELETE CASCADE` só a nível de registro-histórico (ver FR-014: a conexão nunca é apagada, apenas `disconnected`) |
| `user_id` | `userId` | UUID | Não | Denormalizado do Bank Connection para permitir filtro direto por usuário |
| `pluggy_account_id` | `pluggyAccountId` | TEXT | Não | Único por `bank_connection_id` |
| `type` | `type` | TEXT | Não | Ex.: `CHECKING_ACCOUNT`, `SAVINGS_ACCOUNT` (subtipo bruto da Pluggy) |
| `display_name` | `displayName` | TEXT | Não | |
| `balance` | `balance` | NUMERIC(14,2) | Não | Valor decimal, nunca float |
| `currency` | `currency` | CHAR(3) | Não | `BRL` no MVP |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | TIMESTAMPTZ | Não | |

## Entidade: Linked Credit Card (tabela `linked_credit_card`)

| Coluna (DB) | Campo (domínio/DTO) | Tipo PG | Nulo | Regra |
|---|---|---|---|---|
| `id` | `id` | UUID (PK) | Não | |
| `bank_connection_id` | `bankConnectionId` | UUID (FK) | Não | |
| `user_id` | `userId` | UUID | Não | Denormalizado, mesmo motivo do Linked Account |
| `pluggy_account_id` | `pluggyAccountId` | TEXT | Não | A Pluggy modela cartão como uma Account do tipo `CREDIT` |
| `brand` | `brand` | TEXT | Sim | Nem sempre disponível na instituição |
| `last_digits` | `lastDigits` | VARCHAR(4) | Sim | |
| `credit_limit` | `creditLimit` | NUMERIC(14,2) | Sim | |
| `available_limit` | `availableLimit` | NUMERIC(14,2) | Sim | |
| `current_balance` | `currentBalance` | NUMERIC(14,2) | Não | |
| `closing_date` | `closingDate` | DATE | Sim | |
| `due_date` | `dueDate` | DATE | Sim | |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | TIMESTAMPTZ | Não | |

## Entidade: Synced Transaction (tabela `synced_transaction`)

| Coluna (DB) | Campo (domínio/DTO) | Tipo PG | Nulo | Regra |
|---|---|---|---|---|
| `id` | `id` | UUID (PK) | Não | |
| `linked_account_id` | `linkedAccountId` | UUID (FK, nullable) | Sim | Preenchido XOR com `linked_credit_card_id` |
| `linked_credit_card_id` | `linkedCreditCardId` | UUID (FK, nullable) | Sim | Preenchido XOR com `linked_account_id` |
| `user_id` | `userId` | UUID | Não | Denormalizado |
| `pluggy_transaction_id` | `pluggyTransactionId` | TEXT | Não | Chave de idempotência do import (R6); único por `user_id` |
| `description` | `description` | TEXT | Não | |
| `amount` | `amount` | NUMERIC(14,2) | Não | Sempre positivo; sinal de efeito vem de `direction` |
| `date` | `date` | DATE | Não | |
| `direction` | `direction` | ENUM(`credit`,`debit`) | Não | Aumenta ou reduz o saldo/fatura (FR-009) |
| `pluggy_status` | `pluggyStatus` | ENUM(`pending`,`posted`) | Não | Estado da transação na instituição (FR-009) |
| `installment_number` | `installmentNumber` | SMALLINT | Sim | Só para cartão, quando a instituição informa |
| `installment_total` | `installmentTotal` | SMALLINT | Sim | Idem |
| `sync_status` | `syncStatus` | ENUM(`pending`,`processing`,`success`,`error`) | Não | Ver Transições de estado |
| `transactions_ms_id` | `transactionsMsId` | UUID | Sim | Id retornado pelo Transactions MS após import bem-sucedido |
| `retry_count` | `retryCount` | SMALLINT | Não | Default `0`; incrementado a cada tentativa de import falha |
| `last_error` | `lastError` | TEXT | Sim | Mensagem da última falha de import (nunca segredo/PII sensível) |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | TIMESTAMPTZ | Não | |

**Unicidade**: `(user_id, pluggy_transaction_id)` único — garante que uma
transação da Pluggy nunca gere duas linhas (base do R6).

## Índices

- `bank_connection`: único em `(user_id, pluggy_item_id)`; índice em `user_id`.
- `linked_account` / `linked_credit_card`: único em `(bank_connection_id, pluggy_account_id)`; índice em `user_id`.
- `synced_transaction`: único em `(user_id, pluggy_transaction_id)`; índice em
  `(sync_status)` (usado pelo job de retry); índice em `linked_account_id` e
  em `linked_credit_card_id`.

## Invariantes

- Toda linha de `linked_account`, `linked_credit_card` e `synced_transaction`
  pertence a exatamente um `bank_connection`, que pertence a exatamente um
  `user_id` — nenhuma consulta do banking-ms roda sem filtro por `user_id`
  (FR-015, AGENTS.md regra 2).
- `synced_transaction.linked_account_id` e `linked_credit_card_id` são
  mutuamente exclusivos: exatamente um dos dois é não-nulo (checagem de
  domínio + `CHECK` constraint no banco).
- Um `bank_connection` nunca é apagado por remoção do usuário (FR-014): a
  remoção só altera `status` para `disconnected`; suas contas/cartões/
  transações permanecem, congeladas, para leitura.
- `sync_status = success` implica `transactions_ms_id` preenchido;
  `sync_status = error` nunca gera uma segunda linha para o mesmo
  `pluggy_transaction_id` — apenas atualiza `retry_count`/`last_error` na
  mesma linha.

## Transições de estado

### Bank Connection

```
                 conexão concluída com sucesso
   (não persiste)  ─────────────────────────────►  active
        ▲                                              │
        │                                   credencial expira /
   tentativa falha                          reautenticação exigida /
   (US1 cenário 2,                          import falha após retries
    edge case)                              esgotados (FR-012)
                                                        │
                                                        ▼
                                              needs_attention
                                                        │
                                          reautenticação concluída (US5)
                                                        │
                                                        ▼
                                                     active

   active ou needs_attention ──── usuário remove a conexão (FR-014) ───► disconnected
                                                                          (histórico
                                                                           read-only,
                                                                           sem novo sync)
```

### Synced Transaction (`sync_status`)

```
pending ──► processing ──► success
               │  ▲
               │  │ retry (job de retry, backoff exponencial)
               ▼  │
             error ──── retries esgotados ────► (permanece "error";
                                                   Bank Connection vira
                                                   needs_attention, FR-012)
```

## Regras derivadas de criação

- Ao concluir o consentimento no Pluggy Connect (webhook `item/created` ou
  retorno do widget), o banking-ms cria o `bank_connection` com
  `status = active` e imediatamente dispara o primeiro `sync-connection`
  (busca inicial de contas, cartões e histórico de transações, FR-007/FR-008).
- Cada conta/cartão retornado pela Pluggy vira uma linha em `linked_account`
  ou `linked_credit_card`, decidido pelo tipo Pluggy (`BANK` → conta,
  `CREDIT` → cartão).
- Cada transação retornada pela Pluggy para uma conta/cartão vira uma linha em
  `synced_transaction` com `sync_status = pending`; o import para o
  Transactions MS acontece de forma assíncrona (mesmo processo, mas
  desacoplado do fetch) para não bloquear a resposta do sync na latência do
  Transactions MS.
- Atualizações de uma transação já sincronizada (correção de valor/data/
  descrição na origem) atualizam a linha existente (por
  `pluggy_transaction_id`) e, se já estava `success`, reabrem o import
  (`sync_status` volta para `pending`) para propagar a correção ao
  Transactions MS.
- Remoção da transação na origem remove a linha correspondente em
  `synced_transaction` e solicita a remoção da transação já importada no
  Transactions MS (mesmo `Idempotency-Key`/referência).

## Referências externas

- `transactions.source` / `transactions.external_id` (novas colunas no
  `services/api`, ver `research.md` R7) — não pertencem a este schema, mas são
  o destino do import; documentadas também em
  `contracts/transactions-import-api.md`.
- `user_id` referencia o mesmo identificador de usuário do Keycloak usado em
  todo o restante do sistema (não há FK física entre bancos de dados de
  serviços diferentes).
