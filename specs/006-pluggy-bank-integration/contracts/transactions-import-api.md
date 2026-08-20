# Contract: Import de transações sincronizadas no Transactions MS

Nova rota adicionada ao módulo `transactions` existente em `services/api`
(hoje o "Transactions MS" da spec). Único ponto de entrada usado pelo
`services/banking-ms` para gravar dados no Transactions MS — nunca há acesso
direto ao banco de dados dele (Architecture and Service Boundaries).

## `POST /transactions/synced-import`

**Autenticação**: token de serviço Keycloak (client credentials, role
`svc-transactions-import`), verificado pelo novo `service-account.guard.ts`
— não um JWT de usuário comum (ver R5 em `research.md`). Restrito a esta
única rota.

**Idempotência**: obrigatório header `Idempotency-Key`, valor
`banking-ms:<pluggyTransactionId>`. Uma segunda chamada com a mesma chave
retorna 200 com o resultado já existente, sem criar nova transação (FR-011).

**Request body**:

```json
{
  "userId": "3f2f....",
  "description": "Supermercado ABC",
  "amount": "245.90",
  "dueDate": "2026-08-18",
  "type": "expense",
  "accountId": null,
  "creditCardId": null,
  "source": "synced",
  "externalId": "pluggy-tx-9f6c1234",
  "pluggyStatus": "posted",
  "installmentNumber": 2,
  "installmentCount": 6
}
```

Observações:

- Exatamente um de `accountId` (referência ao `linked_account`, se aplicável
  a uma conta manual mapeada — no MVP, ver R8, este campo fica nulo pois
  Linked Account não é a mesma entidade de `Account`) ou `creditCardId` é
  aceito, seguindo o mesmo contrato de `POST /transactions` já existente.
- `source` é sempre `"synced"` nesta rota (a rota comum de criação continua
  gravando `"manual"` por padrão).
- `externalId` é o `pluggy_transaction_id`, gravado para permitir localizar a
  transação em updates/deletes subsequentes.

**Response 201** (primeira vez) **ou 200** (replay idempotente):

```json
{
  "id": "b3f9....",
  "source": "synced",
  "externalId": "pluggy-tx-9f6c1234",
  "pluggyStatus": "posted"
}
```

| Erro | Quando |
|---|---|
| 401 | Token de serviço ausente, inválido ou sem a role `svc-transactions-import` |
| 400 | Corpo inválido (mesma validação Zod de `POST /transactions`, mais os campos `source`/`externalId`) |
| 409 | `Idempotency-Key` já usada com um corpo diferente do original (conflito, não replay) |

## `PATCH /transactions/synced-import/:externalId`

Usada quando a origem corrige uma transação já importada (valor/data/
descrição) ou quando ela passa de `pending` para `posted` na instituição.

**Request body**: subconjunto de campos alterados (`description`, `amount`,
`dueDate`, `pluggyStatus`, `installmentNumber`, `installmentCount`).

**Response 200**: mesmo formato de `POST`.

| Erro | Quando |
|---|---|
| 404 | Nenhuma transação com esse `externalId` para o `userId` informado |

## `DELETE /transactions/synced-import/:externalId`

Usada quando a transação é removida na origem (Pluggy) ou quando sua
identidade muda tanto que não pode mais ser correlacionada (edge case da
spec: trata-se como remoção do registro antigo + criação de um novo via
`POST`).

**Response 204**.

## Regra transversal

- Todas as três rotas exigem o `userId` explícito no corpo/rota — nunca
  inferido de um JWT de usuário, pois o chamador é o banking-ms agindo em
  nome de muitos usuários durante o sync automático; o `userId` usado é
  sempre o mesmo já registrado no `bank_connection` que originou a
  transação (nunca fornecido por um cliente não confiável, como frontend ou
  AI-MS).
- Estas rotas nunca aparecem em `packages/contracts` como parte da API pública
  do Transactions MS usada pelo BFF/web — são exclusivas do canal de serviço
  a serviço.
- Toda transação criada por aqui tem `source = 'synced'` e nunca é editável
  pelas rotas comuns de edição manual de transação além do necessário para
  categorização (a spec mantém o Transactions MS como responsável por
  "categorization, editing, deletion, and presentation").
