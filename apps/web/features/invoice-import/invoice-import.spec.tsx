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

const extractInvoiceMock = vi.hoisted(() => vi.fn());
const commitInvoiceMock = vi.hoisted(() => vi.fn());

vi.mock('./invoice-import-api', () => ({
  extractInvoice: extractInvoiceMock,
  commitInvoice: commitInvoiceMock,
}));

const CARD = { id: 'card-1', name: 'Nubank', lastDigits: '1234' };
const CATEGORY = { id: 'cat-food', name: 'Alimentação', icon: 'tag', color: 'primary' };

vi.mock('../cards/use-cards', () => ({
  useCards: () => ({ data: [CARD] }),
}));

vi.mock('../categories/use-categories', () => ({
  useCategories: () => ({
    data: {
      income: [],
      expense: [{ ...CATEGORY, parentId: null, children: [] }],
    } as unknown as CategoryTreeDto,
  }),
}));

afterEach(() => {
  cleanup();
  extractInvoiceMock.mockReset();
  commitInvoiceMock.mockReset();
});

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
    extractInvoiceMock.mockResolvedValue(extraction());
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
    expect(extractInvoiceMock).toHaveBeenCalledWith({
      file,
      creditCardId: CARD.id,
      password: undefined,
    });

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

  it('lets the user choose replace before importing', async () => {
    extractInvoiceMock.mockResolvedValue(extraction());
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
