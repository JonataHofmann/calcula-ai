# Quickstart: Pluggy Bank Integration

## Pré-requisitos

- Monorepo rodando via `docker-compose up` (Postgres + Keycloak) e
  `pnpm dev` nos serviços `api`, `bff`, `web` e no novo `banking-ms`.
- Credenciais de sandbox da Pluggy (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`)
  configuradas no `.env` do `banking-ms`, mais `PLUGGY_WEBHOOK_SECRET` e
  `PLUGGY_API_BASE_URL` (ambiente sandbox).
- Client Keycloak `banking-ms-service` criado (service accounts habilitado)
  com a role `svc-transactions-import`, e client role atribuída ao
  `services/api` reconhecer via `service-account.guard.ts`.
- Um usuário de teste autenticado no `apps/web` (mesmo fluxo de login já
  existente via Keycloak).
- Instituição de sandbox da Pluggy disponível para teste (ex.: conector de
  sandbox que expõe conta corrente e cartão de crédito).

## Cenário 1 — Conectar um banco pela primeira vez (US1, SC-001)

1. No `apps/web`, acessar a nova tela "Conectar banco" e clicar em "Conectar".
2. O frontend chama `POST /connect-tokens` (via BFF) e abre o widget Pluggy
   Connect com o token retornado.
3. Completar o consentimento no widget com as credenciais de sandbox.
4. O widget retorna um `itemId`; o frontend chama
   `POST /bank-connections` com esse `itemId`.

**Esperado**: a instituição aparece na lista de conexões com
`status: "active"` em poucos segundos; o primeiro sync busca contas, cartões
e até 12 meses de histórico de transações (FR-007/FR-008), completando o
fluxo em menos de 10 minutos (SC-001).

**Negativo**: informar credenciais inválidas no widget → a Pluggy retorna
erro antes do `itemId` existir; nenhum `bank_connection` é criado (sem
registro parcial), e o frontend mostra um erro claro permitindo tentar de
novo (US1 cenário 2).

## Cenário 2 — Conexão duplicada (US1 cenário 3, FR-004)

1. Repetir o Cenário 1 para a mesma instituição/credenciais já conectadas.

**Esperado**: `POST /bank-connections` retorna 409; a UI informa que a
instituição já está conectada, sem criar uma segunda conexão.

## Cenário 3 — Ver transações de conta bancária sincronizada (US2, SC-002)

1. Com uma conexão `active` que expõe uma conta corrente de sandbox, aguardar
   o primeiro sync (ou disparar `POST /bank-connections/:id/refresh`).
2. Abrir a lista de transações do app (`apps/web`, tela existente de
   transações/dashboard).

**Esperado**: as transações da conta sincronizada aparecem na mesma lista das
transações manuais, marcadas com `source: "synced"`, sem duplicatas e com
100% das transações que a Pluggy reporta para o período (SC-002).

**Negativo**: rodar o sync duas vezes seguidas sem novas transações na
origem → nenhuma transação nova é criada (idempotência por
`pluggy_transaction_id`, R6).

## Cenário 4 — Ver transações de cartão de crédito, incluindo parceladas (US3)

1. Repetir o Cenário 3 usando uma instituição de sandbox que exponha um
   cartão de crédito com ao menos uma compra parcelada.

**Esperado**: as transações do cartão aparecem com `installmentNumber`/
`installmentCount` quando a instituição fornece esse dado, e cada uma indica
corretamente se aumenta ou reduz o saldo da fatura (`direction`, FR-009).

**Negativo**: uma transação pendente no cartão (`pluggyStatus: "pending"`)
que depois é confirmada na origem → a mesma linha é atualizada para
`"posted"`, sem gerar uma segunda transação (US3 cenário 3).

## Cenário 5 — Sync automático e manual (US4)

1. Deixar uma conexão `active` sem interação por mais de 24h (ou, em teste,
   forçar o relógio do job `daily-sync.job.ts`).
2. Separadamente, clicar em "Atualizar agora" na tela de conexões.

**Esperado**: (1) o job diário dispara um refresh para qualquer conexão sem
`lastSyncedAt` recente, sem ação do usuário (SC-003); (2) o refresh manual
(`POST /bank-connections/:id/refresh`) retorna 202 e reflete dados novos
assim que o sync termina.

## Cenário 6 — Recuperar uma conexão quebrada (US5)

1. Simular expiração de credencial (revogar a conexão no painel de sandbox da
   Pluggy, ou forçar o evento de webhook `item/error`).
2. Verificar que a conexão aparece como "precisa de atenção" na UI.
3. Clicar em "Reautenticar", completar o widget novamente
   (`mode: "reauth"`, `POST /connect-tokens`).

**Esperado**: a conexão volta para `status: "active"` e o sync recomeça
(US5 cenário 2).

**Negativo relacionado (FR-012)**: forçar `POST /transactions/synced-import`
a falhar repetidamente para uma transação (ex.: desligando temporariamente o
`services/api`) até esgotar as tentativas do `retry-imports.job.ts` →
a transação permanece `sync_status: "error"` e a conexão dona é marcada
`needs_attention`, mesmo sinal do Cenário 6.

## Cenário 7 — Desconectar uma instituição (FR-014)

1. Em uma conexão `active` com transações já sincronizadas, clicar em
   "Desconectar".

**Esperado**: `DELETE /bank-connections/:id` retorna 204; a conexão passa
para `status: "disconnected"`, para de sincronizar, mas suas contas, cartões
e transações já importadas continuam visíveis (histórico read-only) tanto na
tela de conexões quanto na lista geral de transações.

## Testes automatizados (mapa)

- **banking-ms (unit)**: agregados de domínio (`bank-connection.ts`,
  `synced-transaction.ts`) — invariantes de transição de estado e a regra
  XOR conta/cartão; use cases (`sync-connection`, `retry-failed-imports`) com
  os ports (`pluggy-client.port.ts`, `transactions-importer.port.ts`)
  mockados.
- **banking-ms (integration)**: `pluggy-webhook.controller` com payloads de
  exemplo da Pluggy (assinatura válida/ inválida); `daily-sync.job` contra um
  Postgres de teste, verificando que só conexões vencidas disparam refresh.
- **api (unit/integration)**: novo use case `import-synced-transaction` —
  idempotência por `Idempotency-Key`, rejeição do `service-account.guard`
  sem a role correta, gravação correta de `source`/`externalId`.
- **bff**: `bank-connections.controller.spec.ts` — repasse de token e
  `Idempotency-Key`, sem lógica própria (mesmo padrão de
  `transactions.controller.spec.ts`).
- **web**: fluxo de conexão (mock do widget Pluggy Connect), lista de
  conexões mostrando status, e a lista de transações existente exibindo o
  indicador de origem (`source`) para itens sincronizados.
