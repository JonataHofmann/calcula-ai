# Research: Pluggy Bank Integration

## R1 — Integração com a API da Pluggy: SDK oficial vs. REST direto

**Decisão**: Consumir a API REST da Pluggy diretamente via `fetch`, encapsulada
em um único adapter (`pluggy-client.adapter.ts`) atrás da porta
`pluggy-client.port.ts`, sem adicionar o SDK oficial (`pluggy-sdk`) como
dependência.

**Racional**: Nenhum outro serviço do monorepo usa SDKs de terceiros para
integrações externas (o padrão observado é cliente HTTP fino, ex.:
`services/bff/src/shared/api-client.ts`); manter o mesmo padrão evita uma
dependência a mais para revisar/atualizar e deixa o acoplamento com a Pluggy
inteiramente atrás de uma porta de domínio, facilitando testes com mocks HTTP.
A superfície da API usada é pequena (auth, connect token, items, accounts,
transactions, webhooks) e estável o suficiente para não justificar um SDK.

**Alternativas rejeitadas**: SDK oficial da Pluggy — rejeitado por introduzir
uma dependência externa adicional sem necessidade real, quando um cliente HTTP
fino já resolve e mantém consistência com o resto do monorepo.

## R2 — Autenticação do usuário com a Pluggy (nunca ver a senha do banco)

**Decisão**: O fluxo de conexão usa o widget Pluggy Connect, hospedado pela
própria Pluggy no navegador do usuário. O banking-ms nunca recebe nem
armazena credenciais bancárias — ele apenas: (1) gera um `connect token`
de curta duração (chamando `POST /connect_token` na Pluggy, autenticado com a
API key do banking-ms) que o frontend usa para inicializar o widget; (2)
recebe de volta um `itemId` quando o usuário conclui o consentimento no
widget; (3) usa esse `itemId` para buscar accounts/transactions via a API da
Pluggy.

**Racional**: Atende diretamente FR-001 ("sem o app ver ou armazenar a
credencial") e ao modelo de consentimento padrão de Open Finance da Pluggy.

**Alternativas rejeitadas**: Proxyar a tela de login do banco através do
próprio app — rejeitada pois violaria FR-001 e o próprio modelo de segurança
da Pluggy (Connect é sempre client-side, hospedado por eles).

## R3 — Mecanismo de sincronização: webhook vs. polling

**Decisão**: Webhook da Pluggy (`item/created`, `item/updated`, `item/error`,
`transactions/created`, `transactions/updated`, `transactions/deleted`) como
mecanismo primário de atualização, com validação de assinatura
(`pluggy-webhook.guard.ts`); complementado por um job diário
(`daily-sync.job.ts`, `@nestjs/schedule`) que dispara `PATCH /items/{id}`
(force refresh) para qualquer conexão ativa sem sync bem-sucedido nas últimas
20h, garantindo o SC-003 ("ao menos uma vez por dia") mesmo se algum webhook
se perder. O refresh manual (US4) chama a mesma rota de force-refresh sob
demanda.

**Racional**: A Pluggy já entrega os eventos relevantes via webhook, e usar
apenas isso teria latência ótima; mas depender 100% de webhook é frágil
(entrega não garantida). O job diário como rede de segurança é barato e cobre
exatamente o requisito mínimo do SC-003 sem exigir infraestrutura de fila
adicional.

**Alternativas rejeitadas**: Polling puro (sem webhook) — rejeitado por gerar
mais chamadas à Pluggy que o necessário e atualização mais lenta que o
usuário poderia perceber ao voltar ao app logo após uma transação nova.
Webhook puro (sem job de segurança) — rejeitado por não garantir de forma
confiável o SC-003 caso um evento se perca.

## R4 — Persistência e schema

**Decisão**: Uma única instância PostgreSQL (a já existente no
`docker-compose.yml`), banco `finance`, em um schema Postgres dedicado
`banking`, com seu próprio `DataSource`/migrations TypeORM independentes das
migrations do `services/api`.

**Racional**: Isola logicamente os dados do banking-ms sem introduzir uma
instância de banco nova (custo operacional extra não justificado pelo escopo
atual); um schema dedicado já impede, por construção, que o banking-ms leia
ou escreva nas tabelas do Transactions MS, reforçando a regra da spec ("MUST
NOT directly write to the Transactions microservice database") mesmo antes de
qualquer verificação em nível de aplicação.

**Alternativas rejeitadas**: Banco de dados Postgres totalmente separado —
rejeitado por hoje não haver requisito de escala/isolamento físico que
justifique a infraestrutura extra; pode ser revisitado se o volume de dados
ou requisitos de compliance mudarem.

## R5 — Comunicação banking-ms → Transactions MS (import de transações)

**Decisão**: Nova rota `POST /transactions/synced-import` no módulo
`transactions` existente do `services/api`, chamada via HTTP pelo banking-ms.
Como o job de sync automático roda sem uma sessão de usuário ativa, o
banking-ms se autentica com um **token de serviço Keycloak** (client
credentials grant, client confidencial `banking-ms-service`, com uma role
dedicada `svc-transactions-import`). O `services/api` ganha um guard adicional
(`service-account.guard.ts`) que aceita esse token — ainda verificado
criptograficamente pelo `KeycloakTokenVerifier` do `@finance/auth`, só que sem
`sub` de usuário — **apenas** nessa rota específica; o `userId` do dono da
transação vem então explícito no corpo da requisição (o banking-ms já o
conhece, pois é o dono do Bank Connection que originou a transação,
estabelecido no momento da conexão sob uma sessão real do usuário).

**Racional**: A regra "userId só de JWT verificado" (AGENTS.md, regra 2) visa
impedir que um chamador não confiável (frontend, AI-MS) informe um `userId`
arbitrário; aqui o chamador é um serviço interno autenticado por credencial
própria no mesmo Keycloak, com uma role que só ele possui, restrita a uma
única rota de efeito bem definido (idempotente, ver R6). Chamar o
Transactions MS por HTTP (em vez de acessar o banco dele diretamente) é
exatamente o que a spec exige ("Communication MUST happen through the
Transactions microservice API").

**Alternativas rejeitadas**: Usar `packages/events` (barramento em memória)
como "interface de mensageria explícita" citada na spec — rejeitado porque o
barramento atual é apenas in-process (não sobrevive a múltiplos processos/
serviços), então não serve para comunicação entre dois serviços deployados
separadamente; introduzir um broker real (Kafka/RabbitMQ) foi rejeitado por
violar a regra 8 do AGENTS.md sem necessidade comprovada — HTTP síncrono já
atende ao volume e à criticidade do caso de uso. Repassar o JWT do usuário
para o job de background — rejeitado porque não existe sessão de usuário viva
durante o cron; tokens de usuário expiram e não devem ser persistidos para
reuso posterior.

## R6 — Idempotência do import e reconciliação

**Decisão**: Cada `Synced Transaction` carrega o `pluggy_transaction_id`
(imutável do lado da Pluggy) como base do `Idempotency-Key` enviado em
`POST /transactions/synced-import` (`banking-ms:<pluggyTransactionId>`). O
novo use case `import-synced-transaction` no `services/api` é idempotente por
essa chave: uma segunda chamada com a mesma chave retorna o mesmo resultado
sem criar uma segunda transação. O status de sync (`pending` → `processing` →
`success`/`error`) fica no banking-ms; falhas ficam retentáveis (job
`retry-imports.job.ts`, backoff exponencial, limite configurável de
tentativas) e, ao esgotar as tentativas, o Bank Connection é marcado "needs
attention" (FR-012).

**Racional**: Atende FR-011 (reconciliar sem duplicar) e ao requisito
explícito da Architecture section ("MUST be able to retry imports left in an
error status without creating duplicate transactions"). Ancorar a chave de
idempotência no id da transação na Pluggy (e não em um UUID interno gerado a
cada tentativa) é o que garante que retries realmente sejam idempotentes.

**Alternativas rejeitadas**: Deduplicar por `(descrição, valor, data)` —
rejeitado porque a própria spec já define um caso em que esses três campos
mudam por correção da instituição e ainda assim deve ser tratado como update,
não como novo registro; usar um id gerado localmente a cada tentativa de
import — rejeitado por não ser estável entre retries.

## R7 — Distinguir transação manual vs. sincronizada (FR-016)

**Decisão**: Adicionar um campo `source: 'manual' | 'synced'` (mais
`externalId` opcional) ao `transactionSchema` existente
(`packages/contracts/src/transactions/transaction.ts`) e à tabela
`transactions` do `services/api`, via migration. `POST /transactions/synced-import`
sempre grava `source = 'synced'`; todos os fluxos existentes de criação
continuam gravando `source = 'manual'` por padrão.

**Racional**: É o requisito literal de FR-016 ("merge... tagging each
transaction with its source"). Fazer isso no nível do dado (não apenas na UI)
é o que garante que as duas origens nunca sejam contadas em duplicidade e que
o dado continue correto mesmo fora da tela do dashboard.

**Alternativas rejeitadas**: Manter uma view/tabela separada só de transações
sincronizadas e fazer o merge em tempo de leitura no BFF/web — rejeitado por
exigir lógica de merge duplicada em cada tela que lista transações, além de
arriscar contagens divergentes entre telas; a spec já pede explicitamente que
elas fiquem na "mesma lista".

## R8 — Modelagem de Linked Account / Linked Credit Card vs. Account / Credit Card existentes

**Decisão**: `Linked Account` e `Linked Credit Card` são entidades novas,
propriedade exclusiva do banking-ms (schema `banking`), e **não** as mesmas
linhas de `accounts`/`credit_cards` do API-MS. Elas só aparecem na própria
tela de conexões (`apps/web/features/bank-connections`), sob a conexão a que
pertencem.

**Racional**: A spec só exige que as **transações** sincronizadas se fundam à
lista existente (FR-016); contas e cartões vindos da Pluggy têm atributos
próprios (ex.: saldo/limite vindos diretamente do banco) que não mapeiam 1:1
para o modelo atual de `Account`/`CreditCard`, que é de manutenção manual pelo
usuário. Unificá-los agora seria escopo não pedido e criaria ambiguidade sobre
qual lado é a fonte de verdade do saldo.

**Alternativas rejeitadas**: Popular automaticamente as tabelas `accounts`/
`credit_cards` existentes a partir da Pluggy — rejeitada por estar fora do
escopo da spec e por exigir decidir reconciliação de saldo entre duas fontes,
o que a spec não trata.

## R9 — Status de Bank Connection

**Decisão**: `active | needs_attention | disconnected`. Uma tentativa de
conexão que falha (credenciais inválidas, MFA, instituição fora do ar) não
persiste nenhum registro de Bank Connection — segue diretamente o edge case
"a tentativa de conexão deve falhar de forma clara, sem deixar uma conexão
parcial/quebrada para trás".

**Racional**: O texto de Key Entities da spec menciona "active / needs
attention / error" como exemplo, mas nenhum cenário descreve uma conexão já
existente e persistida ficando em um estado de resting chamado "error"
diferente de "needs attention" — todo caminho de falha descrito (US1 cenário
2, US5, Edge Cases) ou impede a criação do registro ou o leva a "needs
attention". Modelar um quarto estado sem um gatilho ou tela associada
adicionaria um estado morto.

**Alternativas rejeitadas**: Adicionar um status `error` distinto de "needs
attention" — rejeitado por não ter nenhuma transição ou requisito funcional
que o diferencie de "needs attention" neste escopo.

## Resumo das decisões

| # | Tópico | Decisão |
|---|--------|---------|
| R1 | Cliente Pluggy | REST direto via `fetch`, sem SDK |
| R2 | Autenticação do usuário | Pluggy Connect widget; banking-ms nunca vê credenciais |
| R3 | Sincronização | Webhook como primário + job diário de força-refresh como rede de segurança |
| R4 | Persistência | Mesma instância Postgres, schema dedicado `banking` |
| R5 | banking-ms → Transactions MS | HTTP, nova rota `POST /transactions/synced-import`, token de serviço Keycloak |
| R6 | Idempotência/reconciliação | `Idempotency-Key` ancorada no `pluggy_transaction_id`; retry com backoff; "needs attention" ao esgotar tentativas |
| R7 | Origem da transação | Campo `source: 'manual' \| 'synced'` no `transactionSchema` existente |
| R8 | Linked Account/Card vs. Account/Card | Entidades novas e separadas, só visíveis na tela de conexões |
| R9 | Status de Bank Connection | `active \| needs_attention \| disconnected` (sem estado `error` de resting) |
