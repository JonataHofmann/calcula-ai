# Implementation Plan: Pluggy Bank Integration

**Branch**: `006-pluggy-bank-integration` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-pluggy-bank-integration/spec.md`

## Summary

Criar um novo microserviço, `services/banking-ms`, responsável exclusivamente por
integrar com a Pluggy (Open Finance) para permitir que o usuário conecte bancos e
cartões de crédito e tenha suas transações sincronizadas automaticamente. O
banking-ms nunca vê credenciais bancárias (o consentimento acontece via Pluggy
Connect, widget hospedado pela Pluggy), mantém seu próprio histórico de
sincronização (Bank Connection, Linked Account, Linked Credit Card, Synced
Transaction) e importa cada transação descoberta no Transactions MS existente
(hoje o módulo `transactions` dentro de `services/api`) através de uma nova rota
HTTP dedicada, nunca por acesso direto ao banco de dados do API-MS. Cada
transação sincronizada carrega um status de sincronização (pending / processing
/ success / error) que sustenta reconciliação e retry sem duplicar dados no
Transactions MS; falhas persistentes de import re-usam o status "needs
attention" já existente para conexões com credenciais quebradas.

## Technical Context

**Language/Version**: TypeScript ^5.7.3, Node.js >=22

**Primary Dependencies**: NestJS ^11 (`@nestjs/common`, `@nestjs/core`,
`@nestjs/platform-express`), TypeORM ^0.3.20 + `pg` ^8.13.1, `@nestjs/schedule`
(novo — cron do sync diário e do job de retry), Zod via `@finance/contracts`,
`@finance/auth` (verificação de JWT Keycloak), `@finance/config`,
`@finance/logger`, `@finance/observability`, cliente HTTP nativo (`fetch`) para
falar com a API REST da Pluggy e com o Transactions MS — sem SDK de terceiros
para manter a mesma superfície de dependências dos demais serviços.

**Storage**: PostgreSQL 17 (mesma instância `postgres` do `docker-compose.yml`,
banco `finance`), em schema Postgres dedicado `banking` com suas próprias
migrations TypeORM — isolado logicamente das tabelas do API-MS mesmo
compartilhando a instância física.

**Testing**: Jest (unit + integration) no padrão dos demais serviços NestJS do
monorepo; contract tests para a integração com a API do Transactions MS
(`POST /transactions/synced-import`) usando mocks HTTP.

**Target Platform**: Serviço HTTP Node.js containerizável, mesmo padrão de
deploy dos demais `services/*` (Linux server / container).

**Project Type**: Web application (monorepo com `apps/` + `services/` +
`packages/`) — esta feature adiciona um novo serviço em `services/`.

**Performance Goals**: Sincronização automática de cada conexão ao menos uma
vez por dia (SC-003); refresh manual deve refletir dados novos em poucos
segundos além do tempo de resposta da própria Pluggy; suportar ao menos 5
instituições conectadas por usuário sem degradação perceptível (SC-005).

**Constraints**: Nunca armazenar credenciais bancárias do usuário (FR-001); não
escrever diretamente no banco do Transactions MS (Architecture and Service
Boundaries); nunca duplicar transações já importadas em retries (FR-011,
FR-012); dados de um usuário nunca visíveis a outro (FR-015, SC-006); `userId`
só pode vir de um JWT verificado (AGENTS.md, regra 2).

**Scale/Scope**: MVP cobre US1-US3 (P1: conectar, ler transações de conta e de
cartão) e US4 (P2: sync automático + manual); US5 (P3: recuperação de conexão
quebrada) reaproveita o mesmo status "needs attention" já desenhado para US1.

## Constitution Check

*GATE: Deve passar antes da Fase 0. Reavaliado após a Fase 1.*

Não existe `.specify/memory/constitution.md` preenchido neste repositório; as
regras de governança usadas como constituição são as do `AGENTS.md`.

| Regra (AGENTS.md) | Status | Observação |
|---|---|---|
| 1. Dinheiro como NUMERIC/DECIMAL, nunca float | PASS | `linked_account.balance`, `linked_credit_card.*_limit/balance` e `synced_transaction.amount` são `NUMERIC(14,2)`; contratos expõem string decimal. |
| 2. `userId` só de JWT verificado | PASS (com nota) | Endpoints do banking-ms chamados pelo usuário exigem `AuthenticatedUser` via `@finance/auth`, igual ao API-MS. O job de sync automático (sem sessão de usuário) e o import no Transactions MS usam um token de serviço Keycloak dedicado — ver R5 em `research.md` para o desenho e as restrições desse caminho. |
| 3. AI-MS só acessa dados via API-MS | N/A | Feature não envolve o AI-MS. |
| 4. Clean Architecture (`domain/application/infrastructure/presentation`) | PASS | `services/banking-ms` segue a mesma estrutura de camadas do `services/api`. |
| 5. Redux Toolkit = client state, TanStack Query = server state | PASS | Tela de conexões no `apps/web` usa TanStack Query para ler/mutar conexões; nenhum estado de servidor entra no Redux. |
| 6. BFF só agrega/molda contrato | PASS | `services/bff` expõe um módulo `bank-connections` que apenas repassa a chamada (token do usuário, `Idempotency-Key`) ao banking-ms, sem regra de negócio. |
| 7. Idempotência em escritas financeiras | PASS | Toda chamada de import usa `Idempotency-Key` derivada do id da transação na Pluggy; criação de conexão idempotente por `(userId, institution, itemId)` (FR-004). |
| 8. Sem complexidade prematura (sem microsserviço/broker/Base-classes não justificados) | **DESVIO JUSTIFICADO** | A própria especificação (seção "Architecture and Service Boundaries") exige um serviço novo e isolado. Isso segue o precedente já aberto pela ADR-004 (AI-MS): um serviço separado é aceitável quando o workload tem perímetro de segurança/compliance distinto (aqui: credenciais/webhooks de um provedor externo, Open Finance) e ele fala com o serviço existente só por HTTP, nunca por SQL direto. Ver Complexity Tracking abaixo; recomenda-se registrar isso como ADR-013. |
| 9. Entidades TypeORM só em `infrastructure/persistence/entities`, schema via migration | PASS | Mesma convenção do API-MS. |
| 10. Nunca logar segredos | PASS | `client_id`/`client_secret` da Pluggy, o webhook secret e os tokens de serviço nunca são logados; `@finance/logger` já redige campos sensíveis por convenção. |

## Project Structure

### Documentation (this feature)

```text
specs/006-pluggy-bank-integration/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── banking-ms-api.md
│   └── transactions-import-api.md
└── tasks.md              # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
services/banking-ms/                        # Novo microsserviço (Pluggy)
├── src/
│   ├── modules/
│   │   └── bank-connections/
│   │       ├── domain/
│   │       │   ├── bank-connection.ts            # Aggregate root
│   │       │   ├── linked-account.ts
│   │       │   ├── linked-credit-card.ts
│   │       │   ├── synced-transaction.ts
│   │       │   ├── bank-connection.repository.ts # Port
│   │       │   ├── pluggy-client.port.ts         # Port
│   │       │   ├── transactions-importer.port.ts # Port
│   │       │   └── errors.ts
│   │       ├── application/
│   │       │   └── use-cases/
│   │       │       ├── create-connect-token/
│   │       │       ├── complete-connection/       # webhook item/updated (1a sync)
│   │       │       ├── sync-connection/            # busca contas/cartões/transações
│   │       │       ├── trigger-manual-refresh/
│   │       │       ├── list-connections/
│   │       │       ├── disconnect-connection/
│   │       │       ├── create-reauth-token/
│   │       │       └── retry-failed-imports/
│   │       ├── infrastructure/
│   │       │   ├── persistence/
│   │       │   │   ├── entities/
│   │       │   │   │   ├── bank-connection.entity.ts
│   │       │   │   │   ├── linked-account.entity.ts
│   │       │   │   │   ├── linked-credit-card.entity.ts
│   │       │   │   │   └── synced-transaction.entity.ts
│   │       │   │   ├── repositories/bank-connection.repository.ts
│   │       │   │   └── migrations/
│   │       │   ├── pluggy/
│   │       │   │   ├── pluggy-client.adapter.ts     # REST + cache do API key
│   │       │   │   └── pluggy-webhook.guard.ts      # valida assinatura do webhook
│   │       │   ├── transactions-importer/
│   │       │   │   └── transactions-ms-importer.adapter.ts # chama POST /transactions/synced-import
│   │       │   └── scheduling/
│   │       │       ├── daily-sync.job.ts
│   │       │       └── retry-imports.job.ts
│   │       ├── presentation/
│   │       │   ├── bank-connections.controller.ts
│   │       │   ├── pluggy-webhook.controller.ts
│   │       │   └── bank-connections.module.ts
│   │       └── contracts (Zod)                     # em packages/contracts/src/bank-connections
│   ├── common/auth/                                 # reaproveita @finance/auth
│   ├── app.module.ts
│   └── main.ts
├── package.json
├── tsconfig.json
└── jest.config.ts

services/api/src/modules/transactions/               # Alterações no serviço existente
├── application/use-cases/import-synced-transaction/  # novo use case (idempotente por Idempotency-Key)
├── presentation/
│   ├── transactions.controller.ts                   # + POST /transactions/synced-import
│   └── synced-import.controller.spec.ts
└── (schema) migration adicionando coluna `source` ('manual' | 'synced') e `external_id`

services/api/src/common/auth/
└── service-account.guard.ts                          # aceita token de serviço (role banking-ms) além do JWT de usuário

services/bff/src/bank-connections/                    # Novo módulo, proxy fino (sem regra de negócio)
├── bank-connections.controller.ts
├── bank-connections.module.ts
└── bank-connections.controller.spec.ts

apps/web/features/bank-connections/                   # Nova feature de UI
├── connections-list-view.tsx
├── connect-flow.tsx                                   # abre o widget Pluggy Connect
├── use-bank-connections.ts
└── ...

packages/contracts/src/
├── bank-connections/                                  # novo: connection/account/card/synced-transaction schemas
└── transactions/transaction.ts                        # + campo `source` no transactionSchema
```

**Structure Decision**: Novo serviço deployável `services/banking-ms`, seguindo
exatamente a mesma estrutura de camadas (`domain/application/infrastructure/presentation`)
já usada em `services/api` e `services/ai-ms`. Ele possui seu próprio schema
Postgres (`banking`) na mesma instância compartilhada — sem banco de dados
separado, para não adicionar infraestrutura nova além do estritamente
necessário. A única alteração fora do novo serviço é um acréscimo mínimo e
isolado ao módulo `transactions` do `services/api` (uma rota de import e um
campo `source`), exigido pela própria especificação (o Transactions MS
continua sendo a fonte de verdade). `services/bff` ganha um módulo-proxy fino,
no mesmo padrão dos módulos `accounts`/`cards` já existentes.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| Novo microsserviço (`services/banking-ms`), indo contra a regra "sem microsserviços" do AGENTS.md | A especificação (seção Architecture and Service Boundaries, escrita explicitamente pelo usuário) exige um serviço isolado que fale com a Pluggy e não se torne fonte de verdade de transações; o perímetro de segurança (segredos/webhooks de um provedor Open Finance externo) é distinto do resto do domínio financeiro, mesmo padrão já aceito pela ADR-004 para o AI-MS | Colocar a integração como um módulo dentro do API-MS foi rejeitado: misturaria o ciclo de vida de webhooks/retry de um provedor externo com o módulo que é a fonte de verdade financeira, e a própria spec proíbe explicitamente essa mistura. |
| Nova dependência `@nestjs/schedule` | Necessária para o sync automático diário (SC-003) e para o job de retry de imports em erro (FR-012) — sem ela seria preciso um cron externo, mais infraestrutura, não menos | Um cron do sistema operacional/orquestrador externo foi rejeitado por adicionar uma peça de infraestrutura fora do monorepo para um requisito que uma lib padrão do próprio framework já resolve. |
| Token de serviço Keycloak (client credentials) + novo `service-account.guard.ts` no API-MS, indo contra a leitura estrita da regra 2 ("`userId` só de JWT verificado") | O job de sync roda sem sessão de usuário viva; alguém precisa chamar `POST /transactions/synced-import` em nome de muitos usuários. Reautenticar como usuário ou persistir tokens de usuário para reuso em background foi descartado por violar o próprio espírito da regra 2 (token de usuário teria vida útil incompatível com um job assíncrono) | Repassar/persistir o JWT do usuário para reuso posterior foi rejeitado (tokens expiram e não devem ser guardados); implementar a lógica de import diretamente dentro do banking-ms (acessando o banco do Transactions MS) foi rejeitado por violar diretamente a seção "Architecture and Service Boundaries" da spec, que proíbe escrita direta no banco do Transactions MS. |

## Post-Design Constitution Check (pós-Fase 1)

Reavaliação após `research.md`, `data-model.md` e `contracts/*` concluídos:
nenhuma decisão de design introduziu violação nova além das três já
registradas em Complexity Tracking acima (novo serviço, `@nestjs/schedule`,
token de serviço). Em particular: nenhuma tabela do `data-model.md` usa tipo
de ponto flutuante para valores monetários (regra 1); todas as rotas do
`contracts/banking-ms-api.md` resolvem `userId` do `AuthenticatedUser`, nunca
de body/query (regra 2, exceto a rota de serviço já justificada); nenhum
contrato expõe `client_secret` da Pluggy, webhook secret ou o token de
serviço (regra 10); a estrutura de pastas do Projeto (acima) mantém
`domain/application/infrastructure/presentation` tanto no banking-ms quanto
no acréscimo ao API-MS (regra 4). Gate: **PASS** — plano pode avançar para
`/speckit.tasks`.
| Token de serviço Keycloak (client credentials) para o banking-ms chamar `POST /transactions/synced-import` | O job de sync automático roda sem sessão de usuário ativa; é preciso alguma forma de autenticação verificável para uma chamada machine-to-machine que ainda assim é auditável e restrita a uma única rota | Reimplementar a importação de transações dentro do próprio banking-ms (sem chamar o Transactions MS) foi rejeitado por violar diretamente a Architecture and Service Boundaries da spec (o Transactions MS deve continuar sendo a fonte de verdade). |
