# Contract: Invoice Import Schemas (`@finance/contracts`)

Novo arquivo `packages/contracts/src/transactions/import-invoice.ts`, exportado em `packages/contracts/src/index.ts` (`export * from './transactions/import-invoice.js'`). Reusa `moneyAmountSchema` (`src/common/money.ts`) e o padrão de datas ISO/uuid do domínio. Money **sempre** string decimal; nunca number.

Assinaturas (forma alvo — nomes definitivos podem ajustar-se ao estilo do arquivo):

```ts
// mês de referência: "YYYY-MM"
export const referenceMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

// linha extraída (ai-ms -> revisão)
export const extractedInvoiceLineSchema = z.object({
  lineId: z.string().uuid(),
  date: z.string().datetime(),               // instante ISO (UTC)
  description: z.string().min(1).max(120),
  amount: moneyAmountSchema,                  // pode ser negativo (estorno)
  installmentNumber: z.number().int().positive().nullable(),
  installmentCount: z.number().int().positive().nullable(),
  uncertain: z.boolean(),
  suggestedCategoryId: z.string().uuid().nullable(),
});
export type ExtractedInvoiceLine = z.infer<typeof extractedInvoiceLineSchema>;

// resultado da extração (ai-ms -> bff); bff preenche suggestedCategoryId depois
export const invoiceExtractionResultSchema = z.object({
  referenceMonth: referenceMonthSchema,
  dueDate: z.string().datetime().nullable(),
  lines: z.array(extractedInvoiceLineSchema),
});
export type InvoiceExtractionResult = z.infer<typeof invoiceExtractionResultSchema>;

// linha revisada (entrada do commit)
export const invoiceReviewLineSchema = extractedInvoiceLineSchema.extend({
  categoryId: z.string().uuid(),             // obrigatório ao gravar
  discarded: z.boolean().default(false),
});
export type InvoiceReviewLine = z.infer<typeof invoiceReviewLineSchema>;

// corpo do commit (bff -> api). SEM userId (vem do JWT no api)
export const commitInvoiceInputSchema = z.object({
  creditCardId: z.string().uuid(),
  referenceMonth: referenceMonthSchema,
  mode: z.enum(['replace', 'merge']),
  lines: z.array(invoiceReviewLineSchema).min(1),
});
export type CommitInvoiceInput = z.infer<typeof commitInvoiceInputSchema>;

export const commitInvoiceResultSchema = z.object({
  added: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
});
export type CommitInvoiceResult = z.infer<typeof commitInvoiceResultSchema>;

// sugestão de categoria por histórico (api leitura)
export const categorySuggestionResultSchema = z.array(z.object({
  description: z.string(),
  categoryId: z.string().uuid().nullable(),
}));
export type CategorySuggestionResult = z.infer<typeof categorySuggestionResultSchema>;
```

Notas:
- `transactionSourceSchema` (em `src/transactions/transaction.ts`) ganha o valor `'imported'` além de `manual|synced`.
- A saída bruta do modelo em `ai-ms` é validada por um schema interno (`invoiceExtractionSchema`) antes de virar `InvoiceExtractionResult` — não precisa ser exportado no pacote de contratos se for só interno ao ai-ms; se compartilhado, mora aqui.
- O upload multipart (arquivo + `password` + `creditCardId`) **não** é um schema Zod de corpo JSON; os campos de texto são validados manualmente (Zod) no controller multipart. A senha nunca aparece em nenhum schema de resposta.
