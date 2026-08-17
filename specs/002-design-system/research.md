# Research: Design System — Financial Dashboard

## R1. Extração de tokens do Figma

**Decision**: Extração via Figma API/MCP (REST `GET /v1/files/8kMF6TIrl8aRLKeTcpRouQ` ou MCP server oficial do Figma) usando token de acesso fornecido pelo usuário na fase de implementação. Valores extraídos (fills, text styles, corner radius, effects, spacing) são consolidados manualmente em `packages/ui/src/styles/tokens.css` — extração é one-shot, não pipeline contínuo.

**Rationale**: Decisão de clarificação (sessão 2026-08-17). Arquivo é community template; estilos podem não estar publicados como variables — extração via nodes (`node-id=1-12`) cobre isso. One-shot evita complexidade de sync automático (regra 8).

**Alternatives considered**:
- Aproximação visual manual — rejeitada pelo usuário (escolheu C), mas mantida como fallback documentado na spec se token/permissões falharem.
- Pipeline Style Dictionary + Figma Variables API — complexidade prematura para um template estático.

**Fallback documentado** (se extração falhar): paleta típica do template Financial Dashboard: fundo claro `#F4F5F7`~`#FAFAFA`, superfície branca, sidebar/painéis escuros `#1B212D`~`#232323`, primária verde `#29A073`/teal, acento amarelo-esverdeado `#C8EE44`, texto `#1B212D`/muted `#929EAE`, fonte Kumbh Sans/Inter. Confirmar contra extração real.

## R2. Arquitetura de tokens com Tailwind v4

**Decision**: Duas camadas em `packages/ui/src/styles/tokens.css`:
1. **Primitivas + semânticas** como CSS custom properties: `:root { --color-background, --color-surface, --color-primary, --color-primary-foreground, --color-text, --color-text-muted, --color-border, --color-success, --color-danger, --color-warning, --color-info, --radius-*, --shadow-* }` e overrides em `.dark { ... }`.
2. **Mapeamento Tailwind** via `@theme inline { --color-primary: var(--color-primary); ... }` gerando utilities (`bg-primary`, `text-muted`, etc.).

Componentes usam apenas utilities semânticas (`bg-surface`, `text-danger`) — nunca paleta bruta (`bg-blue-600`).

**Rationale**: Tailwind v4 é CSS-first (`@theme`); custom properties permitem troca de tema por classe `.dark` sem rebuild e cumprem FR-003 (única fonte de estilo). `apps/web/globals.css` já usa `@source` para o pacote ui — só falta importar `tokens.css`.

**Alternatives considered**:
- `tailwind.config.js` theme extend — padrão v3, não idiomático no v4 já adotado.
- Tokens em TS (objeto exportado) — não integra com utilities do Tailwind; duplicaria fonte de verdade.

## R3. Alternância e persistência de tema

**Decision**: Estratégia classe `.dark` no `<html>`:
- Script inline no `layout.tsx` (antes da hidratação) lê `localStorage.theme` (`'light'|'dark'|'system'`) e `prefers-color-scheme`, aplica `.dark` — elimina FOUC.
- `ThemeToggle` (client component em `apps/web/components/`) despacha `setTheme` no `ui-slice` existente, grava `localStorage` e sincroniza a classe. Listener de `change` em `matchMedia` quando em `'system'`.

**Rationale**: `ui-slice` já modela `theme: 'light'|'dark'|'system'` — reuso direto (regra 5: tema é client state). `suppressHydrationWarning` já presente no `<html>`. Padrão da indústria (next-themes faz o mesmo), mas sem dependência extra.

**Alternatives considered**:
- `next-themes` — funciona, mas duplicaria estado com Redux já existente; regra 8.
- Cookie + SSR — complexidade extra sem exigência de SSR do tema.

## R4. Ícones

**Decision**: `lucide-react` como conjunto único de ícones (peer do `packages/ui`, dep do `apps/web`).

**Rationale**: Tree-shakeable, visual line-icon consistente com o template, licença ISC, padrão de facto em stacks React/Tailwind. Spec exige "conjunto único consistente".

**Alternatives considered**: Heroicons (menos ícones financeiros), SVGs manuais (custo de manutenção), react-icons (bundle e inconsistência visual).

## R5. Primitivos de componente: nativo vs. headless lib

**Decision**: Elementos nativos estilizados: `<button>`, `<input>`, `<select>` nativo, `<table>`. Sem Radix/Headless UI nesta fase.

**Rationale**: Escopo atual (FR-004..FR-008) não exige overlay/popover/combobox — os únicos casos onde headless libs pagam seu custo. Nativo garante acessibilidade de teclado (FR-010) de graça. Regra 8: justificar toda abstração.

**Alternatives considered**:
- Radix UI — adotar depois se surgirem Dialog/Dropdown/Combobox; estrutura de tokens não bloqueia.
- shadcn/ui — copia código com convenções próprias (cva); divergiria do padrão atual do pacote (Record de classes + cn).

## R6. Formatação monetária a partir de string decimal

**Decision**: `formatBRL(value: string): string` em `packages/ui/src/lib/format.ts`: parse manual de sinal/inteiro/fração da string decimal (`"1500.00"`), formatação com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` usando partes inteiras como `BigInt` quando necessário para valores grandes. API pública nunca aceita `number` para dinheiro.

**Rationale**: Regra 1 (nunca float). `Intl.NumberFormat` cobre pt-BR/BRL nativamente. Edge case da spec: milhões sem perda de precisão.

**Alternatives considered**:
- `Number(value)` + Intl — perde precisão acima de 2^53 e viola espírito da regra 1 na fronteira; rejeitado para o caminho principal.
- decimal.js — dependência pesada para formatação pura; regra 8.

## R7. Compatibilidade dos componentes existentes (FR-009)

**Decision**: Manter assinaturas públicas: `Button` (`variant: 'primary'|'secondary'|'destructive'|'ghost'`, `size: 'sm'|'md'|'lg'`), `Badge` (`variant: 'default'|'success'|'warning'|'danger'` + novo `'info'`), `Card`/`CardHeader`/`CardTitle`/`CardContent`, `Skeleton`. Mudanças apenas internas (classes → tokens) e aditivas (`loading?: boolean` no Button).

**Rationale**: SC-006 exige build/testes verdes sem alterar consumidores. Variantes atuais já cobrem as exigidas pela spec.

**Alternatives considered**: Breaking redesign com cva — sem benefício funcional agora.

## R8. Página de demonstração

**Decision**: Rota `apps/web/app/(internal)/design-system/page.tsx` — página estática com seções (Tokens, Botões, Formulários, Conteúdo, Dados, Financeiro) renderizando cada componente em todas as variantes/estados, com `ThemeToggle` no topo. Sem gate de auth nesta feature (rota interna de dev; proteção chega com feature 001).

**Rationale**: Spec assume "rota interna simples, sem ferramenta dedicada de catálogo". Serve de superfície de validação para SC-001/SC-005/SC-008.

**Alternatives considered**: Storybook — infra pesada (regra 8); pode ser adotado depois sem retrabalho.

## R9. Testes

**Decision**: Vitest + `@testing-library/react` + `jsdom` em `packages/ui`: testes unitários de render/estados (error, empty, loading, variantes) e de `format.ts` (casos: negativos, milhões, string inválida). Verificação de contraste AA feita uma vez sobre os pares de tokens extraídos (tabela em data-model) — não teste automatizado contínuo.

**Rationale**: Pacote já tem Vitest; RTL é o padrão para componentes. Contraste é propriedade dos valores dos tokens (estático), não do código.

**Alternatives considered**: Testes visuais de regressão (Chromatic/Playwright screenshots) — valor real, custo de infra alto; deferido.
