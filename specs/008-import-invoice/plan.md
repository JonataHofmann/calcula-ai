# Implementation Plan: Importar Fatura

**Branch**: `008-import-invoice` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-import-invoice/spec.md`

## Summary

Permitir que o usuário importe a fatura de um cartão de crédito enviando o PDF (protegido por senha). O serviço de IA (`ai-ms`) decripta o PDF, extrai texto e usa um modelo (via 9Router/AI Gateway atrás da interface `AIProvider`) para extrair as transações (data, descrição, valor, marcador de parcela "X/Y") e o mês de referência. O `bff` orquestra: envia o PDF+senha ao `ai-ms`, enriquece cada linha com uma **sugestão de categoria por histórico** (consultando o `api`) e devolve a lista para revisão. Na revisão, o usuário ajusta categorias, descarta linhas incertas e escolhe **substituir** ou **mesclar**. No commit, o `api` grava despesas `pending` vinculadas ao cartão (parcelas viram `installment` com ocorrências futuras), aplicando dedup por (data + valor + descrição normalizada) e escopo de substituição por cartão + mês de referência.

Toda a leitura de PDF e extração por IA vive em `ai-ms` (FR-004); `ai-ms` nunca acessa o banco. A persistência e as regras financeiras vivem em `api`. O `bff` só agrega/proxia. A senha do PDF nunca é logada nem devolvida (FR-017/SC-006).

## Technical Context

**Language/Version**: TypeScript `^5.7.3`; Node 22 (`@types/node ^22`).

**Primary Dependencies**: NestJS `^11`; TypeORM `^0.3.20` + `pg` (api); Zod `^3.24` (`@finance/contracts`); `class-validator`/`class-transformer` + `ZodValidationPipe` (ai-ms/bff/api boundaries); Next.js App Router + Tailwind v4 + Redux Toolkit + TanStack Query + React Hook Form + `zodResolver` (web). **New**: `pdfjs-dist` (legacy/Node build) em `ai-ms` para decriptar PDF protegido por senha e extrair texto; `@types/multer` + `FileInterceptor` (`@nestjs/platform-express`, já presente) em `ai-ms` e `bff` para upload multipart; cliente `fetch` para 9Router implementando `AIProvider`.

**Storage**: PostgreSQL via TypeORM — tabela `transactions` (api). `ai-ms` e `bff` (fora sessão) não persistem esta feature. Uma migration altera o CHECK de `source` em `transactions`.

**Testing**: jest `^29` + ts-jest, `rootDir: src`, specs co-locados (`*.spec.ts`); api também tem `*.int.spec.ts`. Padrões a reusar: `__testing__/in-memory-repositories.ts`, `synced-import.controller.spec.ts`.

**Target Platform**: Linux server (um processo Node por serviço: api `:3031`, bff `:3032`, ai-ms `:3033`) + navegador (web Next.js).

**Project Type**: web — monorepo pnpm+turbo (`services/*`, `apps/*`, `packages/*` front-shared, `libs/*` backend-shared).

**Performance/Quality Goals** (do spec): SC-001 ≥95% das linhas extraídas corretamente; SC-002 ≥70% de categorias pré-sugeridas corretas; SC-003 fluxo completo <3min para ~50 transações; SC-004 0% duplicadas no merge; SC-005 100% dos erros (senha/arquivo) sem alterar o banco; SC-006 senha nunca em logs/respostas/telas.

**Constraints** (AGENTS.md, não-negociáveis):
- Dinheiro = `NUMERIC(18,2)` no banco e **string decimal** (`"1500.00"`) em DTOs/contratos; nunca float.
- `userId` vem **apenas** do JWT verificado; toda consulta financeira é escopada ao usuário.
- `ai-ms` acessa dados **somente** via serviços autorizados — nesta feature `ai-ms` não chama o `api` nem o banco (só extrai e devolve); a senha do PDF é dado sensível e nunca é logada.
- Convenção **flat** pós-007: `src/modules/<name>/{dto,converters,entities}` + `<name>.{module,controller,service}.ts`; controllers sem regra de negócio; services acessam `Repository<Entity>` via `@InjectRepository`; migrations centralizadas em `services/api/src/database/migrations`.
- BFF só agrega/molda contrato; regra financeira no `api`.

**Scale/Scope**: 1 feature atravessando 5 camadas — `packages/contracts` (novo arquivo de schemas), `ai-ms` (novo módulo de extração + impl `AIProvider` + AuthModule), `api` (2 rotas novas em transactions + helper de ciclo de fatura + migration), `bff` (novo módulo + `AiApiClient`), `apps/web` (nova feature `invoice-import`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O constitution (`.specify/memory/constitution.md`) é um template não populado — todos os princípios/seções são `[PLACEHOLDER]`. Não há princípios ratificados a checar.

**Gate result: PASS (vacuous).** Não há restrições formais de governança. Na prática, o design adere às regras não-negociáveis do `AGENTS.md` (dinheiro como string, userId do JWT, ai-ms sem SQL, Clean/flat modules, BFF sem regra de negócio, nunca logar segredos). Re-check pós Fase 1: ainda PASS — nenhuma violação nova; sem entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-import-invoice/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões (R1..R8)
├── data-model.md        # Fase 1 — entidades, campos, regras
├── quickstart.md        # Fase 1 — guia de validação end-to-end
├── contracts/           # Fase 1 — contratos de interface
│   ├── invoice-import.contracts.md   # Zod schemas (contratos compartilhados)
│   └── http-endpoints.md             # rotas ai-ms/bff/api desta feature
├── checklists/
│   └── requirements.md  # (do /speckit-specify + /speckit-clarify)
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root — camadas afetadas)

```text
packages/contracts/src/transactions/
└── import-invoice.ts            # NEW: schemas (extracted line, extract result, review/commit input, suggestions)
                                 #      exportado em packages/contracts/src/index.ts

services/ai-ms/src/
├── common/
│   ├── ai-provider.ts           # (existe: interface AIProvider)
│   └── auth.module.ts           # NEW: JwtAuthGuard + TOKEN_VERIFIER (copiar de services/api/src/common)
├── providers/
│   └── router-ai.provider.ts    # NEW: impl AIProvider via 9Router (AI_ROUTER_URL/AI_ROUTER_API_KEY)
└── modules/invoice-import/
    ├── invoice-import.controller.ts   # NEW: POST /invoice-extract (multipart PDF+senha, JWT)
    ├── invoice-import.service.ts      # NEW: decripta PDF (pdfjs-dist) + extrai texto + chama AIProvider
    ├── pdf-reader.ts                  # NEW: abrir/decriptar PDF + extrair texto por página
    ├── invoice-extraction.prompt.ts   # NEW: prompt + parsing/validação Zod da saída do modelo
    ├── invoice-import.module.ts       # NEW
    └── *.spec.ts                      # NEW: unit (pdf-reader, service c/ fake provider)

services/api/src/modules/transactions/
├── transactions.controller.ts   # EDIT: + POST /transactions/invoice-import ; + GET /transactions/category-suggestions
├── transactions.service.ts      # EDIT: commit (replace/merge+dedup), suggestions, billing-cycle dueDate
├── invoice-import.schemas.ts    # NEW: Zod input do commit (server-side)
├── billing-cycle.ts             # NEW: helper mês de referência -> dueDate via card dueDay/closingDay
└── *.spec.ts                    # EDIT/NEW: dedup, replace, merge, suggestions, billing-cycle

services/api/src/database/migrations/
└── <ts>-add-imported-source-to-transactions.ts   # NEW: amplia CHECK de source p/ incluir 'imported'

services/bff/src/
├── common/
│   ├── ai-api-client.ts         # NEW: AiApiClient (base AI_MS_URL) + passthrough multipart
│   └── common.module.ts         # EDIT: provider/export AiApiClient
└── modules/invoice-import/
    ├── invoice-import.controller.ts   # NEW: POST /invoice-import/extract (multipart) ; POST /invoice-import/commit
    ├── invoice-import.service.ts      # NEW: orquestra ai-ms(extract) + api(suggestions, commit)
    ├── invoice-import.module.ts       # NEW (registrado em app.module.ts)
    └── *.spec.ts                      # NEW

apps/web/
├── features/invoice-import/
│   ├── invoice-import-api.ts     # NEW: apiFetch (variante multipart) -> BFF
│   ├── use-invoice-import.ts     # NEW: TanStack Query mutations (extract, commit)
│   ├── invoice-upload-modal.tsx  # NEW: cartão + arquivo PDF + senha
│   ├── invoice-review-modal.tsx  # NEW: Table + EntitySelect por linha + descartar + replace/merge
│   └── invoice-import.slice.ts   # NEW (se precisar de estado de UI)
├── services/api-client.ts        # EDIT: variante multipart (sem forçar Content-Type JSON)
└── app/(app)/importar-fatura/page.tsx   # NEW: rota da tela
```

**Structure Decision**: Segue a convenção **flat** pós-007 nos serviços NestJS e o padrão de feature-folder no web (component → hook → TanStack Query → `*-api.ts` → BFF). Reusa os precedentes existentes: `synced-import` (import externo cria transações com idempotência/dedup) no `api`, `BankingApiClient`/`transactions-ms-importer.adapter.ts` como template de cliente HTTP entre serviços, e `features/synced-transactions` + `EntitySelect`/`useCategories` como base da lista de revisão. A persistência usa rota **autenticada por usuário** (não service-account), pois o BFF já porta o token de sessão do usuário.

## Complexity Tracking

> Sem violações de constitution a justificar. Tabela intencionalmente vazia.
