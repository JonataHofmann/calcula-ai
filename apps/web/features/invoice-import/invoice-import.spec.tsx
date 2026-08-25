import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CategoryTreeDto,
  CommitInvoiceInput,
  InvoiceExtractionResult,
} from '@finance/contracts';
import { InvoiceImportView } from './invoice-import-view';

const extractInvoiceStreamMock = vi.hoisted(() => vi.fn());
const commitInvoiceMock = vi.hoisted(() => vi.fn());

vi.mock('./invoice-import-api', () => ({
  extractInvoiceStream: extractInvoiceStreamMock,
  commitInvoice: commitInvoiceMock,
}));

const CARD = { id: 'card-1', name: 'Nubank', lastDigits: '1234' };
const CATEGORY = { id: 'cat-food', name: 'Alimentação', icon: 'tag', color: 'primary' };
const INCOME_CATEGORY = { id: 'cat-refund', name: 'Reembolsos', icon: 'tag', color: 'success' };

vi.mock('../cards/use-cards', () => ({
  useCards: () => ({ data: [CARD] }),
}));

vi.mock('../categories/use-categories', () => ({
  useCategories: () => ({
    data: {
      income: [{ ...INCOME_CATEGORY, parentId: null, children: [] }],
      expense: [{ ...CATEGORY, parentId: null, children: [] }],
    } as unknown as CategoryTreeDto,
  }),
}));

afterEach(() => {
  cleanup();
  extractInvoiceStreamMock.mockReset();
  commitInvoiceMock.mockReset();
});

/** Mocka o stream: emite os eventos de passo e resolve com o resultado, como o BFF faz. */
function mockStream(result: InvoiceExtractionResult) {
  extractInvoiceStreamMock.mockImplementation(
    async (
      _input: unknown,
      onEvent: (event: { step: string; status: string; message: string }) => void,
    ) => {
      onEvent({ step: 'uploading', status: 'done', message: 'Arquivo recebido' });
      onEvent({ step: 'processing', status: 'done', message: 'Processando' });
      return result;
    },
  );
}

function extraction(): InvoiceExtractionResult {
  return {
    referenceMonth: '2026-08',
    dueDate: null,
    total: '173.45',
    lines: [
      {
        lineId: '11111111-1111-1111-1111-111111111111',
        date: '2026-08-03T00:00:00.000Z',
        description: 'Mercado',
        amount: '50.00',
        installmentNumber: null,
        installmentCount: null,
        uncertain: false,
        suggestedCategoryId: CATEGORY.id,
      },
    ],
  };
}

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <InvoiceImportView />
    </QueryClientProvider>,
  );
}

describe('InvoiceImportView flow', () => {
  it('walks upload -> review -> commit and shows the summary', async () => {
    mockStream(extraction());
    commitInvoiceMock.mockResolvedValue({ added: 1, skipped: 0, removed: 0 });

    renderView();

    // Open upload modal.
    fireEvent.click(screen.getByRole('button', { name: /Enviar PDF/i }));

    // Pick the card and attach a PDF.
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: CARD.id },
    });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'fatura.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(
      screen.getByRole('button', { name: /Extrair transações/i }),
    );

    // Review modal shows the extracted line in an editable description field.
    const descInput = await screen.findByDisplayValue('Mercado');
    expect(descInput).toBeInTheDocument();
    expect(extractInvoiceStreamMock).toHaveBeenCalledWith(
      { file, creditCardId: CARD.id, password: undefined },
      expect.any(Function),
    );

    // Rename the line — the raw text must ride along as originalDescription.
    fireEvent.change(descInput, { target: { value: 'iFood' } });

    // Confirm the review (category is pre-filled from the suggestion).
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    // Commit decision modal -> import with the default (merge) mode.
    fireEvent.click(await screen.findByRole('button', { name: /^Importar$/i }));

    // Summary appears and the commit payload is correct.
    expect(await screen.findByText(/Importação concluída/i)).toBeInTheDocument();
    expect(
      screen.getByText(/1 adicionada\(s\).*0 ignorada\(s\).*0 removida\(s\)/i),
    ).toBeInTheDocument();

    await waitFor(() => expect(commitInvoiceMock).toHaveBeenCalledTimes(1));
    const payload = commitInvoiceMock.mock.calls[0]![0] as CommitInvoiceInput;
    expect(payload.creditCardId).toBe(CARD.id);
    expect(payload.referenceMonth).toBe('2026-08');
    expect(payload.mode).toBe('merge');
    expect(payload.lines).toHaveLength(1);
    expect(payload.lines[0]?.categoryId).toBe(CATEGORY.id);
    expect(payload.lines[0]?.discarded).toBe(false);
    expect(payload.lines[0]?.description).toBe('iFood');
    expect(payload.lines[0]?.originalDescription).toBe('Mercado');
  });

  it('labels a negative line as Receita and commits it with the income category', async () => {
    mockStream({
      referenceMonth: '2026-08',
      dueDate: null,
      total: null,
      lines: [
        {
          lineId: '22222222-2222-2222-2222-222222222222',
          date: '2026-08-05T00:00:00.000Z',
          description: 'Estorno compra',
          amount: '-30.00',
          installmentNumber: null,
          installmentCount: null,
          uncertain: false,
          // BFF routes credit lines to an income category.
          suggestedCategoryId: INCOME_CATEGORY.id,
        },
      ],
    } satisfies InvoiceExtractionResult);
    commitInvoiceMock.mockResolvedValue({ added: 1, skipped: 0, removed: 0 });

    renderView();

    fireEvent.click(screen.getByRole('button', { name: /Enviar PDF/i }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: CARD.id } });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['%PDF-1.4'], 'fatura.pdf', { type: 'application/pdf' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Extrair transações/i }));

    // The credit line is flagged as a receita in review.
    await screen.findByDisplayValue('Estorno compra');
    expect(screen.getByText('Receita')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^Importar$/i }));

    await waitFor(() => expect(commitInvoiceMock).toHaveBeenCalledTimes(1));
    const payload = commitInvoiceMock.mock.calls[0]![0] as CommitInvoiceInput;
    expect(payload.lines[0]?.amount).toBe('-30.00');
    expect(payload.lines[0]?.categoryId).toBe(INCOME_CATEGORY.id);
  });

  it('lets the user choose replace before importing', async () => {
    mockStream(extraction());
    commitInvoiceMock.mockResolvedValue({ added: 1, skipped: 0, removed: 3 });

    renderView();

    fireEvent.click(screen.getByRole('button', { name: /Enviar PDF/i }));
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: CARD.id },
    });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['%PDF-1.4'], 'fatura.pdf', { type: 'application/pdf' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Extrair transações/i }));

    await screen.findByDisplayValue('Mercado');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    // Choose "Substituir" then import.
    fireEvent.click(await screen.findByRole('button', { name: /Substituir/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Importar$/i }));

    await waitFor(() => expect(commitInvoiceMock).toHaveBeenCalledTimes(1));
    const payload = commitInvoiceMock.mock.calls[0]![0] as CommitInvoiceInput;
    expect(payload.mode).toBe('replace');
    expect(
      await screen.findByText(/1 adicionada\(s\).*0 ignorada\(s\).*3 removida\(s\)/i),
    ).toBeInTheDocument();
  });
});
