# Agent Guide: Frontend (apps/web)

## Structure

```
apps/web/
├── app/          # App Router: layouts, pages, providers
├── features/     # domain features: accounts, transactions, cards, budgets, goals, dashboard, ai
├── components/   # app-wide shared components (not generic enough for packages/ui)
├── hooks/        # app-wide shared hooks
├── services/     # api-client.ts + one <domain>-api.ts per domain (only place with fetch)
├── store/        # Redux Toolkit: client state only
└── types/        # app-local types (shared types go to @finance/contracts)
```

## Data flow (mandatory)

```
Component ► hook (feature) ► TanStack Query ► services/<domain>-api.ts ► BFF
```

- NO fetch inside components.
- NO business rules in components (formatting is fine; financial calculation is not).
- Server state: TanStack Query (queries, mutations, cache, invalidation).
- Client state: Redux Toolkit (theme, sidebar, global filters, selected period,
  chat UI state, local drafts).
- Forms: React Hook Form + Zod, reusing schemas from `@finance/contracts`.

## Components

- Small, single-responsibility. Split screens (`Dashboard.tsx` orchestrates
  `BalanceSummary.tsx`, `BudgetOverview.tsx`, ... — each fetches via its own hook).
- Generic (Button, Dialog, CurrencyInput...) -> `packages/ui`.
- Feature-specific (TransactionForm, BudgetProgress...) -> `apps/web/features/<domain>/`.
- Tailwind CSS only. No MUI/Chakra/styled-components. Mobile-first. Support
  light/dark/system via the `ui` store slice.

## Design system (@finance/ui)

- Tokens live in `packages/ui/src/styles/tokens.css`: CSS custom properties in
  `:root` (light) and `.dark` (dark), mapped to Tailwind v4 utilities via
  `@theme inline`. `apps/web/app/globals.css` imports them with
  `@import '@finance/ui/styles/tokens.css'`.
- **No raw palette**: never use hex values or raw Tailwind palette classes
  (`bg-blue-600`, `text-gray-500`...) in components. Use semantic utilities only:
  `bg-background`, `bg-surface`, `bg-surface-strong`, `bg-primary`, `text-text`,
  `text-text-muted`, `border-border`, `text-success`/`bg-success-soft`,
  `danger`, `warning`, `info`, `ring-focus-ring`.
- Money display: use `formatBRL(value: string)` / `formatPercent(value: string)`
  from `@finance/ui` — money props are decimal strings, never `number`.
- Theme: class `.dark` on `<html>`. Anti-FOUC inline script in
  `apps/web/app/layout.tsx`; `ThemeToggle` (`apps/web/components/theme-toggle.tsx`)
  dispatches `setTheme` (ui-slice) + persists `localStorage.theme`.
- Available components: Button (loading), Card, Badge (info), Skeleton, Input,
  Select, SearchField, Avatar, Separator, Spinner, Table (+TableEmpty),
  MetricCard, TransactionItem/List, CreditCardVisual, ChartContainer.
- Living reference: `/design-system` route (`apps/web/app/(internal)/design-system/`).
- Token provenance and AA contrast validation: `specs/002-design-system/figma-tokens.md`.
