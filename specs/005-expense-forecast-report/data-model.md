# Data Model: Relatório de Previsão de Despesas

Nenhuma nova entidade persistida é introduzida. Todas as estruturas abaixo são derivadas em memória a partir de transações já existentes (`Transaction`, ver `services/api/src/modules/transactions/domain/transaction.ts`).

## Linha de Previsão (derivada, não persistida)

Representa um compromisso recorrente do usuário: um grupo de parcelamento (`installment`, agrupado por `groupId`) ou uma despesa fixa (`fixed`, uma linha por transação/grupo).

| Campo | Tipo | Origem/Regra |
|---|---|---|
| `key` | string | `groupId` do compromisso (identificador estável da linha) |
| `description` | string | `description` da transação/grupo |
| `recurrence` | `'installment' \| 'fixed'` | `Transaction.recurrence` |
| `installmentCount` | number \| null | `installmentCount` (só para `installment`); usado para rotular "(Nx)" |
| `cells` | array de `{ month: string (YYYY-MM), amountCents: number \| null }` | Uma célula por mês do horizonte. `amountCents = null` quando o compromisso não se aplica àquele mês (ainda não iniciou, já terminou, ou excedeu `endDate`/parcela final). Caso contrário, é o valor real da ocorrência daquele mês (permite variação entre meses — reajuste). |

**Regras de derivação**:
- `installment`: para cada mês do horizonte, buscar se existe uma parcela (`groupId` + `dueDate` cujo ano/mês bate) já persistida; se sim, `amountCents = parcela.amount` (em centavos); se o mês está fora do intervalo `[primeira parcela, última parcela]`, `amountCents = null`.
- `fixed`: para o mês âncora (mês 1) e seguintes, usar a última ocorrência conhecida (persistida) como ponto de partida; projetar meses seguintes via `addMonthClamped`/`nextOccurrence`, respeitando `endDate` quando presente (`amountCents = null` além do `endDate`). O valor de cada célula projetada é o valor da última ocorrência conhecida (não há reajuste futuro conhecido a priori); se uma ocorrência real já materializada existir para aquele mês com valor diferente, essa prevalece.

## Linha de Total (derivada)

| Campo | Tipo | Regra |
|---|---|---|
| `cells` | array de `{ month, amountCents }` | Para cada mês, soma de `amountCents` (tratando `null` como 0) de todas as Linhas de Previsão daquele mês. |

## Horizonte de Meses (preferência de sessão, não persistida)

| Campo | Tipo | Regra |
|---|---|---|
| `months` | `1 \| 3 \| 6 \| 12 \| 24 \| 36` | Controla quantas colunas de mês são exibidas. Estado de sessão no frontend (ex. React state/local component state), não enviado para persistência no backend além de ser um parâmetro de query da requisição do relatório. |

## Contrato de Query (request ao backend)

| Campo | Tipo | Regra |
|---|---|---|
| `from` | string (YYYY-MM) | Mês 1, derivado do filtro global de período (`period.year`/`period.month`). |
| `months` | `1 \| 3 \| 6 \| 12 \| 24 \| 36` | Horizonte selecionado. |

## Contrato de Resposta (backend → frontend)

```
{
  months: string[]              // ["2026-08", "2026-09", ...], tamanho = months
  rows: Array<{
    key: string
    description: string
    recurrence: 'installment' | 'fixed'
    installmentCount: number | null
    cells: Array<{ month: string; amount: string | null }>  // amount como string decimal (mesmo formato de moneyAmountSchema), null = "-"
  }>
  totals: Array<{ month: string; amount: string }>
}
```

Valores monetários trafegam como string decimal (mesmo padrão de `moneyAmountSchema` em `packages/contracts`), convertidos para/de centavos internamente via `toCents`/`fromCents` — nunca aritmética em ponto flutuante.
