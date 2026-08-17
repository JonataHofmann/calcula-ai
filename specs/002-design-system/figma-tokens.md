# Figma Tokens — extração real (T001)

**Fonte**: Figma API REST — arquivo `8kMF6TIrl8aRLKeTcpRouQ`, node `1-12` (template community "cloudcash" Financial Dashboard).
**Data**: 2026-08-17. Extração one-shot via `GET /v1/files/:key/nodes?ids=1-12` (research R1).

> Nota: os valores reais extraídos divergem do fallback documentado em research R1
> (que previa paleta verde/teal). O template real é azul (`#197BBD`). Valores abaixo
> são os extraídos; ajustes AA documentados na seção "Desvios".

## Valores brutos extraídos

### Cores (por frequência de uso em fills/strokes)

| Hex | Uso no template |
|---|---|
| `#404040` | texto principal (30 usos) |
| `#FFFFFF` | superfícies/cards (24) |
| `#197BBD` | primária (marca, strokes de gráfico, botões) |
| `#C7C7C7` / `#AEAEAE` / `#696969` | textos secundários/ícones |
| `#ECECEC` / `#EFEFEF` / `#E3E3E3` / `#EBEBEB` | bordas/divisores |
| `#F8F8F8` / `#F1F1F1` | fundos de página/painéis |
| `#FFC145` | acento amarelo (limite semanal, destaques) |
| `#D15842` / `#BB4430` / `#ED654C` | negativo/despesa |
| `#22A447` / `#439A86` | positivo/receita (strokes de gráfico) |
| `#70A6E8` / `#F0F7FF` / `#E4F0FF` | informação/soft azul |
| `#DDF9E4` | soft verde (badge receita) |
| `#FFEADA` | soft laranja (badge aviso) |
| `#F8964C` | stroke laranja (gráfico outcome) |
| `#0F4264` | painel escuro de destaque (cartão premium) |

### Tipografia

Famílias no template: **Suprema** (títulos/corpo), **Lato** (tabelas/valores), **Quicksand** (marca).
Tamanhos observados: 8.75, 12, 14 (dominante, lh ~17), 16, 20 (lh ~25), 24 (lh ~29), 31.5 (lh ~38), 43.4 (lh ~53).
Pesos: 300/400/500/600/700.

### Raios

Observados: 2, 3, 5, 8, ~10.8, ~13.6, ~19, 26–28 (pills), 59 (full).
Escala derivada: `sm=6px`, `md=10px`, `lg=14px`, `xl=20px`, `full=9999px`.

### Sombras (drop shadows, todas pretas de baixa opacidade)

| Extraída | Token |
|---|---|
| `0 2 6 rgba(0,0,0,.04)` / `0 0 1 .04` | `--shadow-sm` |
| `0 4 8 .04` + `0 16 24 .04` | `--shadow-md` |
| `0 24 32 .04` / `0 16 24 .06` / `0 0 50 .05` | `--shadow-lg` |

## Mapeamento semântico final (tokens.css)

### Tema claro (`:root`)

| Token | Valor | Origem |
|---|---|---|
| `--color-background` | `#F8F8F8` | extraído |
| `--color-surface` | `#FFFFFF` | extraído |
| `--color-surface-strong` | `#0F4264` | extraído (cartão premium) |
| `--color-surface-strong-foreground` | `#FFFFFF` | extraído |
| `--color-primary` | `#197BBD` | extraído |
| `--color-primary-foreground` | `#FFFFFF` | extraído |
| `--color-accent` | `#FFC145` | extraído |
| `--color-accent-foreground` | `#404040` | extraído |
| `--color-text` | `#404040` | extraído |
| `--color-text-muted` | `#696969` | extraído (ver desvio 1) |
| `--color-border` | `#E3E3E3` | extraído (ver desvio 2) |
| `--color-success` | `#1B7F3B` | ajustado de `#22A447` (desvio 3) |
| `--color-success-soft` | `#DDF9E4` | extraído |
| `--color-danger` | `#B03F2C` | ajustado de `#BB4430` (desvio 3) |
| `--color-danger-soft` | `#FBE4DE` | derivado de `#FFEADA`/`#ED654C` |
| `--color-warning` | `#8A5C00` | ajustado de `#FFC145` (desvio 3) |
| `--color-warning-soft` | `#FFEADA` | extraído |
| `--color-info` | `#14669D` | ajustado de `#197BBD`/`#70A6E8` (desvio 3) |
| `--color-info-soft` | `#E4F0FF` | extraído |
| `--color-focus-ring` | `#197BBD` | extraído (≥3:1 sobre fundos claros) |

### Tema escuro (`.dark`)

Derivado do painel escuro `#0F4264` do template (o template não tem tema escuro completo — desvio 4):

| Token | Valor |
|---|---|
| `--color-background` | `#0D1520` |
| `--color-surface` | `#16212E` |
| `--color-surface-strong` | `#0F4264` |
| `--color-surface-strong-foreground` | `#FFFFFF` |
| `--color-primary` | `#3D97D3` |
| `--color-primary-foreground` | `#0D1520` |
| `--color-accent` | `#FFC145` |
| `--color-accent-foreground` | `#0D1520` |
| `--color-text` | `#EDF2F7` |
| `--color-text-muted` | `#A3B2C2` |
| `--color-border` | `#2C3A4B` |
| `--color-success` | `#5BC97E` |
| `--color-success-soft` | `#12331E` |
| `--color-danger` | `#F08A76` |
| `--color-danger-soft` | `#3B1912` |
| `--color-warning` | `#FFC145` |
| `--color-warning-soft` | `#3A2B10` |
| `--color-info` | `#7FB8E8` |
| `--color-info-soft` | `#122B41` |
| `--color-focus-ring` | `#7FB8E8` |

### Tipografia final

`--font-sans: 'Inter', 'Lato', ui-sans-serif, system-ui, sans-serif` (desvio 5 — Suprema é fonte proprietária não distribuível).
Escala: `xs 12/16`, `sm 14/20`, `base 16/24`, `lg 20/28`, `xl 24/32`, `2xl 32/40`, `3xl 44/52`.

## Desvios conscientes da referência (validação AA — data-model §1)

1. **`#AEAEAE` rejeitado como text-muted** (2.3:1 sobre branco). Usado `#696969` (5.5:1 sobre `#FFFFFF`, 5.0:1 sobre `#F8F8F8`) ✓.
2. **Borda `#E3E3E3` não atinge 3:1** sobre background — mantida como decorativa (divisores). Componentes interativos usam `--color-focus-ring` (`#197BBD`, 4.0:1 sobre `#F8F8F8` ≥ 3:1) para o estado de foco ✓.
3. **Cores de status como texto**: `#22A447` (3.2:1), `#FFC145` (1.6:1), `#BB4430` (4.33:1 sobre soft) e `#197BBD` sobre soft azul reprovaram para texto AA. Ajustados: success `#1B7F3B` (4.5:1 sobre `#DDF9E4`), danger `#B03F2C` (4.8:1 sobre `#FBE4DE`), warning `#8A5C00` (5.0:1 sobre `#FFEADA`), info `#14669D` (5.3:1 sobre `#E4F0FF`). Tons originais permanecem disponíveis via accent/soft.
4. **Tema escuro é derivação**: o template não possui dark mode; valores derivados de `#0F4264` mantendo croma da marca; todos os pares texto×fundo verificados ≥ 4.5:1.
5. **Fonte**: Suprema (comercial) → stack `Inter/Lato/system`.

## Verificação de contraste (resumo — SC-003 / T031)

Pares da tabela do data-model verificados com razão WCAG (fórmula luminância relativa):

| Par (claro) | Razão | AA |
|---|---|---|
| text `#404040` × background `#F8F8F8` | 9.7:1 | ✓ |
| text `#404040` × surface `#FFFFFF` | 10.4:1 | ✓ |
| text-muted `#696969` × background | 5.0:1 | ✓ |
| primary-foreground `#FFFFFF` × primary `#197BBD` | 4.6:1 | ✓ |
| accent-foreground `#404040` × accent `#FFC145` | 6.0:1 | ✓ |
| surface-strong-foreground `#FFFFFF` × `#0F4264` | 10.9:1 | ✓ |
| success `#1B7F3B` × success-soft `#DDF9E4` | 4.5:1 | ✓ |
| danger `#B03F2C` × danger-soft `#FBE4DE` | 4.8:1 | ✓ |
| warning `#8A5C00` × warning-soft `#FFEADA` | 5.0:1 | ✓ |
| info `#14669D` × info-soft `#E4F0FF` | 5.3:1 | ✓ |
| focus-ring `#197BBD` × background | 4.0:1 (≥3) | ✓ |

| Par (escuro) | Razão | AA |
|---|---|---|
| text `#EDF2F7` × background `#0D1520` | 15.6:1 | ✓ |
| text-muted `#A3B2C2` × background | 7.4:1 | ✓ |
| primary-foreground `#0D1520` × primary `#3D97D3` | 6.1:1 | ✓ |
| success `#5BC97E` × success-soft `#12331E` | 6.3:1 | ✓ |
| danger `#F08A76` × danger-soft `#3B1912` | 5.9:1 | ✓ |
| warning `#FFC145` × warning-soft `#3A2B10` | 7.0:1 | ✓ |
| info `#7FB8E8` × info-soft `#122B41` | 6.4:1 | ✓ |
| focus-ring `#7FB8E8` × background | 7.2:1 (≥3) | ✓ |
