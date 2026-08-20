# Contract: Banking Integration MS API (exposta ao BFF)

API HTTP exposta pelo `services/banking-ms`, chamada pelo módulo
`bank-connections` do `services/bff` (que apenas repassa o token do usuário e
o `Idempotency-Key`, sem lógica própria — regra 6 do AGENTS.md). Todas as
rotas exigem `Authorization: Bearer <JWT do usuário>` e operam apenas sobre os
dados do `userId` do próprio token (FR-015).

## `POST /connect-tokens`

Gera um token de curta duração para inicializar o widget Pluggy Connect no
frontend.

**Request body**:

```json
{
  "mode": "create"
}
```

Ou, para reautenticar uma conexão existente:

```json
{
  "mode": "reauth",
  "bankConnectionId": "b6b9b8b0-....."
}
```

**Response 201**:

```json
{
  "connectToken": "eyJhbGciOi...",
  "expiresAt": "2026-08-19T15:30:00Z"
}
```

| Erro | Quando |
|---|---|
| 404 | `mode: "reauth"` com `bankConnectionId` que não pertence ao usuário |
| 502 | Falha ao gerar o token na Pluggy |

## `POST /bank-connections` (conclusão da conexão)

Chamado pelo frontend após o widget Pluggy Connect retornar um `itemId` com
sucesso.

**Request**:

```json
{
  "pluggyItemId": "9f6c...."
}
```

**Response 201**:

```json
{
  "id": "b6b9b8b0-....",
  "institutionName": "Banco Exemplo",
  "status": "active",
  "createdAt": "2026-08-19T15:31:00Z"
}
```

| Erro | Quando |
|---|---|
| 409 | Já existe um Bank Connection ativo para `(userId, itemId)` (FR-004) |
| 422 | `itemId` inválido ou ainda não concluído do lado da Pluggy |

## `GET /bank-connections`

Lista as conexões do usuário autenticado, com suas contas e cartões.

**Response 200**:

```json
[
  {
    "id": "b6b9b8b0-....",
    "institutionName": "Banco Exemplo",
    "status": "active",
    "lastSyncedAt": "2026-08-19T08:00:00Z",
    "accounts": [
      { "id": "...", "displayName": "Conta Corrente", "type": "CHECKING_ACCOUNT", "balance": "1234.56", "currency": "BRL" }
    ],
    "creditCards": [
      { "id": "...", "brand": "visa", "lastDigits": "4321", "currentBalance": "540.10", "creditLimit": "5000.00" }
    ]
  }
]
```

## `POST /bank-connections/:id/refresh`

Dispara um refresh manual (US4, cenário 2). Assíncrono: dispara o sync e
retorna imediatamente; o estado atualizado aparece no próximo `GET`.

**Response 202**: `{ "status": "refreshing" }`

| Erro | Quando |
|---|---|
| 404 | Conexão não existe ou não pertence ao usuário |
| 409 | Conexão está `disconnected` |

## `DELETE /bank-connections/:id`

Remove a conexão (FR-014): marca `status = disconnected`, para o
sync automático; contas/cartões/transações já sincronizados continuam
visíveis via `GET /bank-connections?includeDisconnected=true` e nas listas de
transação (histórico read-only).

**Response 204**.

## `GET /bank-connections/:id/transactions`

Lista as `Synced Transaction` de uma conexão (uso interno de tela de detalhe;
a lista principal de transações do app vem do Transactions MS via
`source = 'synced'`, ver `transactions-import-api.md`).

**Response 200**: array de transações com `description`, `amount`, `date`,
`direction`, `pluggyStatus`, `installmentNumber`/`installmentTotal`,
`syncStatus`.

## `POST /webhooks/pluggy`

Recebido diretamente da Pluggy (não do BFF). Protegido por verificação de
assinatura (`pluggy-webhook.guard.ts`), não por JWT de usuário — rota
`@Public` do ponto de vista do Keycloak, mas ainda exige a assinatura válida
do payload.

**Eventos tratados**: `item/created`, `item/updated`, `item/error`,
`transactions/created`, `transactions/updated`, `transactions/deleted`.

**Response 200**: `{ "received": true }` (sempre, mesmo em erro de
processamento interno — para não fazer a Pluggy re-tentar indefinidamente;
falhas internas viram `sync_status = error` retentável pelo job próprio).

## Regra transversal

- Toda rota (exceto o webhook) resolve `userId` do `AuthenticatedUser` do
  `@finance/auth`; nenhuma rota aceita `userId` no corpo ou em query string.
- `POST /bank-connections` e `POST /bank-connections/:id/refresh` aceitam
  `Idempotency-Key`; o BFF sempre a propaga quando o cliente a envia.
- Nenhuma resposta desta API inclui credenciais bancárias, o `client_secret`
  da Pluggy ou o token de serviço usado internamente para falar com o
  Transactions MS.
