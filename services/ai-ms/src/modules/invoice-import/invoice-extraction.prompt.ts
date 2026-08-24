import { z } from 'zod';

/**
 * Raw shape the model must return. The service enriches each line afterwards
 * (adds lineId) and validates `categoryId` against the allowed set. Money is a
 * decimal string and MAY be negative (estorno/crédito).
 */
export const modelInvoiceLineSchema = z.object({
  date: z.string(),
  description: z.string().min(1),
  amount: z.string(),
  installmentNumber: z.number().int().positive().nullable(),
  installmentCount: z.number().int().positive().nullable(),
  uncertain: z.boolean(),
  // Best-fitting category id chosen from the provided list, or null.
  categoryId: z.string().nullable().default(null),
});
export type ModelInvoiceLine = z.infer<typeof modelInvoiceLineSchema>;

export const modelInvoiceExtractionSchema = z.object({
  referenceMonth: z.string(),
  dueDate: z.string().nullable(),
  total: z.string().nullable().default(null),
  lines: z.array(modelInvoiceLineSchema),
});
export type ModelInvoiceExtraction = z.infer<
  typeof modelInvoiceExtractionSchema
>;

/** A category the model may assign to a line. `name` is the full path for context. */
export interface InvoiceCategoryOption {
  id: string;
  name: string;
}

export const EXTRACTION_MODEL =
  process.env.AI_INVOICE_MODEL ?? 'gemini/gemini-3.5-flash-lite';

const SYSTEM_PROMPT = `Você é um extrator de faturas de cartão de crédito brasileiras.
Recebe o TEXTO BRUTO de uma fatura (já decriptada) e devolve SOMENTE um JSON válido, sem markdown, sem comentários, no formato:

{
  "referenceMonth": "YYYY-MM",
  "dueDate": "YYYY-MM-DDTHH:mm:ss.sssZ" | null,
  "total": "0.00" | null,
  "lines": [
    {
      "date": "YYYY-MM-DDTHH:mm:ss.sssZ",
      "description": "texto da transação",
      "amount": "0.00",
      "installmentNumber": number | null,
      "installmentCount": number | null,
      "uncertain": boolean,
      "categoryId": "uuid da categoria" | null
    }
  ]
}

Regras:
- "referenceMonth" é o mês de referência da fatura (competência), no formato YYYY-MM.
- "dueDate" é a data de vencimento da fatura em ISO 8601, ou null se não encontrada.
- "total" é o valor TOTAL da fatura ("Total da fatura"/"Total a pagar") como string decimal com ponto e duas casas (ex.: "10937.10"), ou null se não encontrado. NUNCA use separador de milhar.
- Cada transação vira uma linha em "lines". Use a data de cada lançamento em ISO 8601.
- "amount" é SEMPRE uma string decimal com ponto e duas casas (ex.: "123.45"). Estornos/créditos são negativos (ex.: "-50.00"). NUNCA use separador de milhar.
- Se a descrição indicar parcela no formato "X/Y" (ex.: "PARC 03/10", "2/12", "PARCELA 3 DE 12"), preencha installmentNumber=X e installmentCount=Y. Caso contrário ambos são null.
- "uncertain" = true quando você tiver baixa confiança na linha (valor ou descrição ambíguos), senão false.
- "categoryId": escolha a categoria que MELHOR se encaixa na descrição da transação, usando SOMENTE um dos ids da lista "Categorias disponíveis" fornecida. Se nenhuma categoria se encaixar bem, ou se a lista estiver vazia, use null. NUNCA invente um id fora da lista.
- NÃO inclua pagamentos da fatura anterior, saldo, juros informativos ou o total — apenas lançamentos de compras/estornos em "lines".
- Responda APENAS com o JSON.`;

/** Renders the available categories as an id/name reference block for the prompt. */
function buildCategoriesBlock(categories: InvoiceCategoryOption[]): string {
  if (categories.length === 0) {
    return 'Categorias disponíveis: (nenhuma — use categoryId=null em todas as linhas)';
  }
  const lines = categories.map((c) => `- ${c.id} = ${c.name}`).join('\n');
  return `Categorias disponíveis (use o id EXATO em "categoryId"):\n${lines}`;
}

/** Builds the messages array for an extraction request. */
export function buildExtractionMessages(
  pdfText: string,
  categories: InvoiceCategoryOption[] = [],
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildCategoriesBlock(categories) },
    { role: 'user', content: pdfText },
  ];
}

/** Corrective retry message appended when the first output failed validation. */
export function buildRetryMessage(errorSummary: string): {
  role: 'user';
  content: string;
} {
  return {
    role: 'user',
    content: `O JSON anterior era inválido: ${errorSummary}. Responda novamente APENAS com o JSON válido no formato especificado.`,
  };
}

/** Strips optional ```json fences and parses the model text into the raw schema. */
export function parseModelExtraction(raw: string): ModelInvoiceExtraction {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  return modelInvoiceExtractionSchema.parse(JSON.parse(cleaned));
}
