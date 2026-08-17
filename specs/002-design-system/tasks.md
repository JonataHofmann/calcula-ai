# Tasks: Design System — Financial Dashboard

**Input**: Design documents from `/specs/002-design-system/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluídos (Definition of Done do AGENTS.md; SC-006 exige regressão verde).

**Organization**: Agrupado por user story (US1 tokens, US2 básicos, US3 financeiros, US4 demo).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Extrair tokens do Figma via API/MCP (arquivo `8kMF6TIrl8aRLKeTcpRouQ`, node `1-12`; requer `FIGMA_ACCESS_TOKEN` do usuário): cores, tipografia, espaçamentos, raios, sombras → documentar valores brutos em `specs/002-design-system/figma-tokens.md`; se falhar, usar fallback de research R1 e registrar
- [x] T002 [P] Adicionar deps: `lucide-react` (peer em `packages/ui/package.json`, dep em `apps/web/package.json`), `@testing-library/react` + `jsdom` (dev em `packages/ui`); configurar environment jsdom no vitest do pacote; `pnpm install`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Bloqueia todas as user stories

- [x] T003 Criar `packages/ui/src/styles/tokens.css`: custom properties semânticas em `:root` (tema claro) e `.dark` (tema escuro) conforme data-model §1 + mapeamento `@theme inline` Tailwind v4 (research R2); validar contraste AA dos pares da tabela e ajustar valores reprovados (documentar desvios em `specs/002-design-system/figma-tokens.md`)
- [x] T004 Importar tokens no app: `apps/web/app/globals.css` → `@import '@finance/ui/src/styles/tokens.css'` (ou caminho de export do pacote); garantir `@source` cobrindo `packages/ui`
- [x] T005 [P] Implementar `formatBRL(value: string)` e `formatPercent(value: string, signed?)` em `packages/ui/src/lib/format.ts` sem float no caminho principal (research R6) + testes em `packages/ui/src/lib/format.spec.ts` (negativo, milhões, zero, string inválida → throw)
- [x] T006 [P] Script inline anti-FOUC em `apps/web/app/layout.tsx` (lê `localStorage.theme` + `prefers-color-scheme`, aplica `.dark` antes da hidratação) e substituir classes hardcoded do `<body>` por tokens (`bg-background text-text`)
- [x] T007 Implementar `ThemeToggle` em `apps/web/components/theme-toggle.tsx`: seleção light/dark/system → `setTheme` (ui-slice), persiste `localStorage.theme`, sincroniza `.dark`, listener `matchMedia` quando system (research R3, data-model §2); `aria-label` com tema atual
- [x] T008 [P] Testes do ThemeToggle em `apps/web/components/theme-toggle.spec.tsx` (alternância, persistência, system → matchMedia)

**Checkpoint**: Tokens + temas funcionais

---

## Phase 3: User Story 1 - Tokens de design (Priority: P1)

**Goal**: Tokens como única fonte de estilo; componentes existentes migrados.

**Independent Test**: Quickstart US1 (`rg` sem hex/paleta bruta em `packages/ui/src/components/`; build verde).

### Implementation

- [x] T009 [P] [US1] Migrar `packages/ui/src/components/button.tsx` para tokens semânticos + adicionar `loading?: boolean` (spinner, disabled, `aria-busy`) mantendo assinatura (contracts: Button)
- [x] T010 [P] [US1] Migrar `packages/ui/src/components/card.tsx` para tokens (`bg-surface`, `border-border`, `--radius-lg`, `--shadow-sm`) sem mudar assinaturas
- [x] T011 [P] [US1] Migrar `packages/ui/src/components/badge.tsx` para tokens soft/foreground + variante `info` (contracts: Badge)
- [x] T012 [P] [US1] Migrar `packages/ui/src/components/skeleton.tsx` para tokens
- [x] T013 [US1] Testes de regressão dos 4 componentes em `packages/ui/src/components/{button,card,badge,skeleton}.spec.tsx` (variantes renderizam, loading do Button, info do Badge, sem classes de paleta bruta)

**Checkpoint**: Zero cor fora de tokens no pacote (SC-002); consumidores intactos (SC-006)

---

## Phase 4: User Story 2 - Componentes básicos (Priority: P1) 🎯 MVP

**Goal**: Input, Select, SearchField, Avatar, Separator, Spinner, Table completos com estados.

**Independent Test**: Quickstart US2 (testes verdes cobrindo variantes/estados; render isolado fiel à referência).

### Implementation

- [x] T014 [P] [US2] Implementar `Input` em `packages/ui/src/components/input.tsx` (label, helpText, error com `aria-invalid`+`aria-describedby`, disabled — contracts: Input)
- [x] T015 [P] [US2] Implementar `Select` em `packages/ui/src/components/select.tsx` (select nativo estilizado, options, placeholder, estados — contracts: Select)
- [x] T016 [P] [US2] Implementar `SearchField` em `packages/ui/src/components/search-field.tsx` (ícone lucide, `type="search"`, `onSearch` no Enter)
- [x] T017 [P] [US2] Implementar `Avatar` em `packages/ui/src/components/avatar.tsx` (src + fallback iniciais, sizes, alt obrigatório)
- [x] T018 [P] [US2] Implementar `Separator` em `packages/ui/src/components/separator.tsx` (`role="separator"`, orientação)
- [x] T019 [P] [US2] Implementar `Spinner` em `packages/ui/src/components/spinner.tsx` (`role="status"`, label sr-only default 'Carregando…')
- [x] T020 [P] [US2] Implementar `Table` composto + `TableEmpty` em `packages/ui/src/components/table.tsx` (wrappers semânticos, empty state default 'Nenhum registro encontrado')
- [x] T021 [US2] Exportar todos os novos componentes + `formatBRL`/`formatPercent` em `packages/ui/src/index.ts`
- [x] T022 [P] [US2] Testes dos básicos em `packages/ui/src/components/{input,select,search-field,avatar,separator,spinner,table}.spec.tsx` (estados error/empty/disabled, a11y attrs, fallback do Avatar, truncamento)

**Checkpoint**: Blocos de construção prontos (parte de SC-001)

---

## Phase 5: User Story 3 - Componentes financeiros (Priority: P2)

**Goal**: MetricCard, TransactionItem/List, CreditCardVisual, ChartContainer.

**Independent Test**: Quickstart US2/US3 (testes verdes; composição de dashboard reconhecível).

### Implementation

- [x] T023 [P] [US3] Implementar `MetricCard` em `packages/ui/src/components/metric-card.tsx` (value string via `formatBRL`, delta com cor semântica ↑/↓, tone default/strong — contracts: MetricCard)
- [x] T024 [P] [US3] Implementar `TransactionItem` + `TransactionList` em `packages/ui/src/components/transaction-item.tsx` (amount string com sinal/cor, truncamento ellipsis, empty state — contracts)
- [x] T025 [P] [US3] Implementar `CreditCardVisual` em `packages/ui/src/components/credit-card-visual.tsx` (aceita apenas `maskedNumber`, tones dark/primary — contracts; regra de segurança: nunca PAN completo)
- [x] T026 [P] [US3] Implementar `ChartContainer` em `packages/ui/src/components/chart-container.tsx` (title, legend com colorToken, actions, children)
- [x] T027 [US3] Exportar componentes financeiros em `packages/ui/src/index.ts`
- [x] T028 [P] [US3] Testes em `packages/ui/src/components/{metric-card,transaction-item,credit-card-visual,chart-container}.spec.tsx` (BRL formatado, delta positivo/negativo, milhões sem overflow lógico, empty list, legend)

**Checkpoint**: Domínio financeiro coberto (SC-001, FR-008, FR-014)

---

## Phase 6: User Story 4 - Página de demonstração (Priority: P3)

**Goal**: Rota interna `/design-system` com todos os tokens/componentes/estados + ThemeToggle.

**Independent Test**: Quickstart US4 (todas as seções renderizam; alternância de tema; 360px sem overflow).

### Implementation

- [x] T029 [US4] Criar `apps/web/app/(internal)/design-system/page.tsx` com seções: Tokens (paleta, tipografia, raios, sombras), Botões (variantes×estados), Formulários (Input/Select/SearchField com error/disabled), Conteúdo (Card/Badge/Avatar/Separator), Dados (Table com dados e vazia, Skeleton, Spinner), Financeiro (MetricCard, TransactionList com itens e vazia, CreditCardVisual, ChartContainer) — ThemeToggle no topo (research R8)
- [x] T030 [P] [US4] Dados de exemplo estáticos da demo em `apps/web/app/(internal)/design-system/demo-data.ts` (valores BRL string, incluindo caso de milhões `"1234567.89"` e amounts negativos)

**Checkpoint**: Documentação viva navegável (SC-001, SC-008)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T031 [P] Verificação final de contraste AA em ambos os temas sobre pares da tabela do data-model; registrar resultado em `specs/002-design-system/figma-tokens.md` (SC-003)
- [x] T032 [P] Atualizar `docs/agents/frontend.md` com uso do design system (tokens, imports, regra "sem paleta bruta") e escrever ADR se decisões divergirem da referência
- [x] T033 Executar validação completa do `specs/002-design-system/quickstart.md` (grep de paleta bruta, demo em light/dark, 360px, teclado, persistência de tema)
- [x] T034 Rodar `pnpm lint && pnpm typecheck && pnpm test && pnpm build` e corrigir pendências (SC-006)

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: extração de tokens antes do tokens.css (T001 → T003); T002 independente
- **Phase 3 (US1)**: depende de T003/T004; T009–T012 paralelos; T013 após
- **Phase 4 (US2)**: depende de Phase 2 (+ T005 para nada; independente de US1, mas US1 primeiro evita retrabalho visual)
- **Phase 5 (US3)**: depende de T005 (`formatBRL`) e de Card (T010); componentes T023–T026 paralelos
- **Phase 6 (US4)**: depende de US1+US2+US3 (exibe tudo) e T007 (ThemeToggle)
- **Phase 7**: após tudo

### Parallel Opportunities

- Phase 2: T005 ∥ T006 ∥ T008 (T007 após T006)
- Phase 3: T009 ∥ T010 ∥ T011 ∥ T012
- Phase 4: T014–T020 todos paralelos (arquivos distintos); T021 após; T022 paralelo entre si
- Phase 5: T023–T026 paralelos
- US2 e US3 podem andar em paralelo por devs distintos após Phase 2 + T005/T010

## Implementation Strategy

**MVP** = Phases 1–4 (tokens + temas + migração + básicos): design system utilizável em qualquer tela. Depois US3 (financeiros) → US4 (demo) → Polish.

**Nota de integração com feature 001**: `Sidebar`/`Header` da feature 001 devem consumir estes tokens/componentes; se 002 for implementada primeiro, 001 nasce já no padrão — ordem recomendada: 002 Phases 1–4, depois 001.
