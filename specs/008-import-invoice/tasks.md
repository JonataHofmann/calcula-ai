---
description: "Task list for Importar Fatura"
---

# Tasks: Importar Fatura

**Input**: Design documents from `/specs/008-import-invoice/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED — o plano e o quickstart definem specs por camada (ai-ms, api, bff, web). Escreva-os antes da implementação de cada história.

**Organization**: Tarefas agrupadas por user story para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: US1 / US2 / US3
- Caminhos de arquivo relativos à raiz do repositório

## Convenções (do plan.md)

- Dinheiro = string decimal nos contratos/DTOs; NUNCA float. `userId` sempre do JWT.
- Convenção **flat** pós-007 nos serviços NestJS. `ai-ms` não acessa banco/api.
- Senha do PDF nunca logada/retornada (FR-017/SC-006).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependências e preparação do workspace.

- [X] T001 [P] Adicionar dependência `pdfjs-dist` (build legacy/Node) em `services/ai-ms/package.json`
- [X] T002 [P] Adicionar `@types/multer` (devDependency) em `services/ai-ms/package.json` e `services/bff/package.json`
- [X] T003 Rodar `pnpm install` e confirmar que `@finance/ai-ms`, `@finance/bff` e `@finance/api` resolvem as novas deps

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contratos, migration e helpers compartilhados por TODAS as histórias.

**⚠️ CRITICAL**: Nenhuma user story pode começar antes desta fase.

- [X] T004 Criar schemas Zod + tipos em `packages/contracts/src/transactions/import-invoice.ts` (`referenceMonthSchema`, `extractedInvoiceLineSchema`, `invoiceExtractionResultSchema`, `invoiceReviewLineSchema`, `commitInvoiceInputSchema`, `commitInvoiceResultSchema`, `categorySuggestionResultSchema`) conforme `contracts/invoice-import.contracts.md`
- [X] T005 [P] Ampliar `transactionSourceSchema` com o valor `'imported'` em `packages/contracts/src/transactions/transaction.ts`
- [X] T006 Exportar o novo módulo em `packages/contracts/src/index.ts` (`export * from './transactions/import-invoice.js'`) e rodar build do pacote
- [X] T007 Criar migration `services/api/src/database/migrations/<ts>-add-imported-source-to-transactions.ts` ampliando o CHECK de `source` (raw-SQL up/down: DROP/ADD CONSTRAINT) para aceitar `'imported'`
- [X] T008 Criar helper compartilhado de normalização de descrição (`trim` + `toLowerCase` + colapsar espaços) em `services/api/src/modules/transactions/normalize-description.ts` (usado por sugestão e dedup)

**Checkpoint**: Contratos, schema de banco e helpers prontos — histórias podem iniciar.

---

## Phase 3: User Story 1 - Extrair transações do PDF (Priority: P1) 🎯 MVP

**Goal**: Enviar cartão + PDF + senha → `ai-ms` decripta, extrai texto e usa IA para retornar transações (data, descrição, valor, marcador de parcela) + mês de referência; nada é gravado.

**Independent Test**: Enviar PDF válido com senha correta → lista extraída na revisão; senha errada / PDF ilegível → 400 sem gravar.

### Tests for User Story 1 ⚠️

- [X] T009 [P] [US1] Unit test de `pdf-reader` (senha correta, senha incorreta → `InvalidPdfPasswordError`, sem texto → `UnreadablePdfError`) com PDFs de fixture em `services/ai-ms/src/modules/invoice-import/pdf-reader.spec.ts`
- [X] T010 [P] [US1] Unit test de `invoice-import.service` com `AIProvider` fake (JSON válido; JSON inválido → 1 retry → erro tipado) em `services/ai-ms/src/modules/invoice-import/invoice-import.service.spec.ts`

### Implementation for User Story 1

- [X] T011 [P] [US1] Criar `AuthModule` do ai-ms (JwtAuthGuard + TOKEN_VERIFIER/`KeycloakTokenVerifier`, copiado de `services/api/src/common`) em `services/ai-ms/src/common/auth.module.ts`
- [X] T012 [P] [US1] Criar `RouterAiProvider` (impl de `AIProvider` via 9Router, `AI_ROUTER_URL`/`AI_ROUTER_API_KEY`, cliente `fetch`) em `services/ai-ms/src/providers/router-ai.provider.ts`
- [X] T013 [P] [US1] Criar `pdf-reader.ts` (`readPdfText(buffer, password)` com pdfjs-dist; erros tipados `InvalidPdfPasswordError`/`UnreadablePdfError`) em `services/ai-ms/src/modules/invoice-import/pdf-reader.ts`
- [X] T014 [US1] Criar `invoice-extraction.prompt.ts` (prompt de extração + `invoiceExtractionSchema` interno para validar/parsear saída do modelo, detecção "X/Y") em `services/ai-ms/src/modules/invoice-import/invoice-extraction.prompt.ts`
- [X] T015 [US1] Criar `invoice-import.service.ts` (orquestra `pdf-reader` → `AIProvider.generate` → validação Zod + retry corretivo; descarta senha; nunca loga senha/conteúdo) em `services/ai-ms/src/modules/invoice-import/invoice-import.service.ts` (depende de T013, T014, T012)
- [X] T016 [US1] Criar `invoice-import.controller.ts` — `POST /invoice-extract` (multipart `FileInterceptor`, JWT/`@CurrentUser`, validação manual Zod de `password`/`creditCardId`) em `services/ai-ms/src/modules/invoice-import/invoice-import.controller.ts`
- [X] T017 [US1] Criar `invoice-import.module.ts` (registra service/controller/provider/AuthModule) e registrá-lo no `app.module.ts` do ai-ms
- [X] T018 [US1] Criar `AiApiClient` (base `AI_MS_URL`, passthrough multipart com Bearer do usuário) em `services/bff/src/common/ai-api-client.ts` e registrá-lo/exportá-lo em `services/bff/src/common/common.module.ts`
- [X] T019 [US1] Criar módulo `invoice-import` no bff — controller `POST /invoice-import/extract` (`FileInterceptor`, sessão) + service (proxy para ai-ms) + `invoice-import.module.ts` registrado no `app.module.ts` (arquivos em `services/bff/src/modules/invoice-import/`)
- [X] T020 [P] [US1] Adicionar variante multipart `apiUpload(path, formData)` (sem forçar `Content-Type`, mantém `credentials: 'include'`) em `apps/web/services/api-client.ts`
- [X] T021 [US1] Criar `invoice-import-api.ts` (`extractInvoice({file,password,creditCardId})`) e `use-invoice-import.ts` (mutation de extract, TanStack Query) em `apps/web/features/invoice-import/`
- [X] T022 [US1] Criar `invoice-upload-modal.tsx` (select de cartão + input PDF + senha) e a rota `apps/web/app/(app)/importar-fatura/page.tsx`

**Checkpoint**: Upload → extração exibida na revisão; erros de senha/arquivo tratados. MVP demonstrável.

---

## Phase 4: User Story 2 - Revisar e categorizar antes de salvar (Priority: P1)

**Goal**: Revisão com categoria editável por linha; descrições vistas em meses anteriores chegam com categoria pré-selecionada (ocorrência mais recente); descartar linhas incertas.

**Independent Test**: A partir de linhas extraídas, cada linha tem seletor de categoria; coincidências no histórico vêm pré-preenchidas; confirmação avança para a decisão de gravação.

### Tests for User Story 2 ⚠️

- [X] T023 [P] [US2] Unit/int test de `category-suggestions` (normalização, ocorrência mais recente, escopo por usuário, `null` sem histórico) em `services/api/src/modules/transactions/transactions.service.spec.ts` (reusar `__testing__/in-memory-repositories.ts`)
- [X] T024 [P] [US2] Unit test do enriquecimento de sugestões no bff (extract → suggestions → preenche `suggestedCategoryId`) em `services/bff/src/modules/invoice-import/invoice-import.service.spec.ts`

### Implementation for User Story 2

- [X] T025 [US2] Implementar `GET /transactions/category-suggestions` em `services/api/src/modules/transactions/transactions.controller.ts` + método no `transactions.service.ts` (consulta em lote por descrição normalizada, `type=expense`, mais recente por `dueDate`/`createdAt`, escopo `@CurrentUser`) — usa T008
- [X] T026 [US2] Estender `invoice-import.service.ts` do bff para chamar `GET /transactions/category-suggestions` após o extract e preencher `suggestedCategoryId` em cada linha antes de devolver
- [X] T027 [US2] Criar `invoice-review-modal.tsx` (Table + `EntitySelect`/`useCategories` por linha, categoria pré-selecionada da sugestão, toggle de descartar, sinalização de incerteza/parcela) em `apps/web/features/invoice-import/`
- [X] T028 [US2] Ligar o fluxo upload → review no `page.tsx`, incluindo campo de ajuste do mês de referência (`referenceMonth`) na revisão (FR-003a)

**Checkpoint**: Revisão completa com sugestões e descarte; pronta para a decisão de gravação.

---

## Phase 5: User Story 3 - Substituir ou mesclar (Priority: P2)

**Goal**: No commit, gravar despesas `pending` no cartão; `replace` apaga o escopo (cartão + mês) e insere; `merge` insere só o que não duplica (data + valor + descrição normalizada); parcelas viram `installment`; retorna resumo `{added, skipped, removed}`.

**Independent Test**: Importar sobre conjunto existente; `replace` remove antigas e mantém só as novas; `merge` repetido → 0 duplicadas.

### Tests for User Story 3 ⚠️

- [X] T029 [P] [US3] Int test de commit em `services/api/src/modules/transactions/transactions.controller.int.spec.ts` — merge dedup (0% duplicadas), replace atômico (transação de banco), parcela → `installment` com `groupId`, `dueDate` via billing-cycle, isolamento por usuário (cartão de outro → "não encontrada")
- [X] T030 [P] [US3] Unit test do proxy de commit no bff (Bearer + `Idempotency-Key`) em `services/bff/src/modules/invoice-import/invoice-import.service.spec.ts`
- [X] T031 [P] [US3] Test de fluxo dos modais (upload → review → commit) com mocks de rede em `apps/web/features/invoice-import/invoice-import.spec.tsx`

### Implementation for User Story 3

- [X] T032 [P] [US3] Criar `billing-cycle.ts` (mapa `referenceMonth` + `card.dueDay` → `dueDate`, clamp de dia curto reusando `addMonthClamped`) em `services/api/src/modules/transactions/billing-cycle.ts`
- [X] T033 [P] [US3] Criar `invoice-import.schemas.ts` (Zod server-side do corpo do commit) em `services/api/src/modules/transactions/invoice-import.schemas.ts`
- [X] T034 [US3] Implementar `POST /transactions/invoice-import` no `transactions.controller.ts` + lógica de commit no `transactions.service.ts` (verifica cartão do usuário; `replace`/`merge`+dedup via T008; linhas com parcela → `installment` reusando `create`; `single` caso contrário; `source='imported'`, `status='pending'`, `dueDate` via T032; tudo em transação de banco; `Idempotency-Key`) — depende de T032, T033
- [X] T035 [US3] Adicionar `POST /invoice-import/commit` ao controller do bff + método de proxy no service (Bearer do usuário, `Idempotency-Key`) em `services/bff/src/modules/invoice-import/`
- [X] T036 [US3] Web: UI de decisão replace/merge + `commitInvoice` em `invoice-import-api.ts`/`use-invoice-import.ts` + exibição do resumo `{added, skipped, removed}` (FR-012)

**Checkpoint**: Fluxo completo extrair → revisar → gravar, com replace/merge e resumo.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T037 [P] Emitir `AIUsageMetrics` (model/tokens/latência, `libs/observability`) em `router-ai.provider.ts`
- [X] T038 [P] Verificar que a senha do PDF não aparece em logs/respostas de `ai-ms`/`bff`/`api` (SC-006/FR-017) — auditar `createLogger` e corpos de resposta
- [X] T039 Executar os cenários de `quickstart.md` (extração, revisão/sugestão, replace/merge, parcelas, segurança)
- [X] T040 Gate final: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes (ignorar as 2 falhas pré-existentes de banking-ms do baseline 007)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: sem dependências.
- **Foundational (P2)**: depende do Setup — BLOQUEIA todas as histórias.
- **US1 (P3)**: depende da Foundational. É o MVP.
- **US2 (P4)**: depende da Foundational; consome linhas da US1 no fluxo, mas a rota `category-suggestions` (api) e o enriquecimento (bff) são testáveis de forma independente.
- **US3 (P5)**: depende da Foundational; o commit (api) é independente das telas; integra o resultado da US1/US2 no fluxo web.
- **Polish (P6)**: depois das histórias desejadas.

### User Story Dependencies

- US1, US2 e US3 compartilham apenas a Foundational (contratos, migration, normalize helper). As rotas de backend de cada história não dependem umas das outras.
- Acoplamento existe só no fluxo web (upload → review → commit), montado incrementalmente.

### Within Each User Story

- Testes escritos antes e falhando. pdf-reader/provider antes do service; service antes do controller; api/bff antes da UI que os consome.

### Parallel Opportunities

- Setup: T001, T002 em paralelo.
- Foundational: T005 em paralelo com T004; T007/T008 após contratos.
- US1: T009/T010 (testes) em paralelo; T011/T012/T013 em paralelo (arquivos distintos); T020 em paralelo com o backend do ai-ms/bff.
- US2: T023/T024 em paralelo.
- US3: T029/T030/T031 em paralelo; T032/T033 em paralelo antes de T034.
- Polish: T037/T038 em paralelo.

---

## Parallel Example: User Story 1

```bash
# Testes juntos:
Task: "Unit test pdf-reader em services/ai-ms/src/modules/invoice-import/pdf-reader.spec.ts"
Task: "Unit test invoice-import.service (fake AIProvider) em .../invoice-import.service.spec.ts"

# Blocos independentes do ai-ms juntos:
Task: "AuthModule do ai-ms em services/ai-ms/src/common/auth.module.ts"
Task: "RouterAiProvider em services/ai-ms/src/providers/router-ai.provider.ts"
Task: "pdf-reader.ts em services/ai-ms/src/modules/invoice-import/pdf-reader.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Setup → Foundational → US1.
2. **PARE e VALIDE**: enviar PDF → ver transações extraídas (sem gravar).
3. Demo do MVP.

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. US1 → extração (MVP) → demo.
3. US2 → revisão + categorização por histórico → demo.
4. US3 → replace/merge + resumo → demo.
5. Polish → métricas, auditoria de segredo, gate final.

---

## Notes

- [P] = arquivos distintos, sem dependência pendente.
- Cada história é completável e testável de forma independente no backend.
- Verificar testes falhando antes de implementar; commit por tarefa ou grupo lógico.
- Nunca logar senha/PDF/payload financeiro; dinheiro sempre string decimal; `userId` do JWT.
