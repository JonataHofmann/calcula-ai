# Quickstart: Design System — Financial Dashboard

Guia de validação end-to-end. Contratos: [contracts/ui-components.md](./contracts/ui-components.md). Tokens: [data-model.md](./data-model.md).

## Pré-requisitos

- `pnpm install` na raiz
- Token de acesso Figma exportado (somente na fase de extração de tokens):
  ```bash
  export FIGMA_ACCESS_TOKEN=<seu-token>   # nunca commitar
  ```
  Arquivo: `8kMF6TIrl8aRLKeTcpRouQ`, node `1-12`.

## Validação por user story

### US1 — Tokens

```bash
pnpm turbo run build --filter=@finance/ui
```

- `packages/ui/src/styles/tokens.css` existe com `:root`, `.dark` e `@theme`.
- Nenhum componente do pacote contém hex ou classes de paleta bruta (`bg-blue-600` etc.):
  ```bash
  rg -n '(#[0-9a-fA-F]{3,8}|-(blue|gray|red|green|yellow|slate|zinc|neutral)-[0-9]{2,3})' packages/ui/src/components/
  ```
  Esperado: nenhuma ocorrência.

### US2 + US3 — Componentes

```bash
pnpm turbo run test --filter=@finance/ui
```

Esperado: testes verdes cobrindo variantes, estados (error/empty/loading), `formatBRL` (negativo, milhões, inválido → throw).

### US4 — Página demo + temas

```bash
pnpm --filter @finance/web dev
# abrir http://localhost:3000/design-system
```

Verificar:
1. Todas as seções renderizam (Tokens, Botões, Formulários, Conteúdo, Dados, Financeiro) — SC-001.
2. Alternar tema (light/dark/system) → visual troca sem reload; recarregar página → preferência mantida (SC-008, SC-009); sem flash de tema errado no load.
3. Largura 360px (DevTools) → sem overflow/sobreposição (SC-007).
4. Navegação por Tab → foco visível em todos os interativos (SC-004).
5. MetricCard com `value="1234567.89"` → `R$ 1.234.567,89` sem overflow; TransactionItem com amount negativo → vermelho com "-".
6. Comparação lado a lado com o Figma de referência → linguagem visual reconhecível (SC-005).

### Regressão (SC-006)

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Esperado: tudo verde, incluindo consumidores atuais de Button/Card/Badge/Skeleton sem alteração.

## Contraste AA (SC-003, uma vez após extração)

Para cada par texto×fundo da tabela em [data-model.md](./data-model.md), verificar razão ≥ 4.5:1 (texto) / ≥ 3:1 (bordas/foco) em ambos os temas — ex. via https://webaim.org/resources/contrastchecker/. Ajustes documentados como desvio consciente da referência.
