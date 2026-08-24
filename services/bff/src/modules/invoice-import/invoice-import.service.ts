import { Injectable } from '@nestjs/common';
import type {
  CategoryNodeDto,
  CategorySuggestionResult,
  CategoryTreeDto,
  CommitInvoiceInput,
  CommitInvoiceResult,
  InvoiceExtractionResult,
} from '@finance/contracts';
import { AiApiClient, type UploadedInvoice } from '../../common/ai-api-client';
import { ApiClient } from '../../common/api-client';

/** Flattens the expense branch into {id, path-name} options for the AI to pick from. */
function flattenExpenseCategories(
  tree: CategoryTreeDto,
): Array<{ id: string; name: string }> {
  const out: Array<{ id: string; name: string }> = [];
  const walk = (nodes: CategoryNodeDto[], prefix: string) => {
    for (const node of nodes) {
      const name = prefix ? `${prefix} > ${node.name}` : node.name;
      out.push({ id: node.id, name });
      if (node.children.length > 0) walk(node.children, name);
    }
  };
  walk(tree.expense, '');
  return out;
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

    return this.enrichWithSuggestions(token, extraction);
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

  /** Fills any line the AI left uncategorized (`suggestedCategoryId === null`) from history. */
  private async enrichWithSuggestions(
    token: string,
    extraction: InvoiceExtractionResult,
  ): Promise<InvoiceExtractionResult> {
    // Only lines the AI could not categorize need a history lookup.
    const descriptions = [
      ...new Set(
        extraction.lines
          .filter((l) => l.suggestedCategoryId === null)
          .map((l) => l.description),
      ),
    ];
    if (descriptions.length === 0) return extraction;

    const query = descriptions
      .map((d) => `descriptions=${encodeURIComponent(d)}`)
      .join('&');
    const suggestions = await this.api.get<CategorySuggestionResult>(
      `/transactions/category-suggestions?${query}`,
      { token },
    );

    const byDescription = new Map(
      suggestions.map((s) => [s.description, s.categoryId]),
    );

    return {
      ...extraction,
      lines: extraction.lines.map((line) => ({
        ...line,
        suggestedCategoryId:
          line.suggestedCategoryId ??
          byDescription.get(line.description) ??
          null,
      })),
    };
  }
}
