import type {
  AIGenerateInput,
  AIGenerateOutput,
  AIProvider,
  AIStreamChunk,
} from '../../common/ai-provider';
import {
  InvoiceExtractionError,
  InvoiceImportService,
} from './invoice-import.service';

jest.mock('./pdf-reader', () => ({
  readPdfText: jest.fn().mockResolvedValue('FATURA texto bruto'),
}));

const VALID_JSON = JSON.stringify({
  referenceMonth: '2026-08',
  dueDate: '2026-08-10T00:00:00.000Z',
  lines: [
    {
      date: '2026-07-15T00:00:00.000Z',
      description: 'Mercado',
      amount: '123.45',
      installmentNumber: null,
      installmentCount: null,
      uncertain: false,
    },
    {
      date: '2026-07-16T00:00:00.000Z',
      description: 'Loja PARC 02/10',
      amount: '50.00',
      installmentNumber: 2,
      installmentCount: 10,
      uncertain: false,
    },
  ],
});

/** AIProvider stub that returns queued contents in order. */
class FakeAIProvider implements AIProvider {
  public calls = 0;
  constructor(private readonly contents: string[]) {}
  async generate(_input: AIGenerateInput): Promise<AIGenerateOutput> {
    const content = this.contents[this.calls] ?? this.contents.at(-1) ?? '';
    this.calls += 1;
    return { content, model: 'fake', promptTokens: 1, completionTokens: 1 };
  }
  // eslint-disable-next-line require-yield
  async *stream(_input: AIGenerateInput): AsyncIterable<AIStreamChunk> {
    throw new Error('not implemented');
  }
}

const BUFFER = Buffer.from('%PDF-1.4 fake');

describe('InvoiceImportService', () => {
  it('maps a valid extraction, assigning lineId and null suggestedCategoryId', async () => {
    const ai = new FakeAIProvider([VALID_JSON]);
    const service = new InvoiceImportService(ai);

    const result = await service.extract(BUFFER, 'secret');

    expect(ai.calls).toBe(1);
    expect(result.referenceMonth).toBe('2026-08');
    expect(result.lines).toHaveLength(2);
    for (const line of result.lines) {
      expect(line.lineId).toMatch(/^[0-9a-f-]{36}$/);
      expect(line.suggestedCategoryId).toBeNull();
    }
    expect(result.lines[1].installmentNumber).toBe(2);
    expect(result.lines[1].installmentCount).toBe(10);
  });

  it('retries once when the first output is invalid JSON', async () => {
    const ai = new FakeAIProvider(['not json at all', VALID_JSON]);
    const service = new InvoiceImportService(ai);

    const result = await service.extract(BUFFER, undefined);

    expect(ai.calls).toBe(2);
    expect(result.lines).toHaveLength(2);
  });

  it('throws InvoiceExtractionError when output is invalid twice', async () => {
    const ai = new FakeAIProvider(['garbage', 'still garbage']);
    const service = new InvoiceImportService(ai);

    await expect(service.extract(BUFFER, undefined)).rejects.toBeInstanceOf(
      InvoiceExtractionError,
    );
    expect(ai.calls).toBe(2);
  });

  it('keeps a suggested categoryId only when it is in the allowed set, and passes total through', async () => {
    const catId = '11111111-1111-1111-1111-111111111111';
    const withCategories = JSON.stringify({
      referenceMonth: '2026-08',
      dueDate: null,
      total: '173.45',
      lines: [
        {
          date: '2026-07-15T00:00:00.000Z',
          description: 'Mercado',
          amount: '123.45',
          installmentNumber: null,
          installmentCount: null,
          uncertain: false,
          categoryId: catId,
        },
        {
          date: '2026-07-16T00:00:00.000Z',
          description: 'Loja',
          amount: '50.00',
          installmentNumber: null,
          installmentCount: null,
          uncertain: false,
          categoryId: 'not-in-list',
        },
      ],
    });
    const ai = new FakeAIProvider([withCategories]);
    const service = new InvoiceImportService(ai);

    const result = await service.extract(BUFFER, undefined, [
      { id: catId, name: 'Alimentação > Mercado' },
    ]);

    expect(result.total).toBe('173.45');
    expect(result.lines[0].suggestedCategoryId).toBe(catId);
    expect(result.lines[1].suggestedCategoryId).toBeNull();
  });
});
