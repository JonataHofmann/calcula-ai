# ADR-013: Banking Integration MS como Serviço Deployável Separado

## Context

O app precisa integrar contas correntes e cartões de crédito de bancos reais
via Pluggy (Open Finance), sincronizando transações periodicamente e a partir
de webhooks. Essa integração depende de credenciais de terceiro (`client_id`/
`client_secret` da Pluggy), de um segredo de webhook próprio
(`PLUGGY_WEBHOOK_SECRET`), de jobs assíncronos (retry com backoff) e de um
modelo de dados (`bank_connection`, `linked_account`, `linked_credit_card`,
`synced_transaction`) que não pertence a nenhum módulo existente do monólito
(`api`).

## Problem

Onde hospedar a integração com a Pluggy e a sincronização de transações
bancárias, de forma a:

- isolar credenciais e segredos de terceiro do restante do monólito;
- permitir failure/retry/scaling independentes do processamento de
  transações "normais" (manuais) do usuário;
- manter o Transactions MS (`services/api`) como dono único do agregado
  `transaction` e das regras de negócio sobre ele, sem duplicar schema?

## Decision

Novo serviço NestJS deployável separadamente, `services/banking-ms`, seguindo
a mesma Clean Architecture dos demais módulos (ADR-009):
`domain → application → infrastructure → presentation`. Ele possui:

- Seu próprio schema (`bank_connection`, `linked_account`,
  `linked_credit_card`, `synced_transaction`), com o `synced_transaction`
  guardando só o necessário para reconciliação (status de sync, retry count,
  `pluggyTransactionId`) — a transação de negócio em si vive no Transactions
  MS.
- Um adaptador `PluggyClient` na infraestrutura, único ponto de contato com a
  API da Pluggy; nenhum outro módulo referencia a Pluggy diretamente.
- Um `PluggyWebhookController` público (do ponto de vista do Keycloak),
  autenticado por HMAC via `PluggyWebhookGuard` em vez de JWT de usuário —
  Pluggy não carrega um token de sessão do usuário.
- Escrita de transações no Transactions MS **apenas via HTTP**, através da
  porta `TransactionsImporter` (`domain/transactions-importer.port.ts`) e do
  adaptador `TransactionsMsImporterAdapter`, autenticado por client-credentials
  do Keycloak (service account), nunca acesso direto ao schema de
  `transactions`.
- Jobs de retry (`retry-imports.job.ts`) com backoff exponencial rodando
  dentro do próprio serviço, sem acoplar o scheduler do monólito.

## Alternatives

- **Módulo dentro do monólito `api`** (como `categories`, `accounts`,
  `cards`): mais simples de início, mas mistura credenciais de terceiro e
  jobs assíncronos de retry no mesmo processo/deploy do CRUD financeiro
  principal; uma falha ou vazamento na integração Pluggy afeta o monólito
  inteiro; rejeitada.
- **Escrita direta no schema de `transactions` a partir do banking-ms**:
  mais rápido, mas quebra o isolamento do agregado (ADR-002/ADR-009) e
  duplica regras de validação/negócio já centralizadas no Transactions MS;
  rejeitada.
- **Fila assíncrona (ex.: mensageria) para importar transações em vez de
  HTTP síncrono**: adiciona infraestrutura extra sem necessidade clara no
  volume atual; HTTP com idempotency key (`Idempotency-Key:
  banking-ms:<pluggyTransactionId>`) já cobre a reconciliação; descartada por
  ora, revisitável se o volume crescer.

## Consequences

- Credenciais da Pluggy e o segredo do webhook ficam confinados ao processo
  `banking-ms`; nenhum outro serviço precisa deles.
- Deploy, scaling e observabilidade da sincronização bancária são
  independentes do Transactions MS e do restante do monólito — uma falha ou
  lentidão na Pluggy não degrada o CRUD financeiro principal.
- Custo: um HTTP hop a mais para cada transação importada/atualizada/deletada
  (aceito; a Idempotency-Key torna esse hop seguro para retry) e um serviço a
  mais para operar e monitorar.
- O Transactions MS permanece o único dono do agregado `transaction`; o
  banking-ms nunca lê nem escreve nesse schema diretamente.
