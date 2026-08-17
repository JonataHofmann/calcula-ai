# Contracts: componentes públicos de @finance/ui

API pública do pacote (exports de `packages/ui/src/index.ts`). Mudanças aqui são breaking para `apps/web`, `apps/admin`.

## Convenções

- Todos os componentes aceitam `className?: string` (merge via `cn`).
- Atributos HTML nativos propagados via spread (`...props`).
- Money = `string` decimal. Componentes nunca recebem `number` para valores monetários.

## Componentes evoluídos (compatibilidade obrigatória — FR-009)

### Button

```ts
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'; // default 'primary'
  size?: 'sm' | 'md' | 'lg';                                   // default 'md'
  loading?: boolean;                                            // NOVO: spinner + disabled + aria-busy
}
```

Estados visuais: default, hover, focus-visible (ring `--color-focus-ring`), disabled, loading.

### Card / CardHeader / CardTitle / CardContent

Assinaturas atuais mantidas (`HTMLAttributes<HTMLDivElement>`; `CardTitle` = heading). Visual migra para tokens (`bg-surface`, `border-border`, `--radius-lg`, `--shadow-sm`).

### Badge

```ts
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'; // 'info' NOVO
}
```

### Skeleton

Assinatura atual mantida. Visual via tokens.

## Componentes novos — básicos

### Input

```ts
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;        // renderiza <label htmlFor>
  helpText?: string;     // aria-describedby
  error?: string;        // estado de erro: borda danger + mensagem + aria-invalid + aria-describedby
}
```

### Select

```ts
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helpText?: string;
  error?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;  // option desabilitada inicial
}
```

### SearchField

```ts
interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void; // Enter
}
```

Ícone de busca embutido; `type="search"`, `role` nativo.

### Avatar

```ts
interface AvatarProps {
  src?: string;
  alt: string;           // obrigatório (a11y)
  name?: string;         // fallback: iniciais derivadas
  size?: 'sm' | 'md' | 'lg'; // default 'md'
  className?: string;
}
```

Fallback: iniciais sobre `bg-primary`/`text-primary-foreground` quando `src` ausente ou falha.

### Separator

```ts
interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'; // default 'horizontal'
}
```

`role="separator"`, `aria-orientation`.

### Spinner

```ts
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'; // default 'md'
  label?: string;             // default 'Carregando…' (sr-only + role="status")
  className?: string;
}
```

### Table (composto)

```ts
Table, TableHeader, TableBody, TableRow, TableHead, TableCell  // wrappers de <table>/<thead>/...
interface TableEmptyProps { colSpan: number; message?: string } // default 'Nenhum registro encontrado'
```

## Componentes novos — domínio financeiro (apresentação pura, sem fetch/regras)

### MetricCard

```ts
interface MetricCardProps {
  title: string;
  value: string;                 // decimal string BRL, ex. "24098.00"
  delta?: string;                // variação percentual como string, ex. "12.5" | "-3.2"
  deltaLabel?: string;           // ex. "vs. mês anterior"
  icon?: ReactNode;
  tone?: 'default' | 'strong';   // 'strong' = superfície escura de destaque (referência)
  className?: string;
}
```

Regras: `value` formatado via `formatBRL`; `delta` positivo → `--color-success` + seta ↑, negativo → `--color-danger` + ↓.

### TransactionItem / TransactionList

```ts
interface TransactionItemProps {
  description: string;
  date: string;                  // já formatada pelo chamador (pt-BR)
  amount: string;                // decimal string; sinal define cor/semântica
  icon?: ReactNode;
  category?: string;
  className?: string;
}

interface TransactionListProps {
  items: TransactionItemProps[];
  emptyMessage?: string;         // default 'Nenhuma transação'
  className?: string;
}
```

Regras: `amount` negativo → texto `--color-danger`, prefixo "-"; positivo → `--color-success`, prefixo "+". Descrições longas truncam com ellipsis.

### CreditCardVisual

```ts
interface CreditCardVisualProps {
  brand?: string;                // ex. 'Visa'
  holderName: string;
  maskedNumber: string;          // ex. '**** **** **** 1234' (nunca número completo)
  expiry?: string;               // 'MM/AA'
  tone?: 'dark' | 'primary';     // default 'dark'
  className?: string;
}
```

Regra de segurança: componente aceita apenas número mascarado; não formata/recebe PAN completo.

### ChartContainer

```ts
interface ChartContainerProps {
  title: string;
  legend?: Array<{ label: string; colorToken: 'primary' | 'accent' | 'success' | 'danger' | 'warning' | 'info' }>;
  actions?: ReactNode;           // ex. seletor de período
  children: ReactNode;           // gráfico injetado pelo consumidor
  className?: string;
}
```

## Utilitários

```ts
cn(...inputs: ClassValue[]): string                    // existente
formatBRL(value: string): string                       // "1500.00" → "R$ 1.500,00"; lança em string inválida
formatPercent(value: string, signed?: boolean): string // "12.5" → "12,5%" / "+12,5%"
```

## App-level (apps/web, fora do pacote ui)

### ThemeToggle (`apps/web/components/theme-toggle.tsx`)

Client component. Cicla/seleciona `'light' | 'dark' | 'system'`; despacha `setTheme` (ui-slice), persiste `localStorage.theme`, sincroniza classe `.dark` no `<html>`. Botão com `aria-label` descrevendo o tema atual.

### Rota demo

`/design-system` — página interna listando tokens e todos os componentes acima em todas as variantes/estados, com ThemeToggle.
