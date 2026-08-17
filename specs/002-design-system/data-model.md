# Data Model: Design System — Financial Dashboard

Sem persistência em banco. "Dados" desta feature são tokens de design, contratos de props e estado de tema.

## 1. Tokens de design (CSS custom properties)

Fonte: extração Figma (R1). Nomes semânticos; valores light em `:root`, overrides em `.dark`.

### Cores semânticas

| Token | Papel | Regra de validação |
|---|---|---|
| `--color-background` | fundo da página | contraste com `--color-text` ≥ 4.5:1 |
| `--color-surface` | cards/painéis | contraste com `--color-text` ≥ 4.5:1 |
| `--color-surface-strong` | painéis de destaque (sidebar/cartão escuro da referência) | contraste com `--color-surface-strong-foreground` ≥ 4.5:1 |
| `--color-surface-strong-foreground` | texto sobre surface-strong | — |
| `--color-primary` | ação principal / marca | contraste com `--color-primary-foreground` ≥ 4.5:1 |
| `--color-primary-foreground` | texto sobre primary | — |
| `--color-accent` | destaque secundário (acento do template) | contraste com `--color-accent-foreground` ≥ 4.5:1 |
| `--color-accent-foreground` | texto sobre accent | — |
| `--color-text` | texto principal | — |
| `--color-text-muted` | texto secundário | ≥ 4.5:1 sobre background e surface |
| `--color-border` | bordas/divisores | ≥ 3:1 sobre background (componentes UI) |
| `--color-success` / `--color-success-soft` | receita/positivo (texto forte / fundo suave) | texto success sobre success-soft ≥ 4.5:1 |
| `--color-danger` / `--color-danger-soft` | despesa/negativo | idem |
| `--color-warning` / `--color-warning-soft` | aviso | idem |
| `--color-info` / `--color-info-soft` | informação | idem |
| `--color-focus-ring` | anel de foco | ≥ 3:1 sobre background em ambos os temas |

### Tipografia

| Token | Conteúdo |
|---|---|
| `--font-sans` | família extraída da referência + fallbacks do sistema |
| `--text-xs/sm/base/lg/xl/2xl/3xl` | escala de tamanho + line-height correspondente |
| Pesos | 400 / 500 / 600 / 700 (conforme referência) |

### Espaçamento, raios, sombras

| Token | Conteúdo |
|---|---|
| Espaçamento | escala Tailwind padrão (base 4px), conferida contra a referência |
| `--radius-sm/md/lg/xl/full` | raios extraídos (cards da referência usam raios generosos) |
| `--shadow-sm/md/lg` | sombras extraídas (elevação sutil dos cards) |

**Regras**:
- Todo componente referencia apenas tokens semânticos (nunca hex ou paleta bruta Tailwind).
- `.dark` redefine somente custom properties — nenhum componente tem lógica própria de tema além de consumir tokens.
- Validação AA: tabela de pares (texto × fundo) verificada após extração; ajustar valor extraído se par falhar (documentar ajuste como desvio consciente da referência).

## 2. Estado de tema

```
Theme = 'light' | 'dark' | 'system'   (já existe em apps/web/store/ui-slice.ts)
```

| Campo | Onde | Transições |
|---|---|---|
| `theme` | Redux `ui-slice` + `localStorage.theme` | `setTheme(t)` → grava localStorage → aplica/remove `.dark` no `<html>` |
| resolvedTheme | derivado: `theme === 'system' ? prefers-color-scheme : theme` | listener `matchMedia('(prefers-color-scheme: dark)')` ativo quando `theme === 'system'` |

Estado inicial: `localStorage.theme ?? 'system'`, aplicado por script inline antes da hidratação (anti-FOUC).

## 3. Contratos de props (entidades de componente)

Detalhe completo em [contracts/ui-components.md](./contracts/ui-components.md). Regras transversais:

- **Money**: props monetárias são `string` decimal (`"1500.00"`, `"-89.90"`). Nunca `number`.
- **Variante**: union types fechadas (ex.: `'primary' | 'secondary' | ...`).
- **Estado de coleção**: componentes de coleção aceitam `emptyMessage?: string` e renderizam estado vazio quando sem itens.
- **Acessibilidade**: componentes interativos propagam atributos nativos (`aria-*`, `disabled`); erro de campo vincula via `aria-describedby` + `aria-invalid`.
