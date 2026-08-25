import { Injectable } from '@nestjs/common';
import type {
  CategoryNodeDto,
  CategorySuggestionResult,
  CategoryTreeDto,
  CommitInvoiceInput,
  CommitInvoiceResult,
  InvoiceExtractionResult,
} from '@finance/contracts';
import {
  AiApiClient,
  type InvoiceStepEmitter,
  type UploadedInvoice,
} from '../../common/ai-api-client';
import { ApiClient } from '../../common/api-client';

/** Name of the system placeholder assigned when nothing categorizes a line. */
const SEM_CATEGORIA = 'Sem Categoria';

/**
 * Flattens the expense branch into {id, path-name} options for the AI to pick from.
 * The "Sem Categoria" placeholder is left out so the model can't pick it as a cop-out —
 * it is applied by us only as the last-resort fallback.
 */
function flattenExpenseCategories(
  tree: CategoryTreeDto,
): Array<{ id: string; name: string }> {
  const out: Array<{ id: string; name: string }> = [];
  const walk = (nodes: CategoryNodeDto[], prefix: string) => {
    for (const node of nodes) {
      if (node.name === SEM_CATEGORIA) continue;
      const name = prefix ? `${prefix} > ${node.name}` : node.name;
      out.push({ id: node.id, name });
      if (node.children.length > 0) walk(node.children, name);
    }
  };
  walk(tree.expense, '');
  return out;
}

/** The "Sem Categoria" placeholder id within a category branch, or null if absent. */
function findSemCategoriaId(nodes: CategoryNodeDto[]): string | null {
  for (const node of nodes) {
    if (node.name === SEM_CATEGORIA) return node.id;
    const child = findSemCategoriaId(node.children);
    if (child) return child;
  }
  return null;
}

/** A line is a credit (estorno/pagamento/crédito) when its amount is negative — a receita. */
function isIncomeLine(amount: string): boolean {
  return Number(amount) < 0;
}

/**
 * Orchestrates invoice extraction: ai-ms extracts the lines AND suggests a category
 * per line from the user's categories (toda lógica de IA vive no ai-ms). The api then
 * fills any line the AI left uncategorized from the user's history (FR-011). The BFF
 * only forwards the user's Bearer token — no money math, no persistence.
 */
@Injectable()
export class InvoiceImportService {
  constructor(
    private readonly ai: AiApiClient,
    private readonly api: ApiClient,
  ) {}

  async extract(
    token: string,
    file: UploadedInvoice,
    fields: { creditCardId: string; password?: string },
  ): Promise<InvoiceExtractionResult> {
    const form: Record<string, string> = { creditCardId: fields.creditCardId };
    if (fields.password !== undefined) form.password = fields.password;

    // Give the AI the user's categories so it can pre-suggest one per line.
    const tree = await this.api.get<CategoryTreeDto>('/categories', { token });
    form.categories = JSON.stringify(flattenExpenseCategories(tree));

    const extraction = await this.ai.extractInvoice<InvoiceExtractionResult>(
      token,
      file,
      form,
    );

    return this.enrichWithSuggestions(token, extraction, {
      expense: findSemCategoriaId(tree.expense),
      income: findSemCategoriaId(tree.income),
    });
  }

  /**
   * Igual a extract, mas transmite o progresso passo a passo via `onEvent`: emite os passos
   * do BFF (upload recebido, carregando categorias, categorizando, concluído) e repassa os
   * passos do ai-ms (lendo PDF, IA, processando). O evento `done` final carrega o resultado
   * JÁ enriquecido. Erros propagam como exceção para o controller emitir o evento `error`.
   */
  async extractStream(
    token: string,
    file: UploadedInvoice,
    fields: { creditCardId: string; password?: string },
    onEvent: InvoiceStepEmitter,
  ): Promise<void> {
    onEvent({ step: 'uploading', status: 'done', message: 'Arquivo recebido' });

    onEvent({ step: 'loading_categories', status: 'start', message: 'Carregando categorias' });
    const tree = await this.api.get<CategoryTreeDto>('/categories', { token });
    onEvent({ step: 'loading_categories', status: 'done', message: 'Categorias carregadas' });

    const form: Record<string, string> = {
      creditCardId: fields.creditCardId,
      categories: JSON.stringify(flattenExpenseCategories(tree)),
    };
    if (fields.password !== undefined) form.password = fields.password;

    // Repassa os passos do ai-ms (reading_pdf/extracting_ai/processing); o `done` do ai-ms
    // é consumido internamente e devolve o resultado bruto aqui.
    const extraction = await this.ai.extractInvoiceStream<InvoiceExtractionResult>(
      token,
      file,
      form,
      onEvent,
    );

    onEvent({ step: 'categorizing', status: 'start', message: 'Categorizando transações' });
    const enriched = await this.enrichWithSuggestions(token, extraction, {
      expense: findSemCategoriaId(tree.expense),
      income: findSemCategoriaId(tree.income),
    });
    onEvent({ step: 'categorizing', status: 'done', message: 'Transações categorizadas' });

    onEvent({
      step: 'done',
      status: 'done',
      message: 'Importação pronta para revisão',
      result: enriched,
    });
  }

  /**
   * Proxies the reviewed replace/merge commit to the api (FR-012..FR-019). The BFF adds no
   * business logic — it only forwards the user's Bearer token and the Idempotency-Key so a
   * retried submit is safe upstream.
   */
  async commit(
    token: string,
    input: CommitInvoiceInput,
    idempotencyKey: string,
  ): Promise<CommitInvoiceResult> {
    return this.api.post<CommitInvoiceResult>('/transactions/invoice-import', {
      token,
      body: input,
      idempotencyKey,
    });
  }

  /**
   * Fills each expense line the AI left uncategorized (`suggestedCategoryId === null`) from
   * history, then defaults whatever is still null to the expense "Sem Categoria" placeholder.
   * Credit lines (negative amount) are receitas: the AI only ever sees expense categories, so
   * any suggestion it made for them is the wrong type — those are overridden to the income
   * placeholder (or cleared to null so the user picks an income category in review). This keeps
   * every line's category coherent with its type before the commit validates it.
   */
  private async enrichWithSuggestions(
    token: string,
    extraction: InvoiceExtractionResult,
    placeholders: { expense: string | null; income: string | null },
  ): Promise<InvoiceExtractionResult> {
    // History matching (expense-only upstream) applies just to expense lines still uncategorized.
    const descriptions = [
      ...new Set(
        extraction.lines
          .filter((l) => !isIncomeLine(l.amount) && l.suggestedCategoryId === null)
          .map((l) => l.description),
      ),
    ];

    const byDescription = new Map<string, string | null>();
    if (descriptions.length > 0) {
      const query = descriptions
        .map((d) => `descriptions=${encodeURIComponent(d)}`)
        .join('&');
      const suggestions = await this.api.get<CategorySuggestionResult>(
        `/transactions/category-suggestions?${query}`,
        { token },
      );
      for (const s of suggestions) byDescription.set(s.description, s.categoryId);
    }

    return {
      ...extraction,
      lines: extraction.lines.map((line) =>
        isIncomeLine(line.amount)
          ? { ...line, suggestedCategoryId: placeholders.income }
          : {
              ...line,
              suggestedCategoryId:
                line.suggestedCategoryId ??
                byDescription.get(line.description) ??
                placeholders.expense,
            },
      ),
    };
  }
}
