# Contract: GET /transactions/forecast

Segue o mesmo estilo dos schemas em `packages/contracts/src/transactions/transaction.ts` (zod, money como string decimal via `moneyAmountSchema`, datas ISO/`YYYY-MM`).

## Request

`GET /transactions/forecast?from=2026-08&months=6`

Novo schema `forecastQuerySchema` em `packages/contracts/src/transactions/forecast.ts`:

```ts
export const forecastQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}$/), // mês 1, YYYY-MM, derivado do filtro global de período
  months: z.union([
    z.literal(1), z.literal(3), z.literal(6),
    z.literal(12), z.literal(24), z.literal(36),
  ]),
});
export type ForecastQuery = z.infer<typeof forecastQuerySchema>;
```

Autenticação: mesmo guard/estratégia já usado nas demais rotas de `TransactionsController` (userId extraído do request autenticado — nunca do query param, para não permitir acessar compromissos de outro usuário, FR-009).

## Response

Novo schema `forecastResponseSchema`:

```ts
export const forecastRowSchema = z.object({
  key: z.string(),
  description: z.string(),
  recurrence: z.enum(['installment', 'fixed']),
  installmentCount: z.number().int().positive().nullable(),
  cells: z.array(z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    amount: moneyAmountSchema.nullable(),
  })),
});

export const forecastResponseSchema = z.object({
  months: z.array(z.string().regex(/^\d{4}-\d{2}$/)),
  rows: z.array(forecastRowSchema),
  totals: z.array(z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    amount: moneyAmountSchema,
  })),
});
export type ForecastResponse = z.infer<typeof forecastResponseSchema>;
```

## Erros

- 400: `months` fora do enum permitido, ou `from` mal formatado — validação já cai no zod pipe da controller, mesmo padrão das demais rotas.
- 401: sem autenticação — mesmo guard global.

## Regras cobertas (rastreabilidade para FR-*)

- FR-001, FR-007, FR-008: `months` na resposta reflete exatamente o horizonte solicitado, ancorado em `from`.
- FR-002, FR-003: cada `row` = um `groupId` de `installment` ou uma linha de `fixed`; `description`/`installmentCount` compõem o rótulo "(Nx)"/"(fixa)" no frontend.
- FR-004: `cells[].amount = null` → frontend renderiza "-".
- FR-005: `totals` já vem somado do backend (evita duplicar regra de soma no frontend).
- FR-009, FR-010: filtragem por `userId` autenticado e `type = despesa` acontece no use-case/repositório, nunca no frontend.
- FR-012: `amount` como string decimal; formatação BR (`1.000,00`) é responsabilidade do frontend (mesmo padrão usado hoje pelas outras telas de transações).
