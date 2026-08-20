---
description: "Task list — Pluggy Bank Integration"
---

# Tasks: Pluggy Bank Integration

**Input**: Design documents from `/specs/006-pluggy-bank-integration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUÍDOS — a Definition of Done do `AGENTS.md` exige unit (domínio puro + use cases com ports mockados), integração (webhook/jobs contra Postgres de teste, guard de service account) e testes de componente (Vitest) na web.

**Organization**: Tarefas agrupadas por user story (US1 Conectar um banco P1, US2 Transações de conta P1, US3 Transações de cartão P1, US4 Sync automático/manual P2, US5 Recuperar conexão quebrada P3), cada uma implementável e testável de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos distintos, sem dependência de tarefa incompleta)
- Caminhos relativos à raiz do monorepo. Novo serviço = `services/banking-ms`; alterações existentes = `services/api`, `services/bff`; shared = `packages/*`; web = `apps/web`.

## Convenções do repo (AGENTS.md)

- Clean Architecture também no novo `banking-ms`: `domain → application → infrastructure → presentation`, igual `services/api`/`services/ai-ms`.
- `userId` só do JWT (`AuthenticatedUser`) em toda rota de usuário; a única exceção é `POST/PATCH/DELETE /transactions/synced-import*`, que aceita o token de serviço Keycloak validado por `service-account.guard.ts` — restrito a essas rotas, com `userId` explícito no corpo (regra 2 + R5/research.md).
- Dinheiro sempre NUMERIC/DECIMAL/string, nunca float (balance, creditLimit, amount).
- `services/banking-ms` nunca acessa o banco do Transactions MS diretamente — toda escrita passa por HTTP (`contracts/transactions-import-api.md`); nenhuma tabela nova entra em `packages/contracts` como API pública do BFF/web.
- Toda escrita financeira usa `Idempotency-Key`; import de transação sincronizada usa `banking-ms:<pluggyTransactionId>` (R6/research.md).
- BFF só proxia/repassa token e `Idempotency-Key`, sem lógica própria (regra 6, mesmo padrão de `transactions.controller.spec.ts`).
- Novo serviço deployável já justificado (ADR-004 como precedente) — não introduzir fila/broker novo (regra 8); scheduling via `@nestjs/schedule` (mesmo pacote já usado no monorepo).
- Nunca logar `client_secret` da Pluggy, `PLUGGY_WEBHOOK_SECRET` ou o token de serviço (regra 10).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Contratos base e dependências antes de qualquer código de domínio.

- [X] T001 Criar `packages/contracts/src/bank-connections/` com `bankConnectionSchema`, `linkedAccountSchema`, `linkedCreditCardSchema`, `syncedTransactionSchema`, `connectTokenInput` (`mode: 'create' | 'reauth'`, `bankConnectionId?`), `bankConnectionCreateInput` (`pluggyItemId`); re-exportar em `packages/contracts/src/index.ts` (imports `.js`).
- [X] T002 [P] Estender `packages/contracts/src/transactions/transaction.ts`: adicionar `source: 'manual' | 'synced'` (default `'manual'`) e `externalId?: string` ao `transactionSchema`; atualizar `packages/contracts/src/index.ts` se necessário.
- [X] T003 [P] Scaffold do novo serviço `services/banking-ms/` (`package.json`, `tsconfig.json`, `jest.config.ts`, `src/app.module.ts`, `src/main.ts` mínimos); adicionar `@nestjs/schedule` às deps de `services/banking-ms/package.json` (e de `services/api/package.json` se ainda não presente, para `daily-sync.job.ts`/`retry-imports.job.ts`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domínio, persistência, wiring e esqueletos compartilhados por TODAS as stories.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase.

- [X] T004 [P] Domínio: agregado em `services/banking-ms/src/modules/bank-connections/domain/bank-connection.ts` (`create`/`restore`; transições `active → needs_attention → active`, `active|needs_attention → disconnected`; invariante de unicidade `(userId, pluggyItemId)` delegada ao repositório).
- [X] T005 [P] Domínio: `services/banking-ms/src/modules/bank-connections/domain/linked-account.ts` e `linked-credit-card.ts` (invariantes: `balance`/`creditLimit`/`currentBalance` NUMERIC nunca float; `currency` `BRL` no MVP).
- [X] T006 [P] Domínio: `services/banking-ms/src/modules/bank-connections/domain/synced-transaction.ts` (XOR `linkedAccountId`/`linkedCreditCardId`; `direction` `credit|debit`; `pluggyStatus` `pending|posted`; transições de `syncStatus` `pending → processing → success|error`, `error` retentável sem gerar nova linha).
- [X] T007 [P] Domínio: `services/banking-ms/src/modules/bank-connections/domain/errors.ts` (`DuplicateConnectionError`, `ConnectionNotFoundError`, `InvalidPluggyItemError`, `ImportRetriesExhaustedError`).
- [X] T008 [P] Domínio: portas em `services/banking-ms/src/modules/bank-connections/domain/bank-connection.repository.ts` (symbol `BANK_CONNECTION_REPOSITORY`; create, findById/findByUserAndItem/findAllByUser escopados por `userId`, save, upsertLinkedAccount/Card, upsertSyncedTransaction por `(userId, pluggyTransactionId)`, findStaleActiveConnections(threshold), findErroredSyncedTransactions(retryLimit)), `pluggy-client.port.ts` (symbol `PLUGGY_CLIENT`: `createConnectToken`, `getItem`, `forceRefreshItem`, `listAccounts`, `listTransactions`) e `transactions-importer.port.ts` (symbol `TRANSACTIONS_IMPORTER`: `importTransaction`, `updateTransaction`, `deleteTransaction`).
- [X] T009 Infra: entidades TypeORM em `services/banking-ms/src/modules/bank-connections/infrastructure/persistence/entities/{bank-connection,linked-account,linked-credit-card,synced-transaction}.entity.ts` — depende de T004-T006.
- [X] T010 Infra: migration `services/banking-ms/src/modules/bank-connections/infrastructure/persistence/migrations/*-create-banking-schema.ts` (cria schema Postgres `banking`, tabelas `bank_connection`/`linked_account`/`linked_credit_card`/`synced_transaction`, únicos `(user_id, pluggy_item_id)` e `(user_id, pluggy_transaction_id)`, índices em `user_id` e `sync_status`, `CHECK` da regra XOR conta/cartão) — depende de T009.
- [X] T011 Infra: `services/banking-ms/src/modules/bank-connections/infrastructure/persistence/repositories/bank-connection.repository.ts` implementando a porta (todos os métodos de T008; `upsertSyncedTransaction` idempotente por `pluggy_transaction_id`) — depende de T008, T010.
- [X] T012 [P] Infra: `services/banking-ms/src/modules/bank-connections/infrastructure/pluggy/pluggy-client.adapter.ts` (cliente `fetch` fino autenticado com API key da Pluggy; `POST /connect_token`, `GET /items/:id`, `PATCH /items/:id` force-refresh, `GET /accounts?itemId=`, `GET /transactions?accountId=&from=`) implementa `pluggy-client.port.ts`.
- [X] T013 [P] Infra: `services/banking-ms/src/modules/bank-connections/infrastructure/pluggy/pluggy-webhook.guard.ts` (valida assinatura do payload com `PLUGGY_WEBHOOK_SECRET`; 401 se inválida).
- [X] T014 [P] Infra: `services/banking-ms/src/modules/bank-connections/infrastructure/transactions-importer/transactions-ms-importer.adapter.ts` (chama `services/api` via HTTP com token de serviço Keycloak client-credentials; envia `Idempotency-Key: banking-ms:<pluggyTransactionId>`) implementa `transactions-importer.port.ts`.
- [X] T015 Presentation + wiring: esqueleto de `services/banking-ms/src/modules/bank-connections/presentation/{bank-connections.controller.ts,pluggy-webhook.controller.ts,bank-connections.module.ts}` (DI do repositório, pluggy-client e transactions-importer) e registro em `services/banking-ms/src/app.module.ts` — depende de T011-T014.
- [X] T016 [P] API-MS: `services/api/src/common/auth/service-account.guard.ts` (aceita token Keycloak client-credentials com role `svc-transactions-import`, sem `sub` de usuário; verificado pelo `KeycloakTokenVerifier` do `@finance/auth`; restrito à(s) rota(s) de import).
- [X] T017 [P] API-MS: migration em `services/api/src/modules/transactions/infrastructure/persistence/migrations/` adicionando colunas `source` (`'manual'|'synced'`, default `'manual'`) e `external_id` (nullable, único por `user_id`) à tabela `transactions`.
- [X] T018 API-MS: esqueleto do use case `services/api/src/modules/transactions/application/use-cases/import-synced-transaction/` e rotas `POST /transactions/synced-import`, `PATCH /transactions/synced-import/:externalId`, `DELETE /transactions/synced-import/:externalId` em `services/api/src/modules/transactions/presentation/transactions.controller.ts`, protegidas por `service-account.guard.ts` — depende de T016, T017.
- [X] T019 [P] BFF: esqueleto `services/bff/src/bank-connections/{bank-connections.module.ts,bank-connections.controller.ts}` (proxy, sem lógica própria) registrado em `services/bff/src/app.module.ts`.
- [X] T020 [P] Web: esqueleto `apps/web/features/bank-connections/` (`bank-connections-api.ts` fetch ao BFF, `use-bank-connections.ts` hooks TanStack Query), rota `apps/web/app/(app)/bancos/page.tsx` e item no sidebar navigation.
- [X] T021 [P] Testes de domínio (Jest) em `services/banking-ms/src/modules/bank-connections/domain/*.spec.ts`: `bank-connection.spec.ts` (transições de estado) e `synced-transaction.spec.ts` (invariante XOR, transições de `syncStatus`).

**Checkpoint**: domínio + persistência + wiring dos dois serviços prontos — stories podem começar.

---

## Phase 3: User Story 1 — Conectar um banco pela primeira vez (Priority: P1) 🎯 MVP

**Goal**: Fluxo completo de consentimento via widget Pluggy Connect; ao concluir, a instituição aparece `active` com o primeiro sync (contas, cartões, até 12 meses de histórico); credenciais inválidas não deixam conexão parcial; instituição já conectada é rejeitada.

**Independent Test**: Conectar uma instituição sandbox pelo widget → `bank_connection` `active` em minutos, com contas/cartões e histórico sincronizados; repetir a mesma instituição/credenciais → `409` sem segunda conexão; credenciais inválidas → nenhum registro criado. (Cenários 1 e 2 do quickstart.)

### Tests for User Story 1 ⚠️

- [X] T022 [P] [US1] Unit `application/use-cases/create-connect-token/create-connect-token.spec.ts` e `application/use-cases/complete-connection/complete-connection.spec.ts` (sucesso cria `bank_connection` `active`; `(userId, itemId)` já existente → `DuplicateConnectionError`/409).
- [X] T023 [P] [US1] Unit `application/use-cases/sync-connection/sync-connection.spec.ts` (busca contas/cartões/transações via `pluggy-client.port` mockado, persiste `linked_account`/`linked_credit_card`/`synced_transaction` `pending`, dispara `transactions-importer.port` mockado por transação, atualiza `sync_status` e `last_synced_at`).
- [X] T024 [P] [US1] Integration `presentation/pluggy-webhook.controller.spec.ts` (assinatura válida vs. inválida; evento `item/created` aciona `complete-connection`).
- [X] T025 [P] [US1] BFF `services/bff/src/bank-connections/bank-connections.controller.spec.ts` (proxy de `POST /connect-tokens` e `POST /bank-connections`, sem lógica própria).
- [X] T026 [P] [US1] Web `apps/web/features/bank-connections/connect-flow.spec.tsx` (mock do widget Pluggy Connect) e `connections-list-view.spec.tsx` (lista com status/contas/cartões).

### Implementation for User Story 1

- [X] T027 [US1] Use case `application/use-cases/create-connect-token/create-connect-token.ts` (`mode: 'create'|'reauth'`) + rota `POST /connect-tokens` — depende de T015.
- [X] T028 [US1] Use case `application/use-cases/complete-connection/complete-connection.ts` (valida `itemId`, `409` se `(userId, itemId)` já existe, cria `bank_connection` `active`, dispara `sync-connection` de forma assíncrona) + rota `POST /bank-connections` — depende de T011, T027.
- [X] T029 [US1] Use case `application/use-cases/sync-connection/sync-connection.ts` (busca contas/cartões/transações via `pluggy-client.port`, upsert de `linked_account`/`linked_credit_card`, insere `synced_transaction` `pending`, chama `transactions-importer.port` por transação atualizando `sync_status`/`transactions_ms_id`/`last_error`, atualiza `last_synced_at`) — depende de T012, T014.
- [X] T030 [US1] Use case `application/use-cases/list-connections/list-connections.ts` + rota `GET /bank-connections` (retorna conexões com `accounts`/`creditCards` aninhados).
- [X] T031 [US1] Use case `application/use-cases/disconnect-connection/disconnect-connection.ts` (marca `status = disconnected`, para sync; contas/cartões/transações permanecem visíveis) + rota `DELETE /bank-connections/:id` (204, FR-014).
- [X] T032 [US1] `presentation/pluggy-webhook.controller.ts`: eventos `item/created`/`item/updated` acionam `complete-connection`/`sync-connection`; resposta sempre `200 { received: true }`.
- [X] T033 [US1] BFF `services/bff/src/bank-connections/bank-connections.controller.ts`: implementa proxy real de `POST /connect-tokens`, `POST /bank-connections`, `GET /bank-connections`, `DELETE /bank-connections/:id`, repassando `Idempotency-Key` quando enviada.
- [X] T034 [US1] Web: `apps/web/features/bank-connections/connect-flow.tsx` (abre o widget Pluggy Connect, trata sucesso/erro, chama `connect-tokens`/`bank-connections`), `connections-list-view.tsx` (lista com status, contas e cartões, botão "Desconectar"), `use-bank-connections.ts` (hooks), rota + item no sidebar.

**Checkpoint**: conectar, listar e desconectar uma instituição funciona ponta a ponta, incluindo o primeiro sync.

---

## Phase 4: User Story 2 — Ver transações de conta bancária sincronizada (Priority: P1)

**Goal**: Transações de contas sincronizadas aparecem na mesma lista de transações do app, marcadas `source: "synced"`, sem duplicatas, com atribuição correta quando há múltiplas contas na mesma conexão.

**Independent Test**: Após sync, transações de uma conta corrente aparecem na lista geral com `source: "synced"`; rodar o sync duas vezes seguidas não cria linhas novas. (Cenário 3 do quickstart.)

### Tests for User Story 2 ⚠️

- [X] T035 [P] [US2] Unit `application/use-cases/import-synced-transaction/import-synced-transaction.spec.ts` (idempotência por `Idempotency-Key`, grava `source: 'synced'` + `externalId`, replay retorna o mesmo resultado sem nova linha).
- [X] T036 [P] [US2] Integration `presentation/synced-import.controller.spec.ts` (`401` sem role `svc-transactions-import`, `400` corpo inválido, `409` `Idempotency-Key` reutilizada com corpo diferente).
- [X] T037 [P] [US2] Web: teste de componente da lista de transações existente exibindo indicador de origem (`source`) para itens sincronizados.

### Implementation for User Story 2

- [X] T038 [US2] Use case `application/use-cases/import-synced-transaction/import-synced-transaction.ts` completo (idempotência via `Idempotency-Key`, grava `transactions.source = 'synced'` + `external_id`) — depende de T018.
- [X] T039 [US2] Atualizar `toDto()`/listagem em `services/api/src/modules/transactions/presentation/transactions.controller.ts` para incluir `source`/`externalId` na resposta já existente (sem alterar contrato de criação manual).
- [X] T040 [US2] Web: lista de transações (`apps/web/features/transactions/`) exibe indicador visual para `source === 'synced'`, sem alterar totais/cálculos existentes.

**Checkpoint**: transações de contas sincronizadas aparecem corretamente na lista geral, sem duplicar em resyncs.

---

## Phase 5: User Story 3 — Ver transações de cartão de crédito, incluindo parceladas (Priority: P1)

**Goal**: Transações de cartão mostram `installmentNumber`/`installmentCount` quando disponíveis e indicam corretamente se aumentam ou reduzem o saldo da fatura (`direction`); uma transação que muda de `pending` para `posted` na origem atualiza a mesma linha, sem duplicar.

**Independent Test**: Sync de instituição sandbox com cartão parcelado mostra parcelas corretas; transação `pending` que vira `posted` atualiza a mesma linha. (Cenário 4 do quickstart.)

### Tests for User Story 3 ⚠️

- [X] T041 [P] [US3] Unit `PATCH /transactions/synced-import/:externalId` (atualização de `pending` → `posted` e de valor/data/descrição sem criar segunda transação).
- [X] T042 [P] [US3] Unit banking-ms: tratamento do evento `transactions/updated` em `sync-connection`/webhook (atualiza `synced_transaction` existente por `pluggy_transaction_id`; se já `success`, reabre import — `sync_status` volta a `pending`).
- [X] T043 [P] [US3] Web: teste de componente mostrando `installmentNumber`/`installmentCount` e ícone de `direction` (crédito/débito) na transação de cartão.

### Implementation for User Story 3

- [X] T044 [US3] Estender `transactions-importer.port.ts`/`transactions-ms-importer.adapter.ts` com `updateTransaction`/`deleteTransaction` (`PATCH`/`DELETE /transactions/synced-import/:externalId`) — depende de T014.
- [X] T045 [US3] API-MS: rota `PATCH /transactions/synced-import/:externalId` + use case de atualização parcial (`description`/`amount`/`dueDate`/`status`/`installmentNumber`/`installmentCount`).
- [X] T046 [US3] API-MS: rota `DELETE /transactions/synced-import/:externalId` + use case de remoção (edge case: identidade não correlacionável = remoção do registro antigo, tratado por US1's fluxo de criação).
- [X] T047 [US3] `presentation/pluggy-webhook.controller.ts`: eventos `transactions/updated` (atualiza `synced_transaction`, reabre import se necessário) e `transactions/deleted` (remove `synced_transaction` + chama `DELETE` no Transactions MS).
- [X] T048 [US3] Web: transação de cartão exibe `installmentNumber`/`installmentCount` e ícone de `direction` na lista de transações.

**Checkpoint**: transações de cartão, incluindo parceladas e atualizações pending→posted, aparecem corretamente sem duplicar.

---

## Phase 6: User Story 4 — Sync automático e manual (Priority: P2)

**Goal**: Conexões `active` sincronizam ao menos uma vez por dia sem ação do usuário; refresh manual dispara sync sob demanda.

**Independent Test**: Conexão sem sync há mais de 20h é atualizada pelo job diário; clicar em "Atualizar agora" retorna `202` e reflete dados novos no próximo `GET`. (Cenário 5 do quickstart.)

### Tests for User Story 4 ⚠️

- [X] T049 [P] [US4] Unit `application/use-cases/trigger-manual-refresh/trigger-manual-refresh.spec.ts` (`202` em conexão `active`, `409` em `disconnected`).
- [X] T050 [P] [US4] Integration `infrastructure/scheduling/daily-sync.job.spec.ts` contra Postgres de teste (só conexões `active` sem sync bem-sucedido nas últimas 20h disparam refresh).
- [X] T051 [P] [US4] Web: teste do botão "Atualizar agora" em `connections-list-view.spec.tsx`.

### Implementation for User Story 4

- [X] T052 [US4] Use case `application/use-cases/trigger-manual-refresh/trigger-manual-refresh.ts` + rota `POST /bank-connections/:id/refresh` (`202`/`409`) — depende de T011.
- [X] T053 [US4] `infrastructure/scheduling/daily-sync.job.ts` (`@nestjs/schedule`, cron diário; busca conexões `active` com `last_synced_at` nulo ou > 20h; dispara `sync-connection` via force-refresh do `pluggy-client.port`).
- [X] T054 [US4] BFF: proxy de `POST /bank-connections/:id/refresh` em `bank-connections.controller.ts`.
- [X] T055 [US4] Web: botão "Atualizar agora" em `connections-list-view.tsx` + mutation em `use-bank-connections.ts`.

**Checkpoint**: conexões se mantêm sincronizadas automaticamente e sob demanda.

---

## Phase 7: User Story 5 — Recuperar uma conexão quebrada (Priority: P3)

**Goal**: Conexão com credencial expirada ou falha persistente de import fica `needs_attention`; reautenticar pelo widget retorna a conexão para `active`.

**Independent Test**: Forçar evento `item/error` → conexão vira "precisa de atenção"; reautenticar pelo widget → volta a `active` e o sync recomeça; esgotar tentativas de import também marca `needs_attention`. (Cenário 6 do quickstart.)

### Tests for User Story 5 ⚠️

- [X] T056 [P] [US5] Unit `application/use-cases/retry-failed-imports/retry-failed-imports.spec.ts` (backoff exponencial; ao esgotar tentativas, `synced_transaction` permanece `error` e `bank_connection` vira `needs_attention`).
- [X] T057 [P] [US5] Unit `create-connect-token.spec.ts` modo `reauth` (valida que `bankConnectionId` pertence ao usuário, `404` caso contrário) e conclusão de reauth transicionando `needs_attention → active`.
- [X] T058 [P] [US5] Integration `pluggy-webhook.controller.spec.ts`: evento `item/error` → `bank_connection` vira `needs_attention`.
- [X] T059 [P] [US5] Web: teste do badge "precisa de atenção" e do botão "Reautenticar" em `connections-list-view.spec.tsx`.

### Implementation for User Story 5

- [X] T060 [US5] `infrastructure/scheduling/retry-imports.job.ts` + use case `application/use-cases/retry-failed-imports/retry-failed-imports.ts` (backoff exponencial, limite configurável de tentativas; ao esgotar, seta `bank_connection.status = needs_attention`, FR-012).
- [X] T061 [US5] `presentation/pluggy-webhook.controller.ts`: evento `item/error` → `bank_connection.status = needs_attention`.
- [X] T062 [US5] Estender `create-connect-token.ts` (T027) com o branch `mode: 'reauth'` (valida ownership do `bankConnectionId`).
- [X] T063 [US5] Estender `complete-connection.ts`/webhook (T028/T032) para tratar conclusão de reauth (`item/updated` bem-sucedido em conexão `needs_attention`) transicionando de volta para `active` e retomando o sync.
- [X] T064 [US5] Web: badge "precisa de atenção" em `connections-list-view.tsx` + botão "Reautenticar" (chama `connect-tokens` com `mode: 'reauth'` e reabre o widget).

**Checkpoint**: todas as user stories funcionais independentemente.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T065 [P] Registrar **ADR-013** (Banking Integration MS como serviço deployável separado, com fronteiras estritas via HTTP para o Transactions MS) em `docs/adr/`.
- [X] T066 [P] Auditar logs de `services/banking-ms` e do use case `import-synced-transaction` para garantir que `client_secret` da Pluggy, `PLUGGY_WEBHOOK_SECRET` e o token de serviço nunca são logados (regra 10). Auditoria: só 3 chamadas de logger em todo `services/banking-ms/src` (`domain-exception.filter.ts:45`, `retry-imports.job.ts:26`, `daily-sync.job.ts:29`), todas logando apenas dados derivados (status, ids), sem secrets. Nenhum `console.log/error/warn`. `client_secret`/corpo do service-account nunca passam para logger (só para `JSON.stringify` do fetch body). `PluggyWebhookGuard` não loga nada. Sem interceptor de request-logging. Nenhum vazamento encontrado.
- [ ] T067 Rodar validação do `quickstart.md` (cenários 1–7) end-to-end contra o sandbox da Pluggy. **BLOQUEADO neste ambiente**: requer credenciais reais do sandbox Pluggy, stack completa rodando (`docker-compose` + `pnpm dev` dos 4 serviços) e um client de service-account configurado no Keycloak, além de interação manual com o widget Pluggy Connect no navegador. Requer validação manual humana antes do go-live.
- [X] T068 [P] `pnpm lint` + `pnpm typecheck` + `pnpm test` verdes em `contracts`/`banking-ms`/`api`/`bff`/`web`. Lint e typecheck 100% verdes nos 5 pacotes. Testes: `contracts`/`banking-ms`/`api`/`bff` 100% verdes (283 testes). `web`: 80/86 verdes; as 6 falhas restantes (`sidebar.spec.tsx` ×1, `header.spec.tsx` ×5) são pré-existentes em `main`, não tocadas nesta sessão (confirmado via `git diff` vazio em `sidebar.tsx`, `header.tsx`, `period-selector.tsx` e specs) e não relacionadas à feature Pluggy/banking-ms.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — BLOQUEIA todas as stories.
- **User Stories (Phase 3–7)**: dependem da Foundational. US1 é MVP; US2/US3 dependem do primeiro sync já implementado em US1 (usam `sync-connection`/`import-synced-transaction`), mas são testáveis e entregáveis de forma independente uma vez que US1 exista. US4/US5 estendem casos de uso de US1 (`sync-connection`, `create-connect-token`, `complete-connection`) e podem seguir em paralelo entre si após US1.
- **Polish (Phase 8)**: depois das stories desejadas.

### User Story Dependencies

- **US1 (P1)**: após Foundational. Sem dependência de outras stories — é a base (conexão + primeiro sync).
- **US2 (P1)**: após Foundational; reaproveita `sync-connection`/`import-synced-transaction` de US1 para ter dados a exibir, mas seu próprio teste independente (idempotência do import, indicador de origem) não exige US1 completo, só os ports mockados.
- **US3 (P1)**: após Foundational; estende o mesmo pipeline de import de US2 (`transactions-importer.port`) — sequenciar US2 antes de US3 evita conflito nos mesmos arquivos (`transactions-ms-importer.adapter.ts`, `transactions.controller.ts`).
- **US4 (P2)**: após Foundational; reaproveita `sync-connection` (US1) para o refresh. Independente de US2/US3.
- **US5 (P3)**: após Foundational; estende `create-connect-token`/`complete-connection` (US1) e o pipeline de import (US2/US3, para o retry). Idealmente após US1–US3.

### Within Each User Story

- Testes primeiro (devem falhar antes da implementação).
- Domínio/porta → use case → controller/webhook → BFF → web.

### Parallel Opportunities

- Setup: T002/T003 [P].
- Foundational: T004-T008, T012-T014, T016, T017, T019-T021 [P] (arquivos distintos) após suas dependências.
- Dentro de cada story, tarefas [P] (testes, use cases/adapters em arquivos distintos, componentes web) rodam juntas.
- Após US1, US4 e US5 podem ser tocadas por devs distintos em paralelo (ambas estendem US1 mas em arquivos majoritariamente diferentes: jobs de scheduling vs. fluxo de reauth).

---

## Parallel Example: User Story 1

```bash
# Testes US1 juntos:
Task: "Unit create-connect-token/complete-connection em application/use-cases/*/*.spec.ts"
Task: "Unit sync-connection em application/use-cases/sync-connection/sync-connection.spec.ts"
Task: "Integration pluggy-webhook.controller.spec.ts"
Task: "BFF bank-connections.controller.spec.ts"
Task: "Web connect-flow.spec.tsx + connections-list-view.spec.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRÍTICO) → 3. Phase 3 US1 → 4. **VALIDAR** US1 isolada (Cenários 1–2) → 5. Phase 4 US2 → 6. Phase 5 US3 → 7. **VALIDAR** US1+US2+US3 juntas (Cenários 1–4) → 8. Deploy/demo. As três stories P1 (conectar, ver transações de conta, ver transações de cartão) formam o MVP real desta feature — nenhuma sozinha entrega valor completo sem as outras duas.

### Incremental Delivery

Foundational → US1 → US2 → US3 (MVP completo) → US4 → US5, cada uma testada e entregue sem quebrar as anteriores.

---

## Notes

- [P] = arquivos distintos, sem dependência incompleta.
- `services/banking-ms` nunca escreve diretamente no banco do Transactions MS — sempre via `POST/PATCH/DELETE /transactions/synced-import*` (regra 6/Architecture and Service Boundaries da spec).
- Money sempre NUMERIC/string; `userId` só do JWT (exceto a rota de import, via `service-account.guard.ts`); recurso de outro usuário → 404.
- Idempotência de import ancorada em `pluggy_transaction_id` (`Idempotency-Key: banking-ms:<pluggyTransactionId>`), nunca em UUID gerado a cada tentativa.
