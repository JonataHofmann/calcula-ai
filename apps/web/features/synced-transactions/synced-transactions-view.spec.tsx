import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SyncedTransactionDto } from '@finance/contracts';
import { SyncedTransactionsView } from './synced-transactions-view';

const listSyncedTransactionsMock = vi.hoisted(() => vi.fn());

vi.mock('./synced-transactions-api', () => ({
  listSyncedTransactions: listSyncedTransactionsMock,
}));

afterEach(() => {
  cleanup();
  listSyncedTransactionsMock.mockReset();
});

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SyncedTransactionsView />
    </QueryClientProvider>,
  );
}

function tx(over: Partial<SyncedTransactionDto> = {}): SyncedTransactionDto {
  return {
    id: 'synced-1',
    pluggyTransactionId: 'tx-1',
    linkedAccountId: 'acc-1',
    linkedCreditCardId: null,
    description: 'Compra teste',
    amount: '50.00',
    date: '2026-08-01T00:00:00.000Z',
    direction: 'debit',
    pluggyStatus: 'posted',
    installmentNumber: null,
    installmentTotal: null,
    syncStatus: 'success',
    transactionsMsId: 'tx-ms-1',
    retryCount: 0,
    lastError: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

describe('SyncedTransactionsView', () => {
  it('renders the transaction id, description and success status', async () => {
    listSyncedTransactionsMock.mockResolvedValue([tx()]);
    renderView();

    expect(await screen.findByText('synced-1')).toBeInTheDocument();
    expect(screen.getByText('Compra teste')).toBeInTheDocument();
    expect(screen.getByText('Sucesso', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('tx-ms-1')).toBeInTheDocument();
  });

  it('shows the last error and retry count for errored imports', async () => {
    listSyncedTransactionsMock.mockResolvedValue([
      tx({ id: 'synced-err', syncStatus: 'error', transactionsMsId: null, lastError: 'boom', retryCount: 3 }),
    ]);
    renderView();

    expect(await screen.findByText('Erro', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('boom (tentativas: 3)')).toBeInTheDocument();
  });

  it('renders the empty state when there are no imported transactions', async () => {
    listSyncedTransactionsMock.mockResolvedValue([]);
    renderView();

    expect(await screen.findByText('Nenhuma transação importada.')).toBeInTheDocument();
  });

  it('refetches with the selected status when the filter changes', async () => {
    listSyncedTransactionsMock.mockResolvedValue([]);
    renderView();

    await waitFor(() => expect(listSyncedTransactionsMock).toHaveBeenCalledWith(undefined));

    fireEvent.change(screen.getByLabelText('Filtrar por status'), { target: { value: 'error' } });

    await waitFor(() => expect(listSyncedTransactionsMock).toHaveBeenCalledWith('error'));
  });
});
