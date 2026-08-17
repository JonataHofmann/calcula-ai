# Implementation Plan: Design System — Financial Dashboard

**Branch**: `002-design-system` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-design-system/spec.md`

## Summary

Criar design system no pacote `@finance/ui` baseado no template Figma "Financial Dashboard (Community)": tokens de design (extraídos via Figma API/MCP) expostos como CSS custom properties consumidas pelo Tailwind v4 (`@theme`), dois temas completos (claro/escuro) com alternância persistida, componentes básicos (Button, Input, Select, SearchField, Card, Badge, Avatar, Separator, Table, Skeleton, Spinner) e componentes de domínio financeiro (MetricCard, TransactionItem/List, CreditCardVisual, ChartContainer), mais página de demonstração interna em `apps/web`.

## Technical Context

**Language/Version**: TypeScript 5.7, React 19

**Primary Dependencies**: Tailwind CSS v4 (`@theme` + CSS custom properties), clsx, tailwind-merge (existentes); `lucide-react` (ícones, a adicionar); Next.js 15 (página demo em `apps/web`); Redux Toolkit (`ui-slice` já tem `theme: 'light'|'dark'|'system'`)

**Storage**: N/A (preferência de tema em `localStorage` + classe no `<html>`)

**Testing**: Vitest (unit em `packages/ui`, já configurado); React Testing Library (a adicionar em `packages/ui`)

**Target Platform**: Web (browsers evergreen), larguras 360px–1440px+

**Project Type**: Biblioteca de UI (monorepo package) + rota demo no app web

**Performance Goals**: Zero JS extra para tema no primeiro paint (script inline anti-FOUC); componentes server-safe (RSC) exceto os interativos

**Constraints**: Sem regras de negócio no `packages/ui` (regra 8/AGENTS); dinheiro como string decimal BRL (regra 1); compatibilidade com usos atuais de Button/Card/Badge/Skeleton (FR-009); contraste AA em ambos os temas

**Scale/Scope**: ~15 componentes + tokens + 2 temas + 1 página demo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` é template não preenchido — sem gates formais. Aplicam-se as regras de `AGENTS.md`:

| Regra | Status |
|---|---|
| 1. Money = string decimal, nunca float | PASS — `MetricCard`/`TransactionItem` recebem `value: string`; formatação BRL via `Intl.NumberFormat` a partir de string |
| 5. Redux = client state only | PASS — tema em `ui-slice` (client state legítimo) |
| 8. Sem complexidade prematura | PASS — sem lib de componentes externa, sem Storybook; demo é rota Next simples |
| Generic components only em `packages/ui` | PASS — componentes financeiros são de apresentação pura (props in, JSX out), sem fetch/regras |

**Pós-Phase 1**: PASS (design mantém regras acima; ver contracts/).

## Project Structure

### Documentation (this feature)

```text
specs/002-design-system/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-components.md
└── tasks.md  (gerado por /speckit.tasks)
```

### Source Code (repository root)

```text
packages/ui/
├── src/
│   ├── styles/
│   │   └── tokens.css            # CSS custom properties: :root (light) + .dark; @theme mapping Tailwind v4
│   ├── lib/
│   │   ├── cn.ts                 # existente
│   │   └── format.ts             # formatBRL(value: string), formatPercent — sem float na API pública
│   ├── components/
│   │   ├── button.tsx            # evoluir: +loading, tokens
│   │   ├── card.tsx              # evoluir: tokens
│   │   ├── badge.tsx             # evoluir: tokens, +info variant
│   │   ├── skeleton.tsx          # evoluir: tokens
│   │   ├── input.tsx             # novo: label, help, error, disabled
│   │   ├── select.tsx            # novo (select nativo estilizado)
│   │   ├── search-field.tsx      # novo
│   │   ├── avatar.tsx            # novo: imagem + fallback iniciais
│   │   ├── separator.tsx         # novo
│   │   ├── table.tsx             # novo: Table/THead/TBody/Tr/Th/Td + empty state
│   │   ├── spinner.tsx           # novo
│   │   ├── metric-card.tsx       # novo: valor BRL string + delta %
│   │   ├── transaction-item.tsx  # novo: + TransactionList com empty state
│   │   ├── credit-card-visual.tsx# novo
│   │   └── chart-container.tsx   # novo: título, legenda, slot de conteúdo
│   └── index.ts                  # exports
└── package.json                  # + lucide-react, @testing-library/react

apps/web/
├── app/
│   ├── globals.css               # importa tokens.css do @finance/ui
│   ├── layout.tsx                # script inline anti-FOUC + classe .dark
│   └── (internal)/design-system/page.tsx   # página demo (rota interna)
├── components/
│   └── theme-toggle.tsx          # alternância light/dark/system → Redux + localStorage
└── store/ui-slice.ts             # existente (theme já modelado)
```

**Structure Decision**: Design system inteiro em `packages/ui` (tokens CSS + componentes genéricos). `apps/web` consome tokens via import CSS e hospeda a rota demo `/design-system` e o `ThemeToggle` (estado de tema é client state do app, não do pacote).

## Complexity Tracking

Sem violações. Nenhuma dependência pesada adicionada (sem Radix/shadcn/Storybook nesta fase); `lucide-react` é a única lib nova (ícones, tree-shakeable).
