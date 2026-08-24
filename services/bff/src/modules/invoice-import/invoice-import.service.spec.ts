import type {
  CategorySuggestionResult,
  CategoryTreeDto,
  CommitInvoiceInput,
  InvoiceExtractionResult,
} from '@finance/contracts';
import { AiApiClient, type UploadedInvoice } from '../../common/ai-api-client';
import { ApiClient } from '../../common/api-client';
import { InvoiceImportService } from './invoice-import.service';

const TOKEN = 'user-jwt';
const FILE: UploadedInvoice = {
  buffer: Buffer.from('%PDF-1.4'),
  filename: 'fatura.pdf',
  mimetype: 'application/pdf',
};

const EMPTY_TREE: CategoryTreeDto = { expense: [], income: [] };

/** Builds an expense-only tree of root categories from {id, name} pairs. */
function treeOf(
  expense: Array<{ id: string; name: string }>,
): CategoryTreeDto {
  return {
    income: [],
    expense: expense.map((c) => ({
      id: c.id,
      name: c.name,
      icon: null,
      color: null,
      type: 'expense',
      source: 'default',
      children: [],
    })),
  } as unknown as CategoryTreeDto;
}

const SEM_CATEGORIA_ID = 'sem-cat-id';

function line(
  overrides: Partial<InvoiceExtractionResult['lines'][number]> = {},
): InvoiceExtractionResult['lines'][number] {
  return {
    lineId: 'l1',
    date: '2026-08-01T00:00:00.000Z',
    description: 'Mercado',
    amount: '123.45',
    installmentNumber: null,
    installmentCount: null,
    uncertain: false,
    suggestedCategoryId: null,
    ...overrides,
  };
}

function extraction(
  lines: InvoiceExtractionResult['lines'],
  total: InvoiceExtractionResult['total'] = null,
): InvoiceExtractionResult {
  return { referenceMonth: '2026-08', dueDate: null, total, lines };
}

function setup(
  extractResult: InvoiceExtractionResult,
  suggestions: CategorySuggestionResult,
  tree: CategoryTreeDto = EMPTY_TREE,
) {
  const extractInvoice = jest.fn().mockResolvedValue(extractResult);
  const get = jest.fn().mockImplementation((url: string) => {
    if (url === '/categories') return Promise.resolve(tree);
    return Promise.resolve(suggestions);
  });
  const ai = { extractInvoice } as unknown as AiApiClient;
  const api = { get } as unknown as ApiClient;
  const service = new InvoiceImportService(ai, api);
  return { service, extractInvoice, get };
}

describe('InvoiceImportService.extract', () => {
  it('forwards the token, file and categories to ai-ms; password only when provided', async () => {
    const { service, extractInvoice, get } = setup(extraction([]), []);

    await service.extract(TOKEN, FILE, { creditCardId: 'card-1' });

    expect(extractInvoice).toHaveBeenCalledWith(TOKEN, FILE, {
      creditCardId: 'card-1',
      categories: '[]',
    });
    // Fetches the category tree, but with no lines there is no history lookup.
    expect(get).toHaveBeenCalledWith('/categories', { token: TOKEN });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('sends the flattened expense categories to ai-ms', async () => {
    const tree: CategoryTreeDto = {
      income: [],
      expense: [
        {
          id: 'cat-food',
          name: 'Alimentação',
          icon: null,
          color: null,
          type: 'expense',
          source: 'system',
          children: [
            {
              id: 'cat-market',
              name: 'Mercado',
              icon: null,
              color: null,
              type: 'expense',
              source: 'system',
              children: [],
            },
          ],
        },
      ],
    } as unknown as CategoryTreeDto;
    const { service, extractInvoice } = setup(extraction([]), [], tree);

    await service.extract(TOKEN, FILE, { creditCardId: 'card-1' });

    const categories = (extractInvoice.mock.calls[0][2] as { categories: string })
      .categories;
    expect(JSON.parse(categories)).toEqual([
      { id: 'cat-food', name: 'Alimentação' },
      { id: 'cat-market', name: 'Alimentação > Mercado' },
    ]);
  });

  it('includes the password in the ai-ms form when supplied', async () => {
    const { service, extractInvoice } = setup(extraction([]), []);

    await service.extract(TOKEN, FILE, {
      creditCardId: 'card-1',
      password: 'secret',
    });

    expect(extractInvoice).toHaveBeenCalledWith(TOKEN, FILE, {
      creditCardId: 'card-1',
      password: 'secret',
      categories: '[]',
    });
  });

  it('keeps the AI suggestion and only queries history for uncategorized lines', async () => {
    const lines = [
      line({ lineId: 'l1', description: 'Mercado', suggestedCategoryId: 'ai-cat' }),
      line({ lineId: 'l2', description: 'Posto', suggestedCategoryId: null }),
    ];
    const { service, get } = setup(extraction(lines), [
      { description: 'Posto', categoryId: 'cat-fuel' },
    ]);

    const result = await service.extract(TOKEN, FILE, { creditCardId: 'card-1' });

    // AI suggestion is untouched; history fills only the null line.
    expect(result.lines[0]?.suggestedCategoryId).toBe('ai-cat');
    expect(result.lines[1]?.suggestedCategoryId).toBe('cat-fuel');
    expect(get).toHaveBeenCalledWith(
      '/transactions/category-suggestions?descriptions=Posto',
      { token: TOKEN },
    );
  });

  it('never offers the "Sem Categoria" placeholder to the AI', async () => {
    const tree = treeOf([
      { id: 'cat-food', name: 'Alimentação' },
      { id: SEM_CATEGORIA_ID, name: 'Sem Categoria' },
    ]);
    const { service, extractInvoice } = setup(extraction([]), [], tree);

    await service.extract(TOKEN, FILE, { creditCardId: 'card-1' });

    const categories = JSON.parse(
      (extractInvoice.mock.calls[0][2] as { categories: string }).categories,
    );
    expect(categories).toEqual([{ id: 'cat-food', name: 'Alimentação' }]);
  });

  it('defaults still-uncategorized lines to "Sem Categoria"', async () => {
    const tree = treeOf([
      { id: 'cat-food', name: 'Alimentação' },
      { id: SEM_CATEGORIA_ID, name: 'Sem Categoria' },
    ]);
    const lines = [
      line({ lineId: 'l1', description: 'X', suggestedCategoryId: 'ai-cat' }),
      line({ lineId: 'l2', description: 'Y', suggestedCategoryId: null }),
    ];
    // History has nothing for Y either.
    const { service } = setup(extraction(lines), [
      { description: 'Y', categoryId: null },
    ], tree);

    const result = await service.extract(TOKEN, FILE, { creditCardId: 'card-1' });

    expect(result.lines[0]?.suggestedCategoryId).toBe('ai-cat');
    expect(result.lines[1]?.suggestedCategoryId).toBe(SEM_CATEGORIA_ID);
  });

  it('routes a negative line (estorno) to the income placeholder, not expense history', async () => {
    const INCOME_SEM_CAT = 'income-sem-cat';
    const tree = {
      expense: [
        {
          id: SEM_CATEGORIA_ID,
          name: 'Sem Categoria',
          icon: null,
          color: null,
          type: 'expense',
          source: 'default',
          children: [],
        },
      ],
      income: [
        {
          id: INCOME_SEM_CAT,
          name: 'Sem Categoria',
          icon: null,
          color: null,
          type: 'income',
          source: 'default',
          children: [],
        },
      ],
    } as unknown as CategoryTreeDto;
    const lines = [
      line({ lineId: 'l1', description: 'Mercado', amount: '50.00', suggestedCategoryId: null }),
      // Credit line: the AI (expense-only) wrongly guessed an expense cat — must be overridden.
      line({ lineId: 'l2', description: 'Estorno', amount: '-30.00', suggestedCategoryId: 'ai-expense-cat' }),
    ];
    const { service, get } = setup(extraction(lines), [
      { description: 'Mercado', categoryId: 'cat-food' },
    ], tree);

    const result = await service.extract(TOKEN, FILE, { creditCardId: 'card-1' });

    expect(result.lines[0]?.suggestedCategoryId).toBe('cat-food');
    expect(result.lines[1]?.suggestedCategoryId).toBe(INCOME_SEM_CAT);
    // History is queried only for the expense line, never the credit line.
    expect(get).toHaveBeenCalledWith(
      '/transactions/category-suggestions?descriptions=Mercado',
      { token: TOKEN },
    );
  });

  it('passes the invoice total through', async () => {
    const { service } = setup(extraction([], '173.45'), []);

    const result = await service.extract(TOKEN, FILE, { creditCardId: 'card-1' });

    expect(result.total).toBe('173.45');
  });

  it('fills suggestedCategoryId from the api history suggestions', async () => {
    const lines = [
      line({ lineId: 'l1', description: 'Mercado' }),
      line({ lineId: 'l2', description: 'Posto' }),
    ];
    const { service, get } = setup(extraction(lines), [
      { description: 'Mercado', categoryId: 'cat-food' },
      { description: 'Posto', categoryId: null },
    ]);

    const result = await service.extract(TOKEN, FILE, { creditCardId: 'card-1' });

    expect(result.lines[0]?.suggestedCategoryId).toBe('cat-food');
    expect(result.lines[1]?.suggestedCategoryId).toBeNull();
    // Deduplicates descriptions and forwards the user token.
    expect(get).toHaveBeenCalledWith(
      '/transactions/category-suggestions?descriptions=Mercado&descriptions=Posto',
      { token: TOKEN },
    );
  });

  it('deduplicates repeated descriptions before querying the api', async () => {
    const lines = [
      line({ lineId: 'l1', description: 'Mercado' }),
      line({ lineId: 'l2', description: 'Mercado' }),
    ];
    const { service, get } = setup(extraction(lines), [
      { description: 'Mercado', categoryId: 'cat-food' },
    ]);

    const result = await service.extract(TOKEN, FILE, { creditCardId: 'card-1' });

    expect(get).toHaveBeenCalledWith(
      '/transactions/category-suggestions?descriptions=Mercado',
      { token: TOKEN },
    );
    expect(result.lines[0]?.suggestedCategoryId).toBe('cat-food');
    expect(result.lines[1]?.suggestedCategoryId).toBe('cat-food');
  });

  it('url-encodes descriptions in the query', async () => {
    const lines = [line({ description: 'Loja A & B' })];
    const { service, get } = setup(extraction(lines), [
      { description: 'Loja A & B', categoryId: null },
    ]);

    await service.extract(TOKEN, FILE, { creditCardId: 'card-1' });

    expect(get).toHaveBeenCalledWith(
      '/transactions/category-suggestions?descriptions=Loja%20A%20%26%20B',
      { token: TOKEN },
    );
  });
});

describe('InvoiceImportService.commit', () => {
  const COMMIT: CommitInvoiceInput = {
    creditCardId: '11111111-1111-1111-1111-111111111111',
    referenceMonth: '2026-08',
    mode: 'merge',
    lines: [
      {
        lineId: '22222222-2222-2222-2222-222222222222',
        date: '2026-08-01T00:00:00.000Z',
        description: 'Mercado',
        amount: '123.45',
        installmentNumber: null,
        installmentCount: null,
        uncertain: false,
        suggestedCategoryId: null,
        categoryId: '33333333-3333-3333-3333-333333333333',
        discarded: false,
      },
    ],
  };

  function commitSetup() {
    const post = jest.fn().mockResolvedValue({ added: 1, skipped: 0, removed: 0 });
    const ai = {} as unknown as AiApiClient;
    const api = { post } as unknown as ApiClient;
    const service = new InvoiceImportService(ai, api);
    return { service, post };
  }

  it('proxies the commit to the api with the Bearer token and Idempotency-Key', async () => {
    const { service, post } = commitSetup();

    const result = await service.commit(TOKEN, COMMIT, 'idem-123');

    expect(post).toHaveBeenCalledWith('/transactions/invoice-import', {
      token: TOKEN,
      body: COMMIT,
      idempotencyKey: 'idem-123',
    });
    expect(result).toEqual({ added: 1, skipped: 0, removed: 0 });
  });
});
