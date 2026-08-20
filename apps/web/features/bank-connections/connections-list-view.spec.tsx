import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BankConnectionDto } from '@finance/contracts';
import { ConnectionsListView } from './connections-list-view';

const disconnectBankConnectionMock = vi.hoisted(() => vi.fn());
const refreshBankConnectionMock = vi.hoisted(() => vi.fn());
const createConnectTokenMock = vi.hoisted(() => vi.fn());
const openPluggyConnectMock = vi.hoisted(() => vi.fn());

vi.mock('./bank-connections-api', () => ({
  disconnectBankConnection: disconnectBankConnectionMock,
  refreshBankConnection: refreshBankConnectionMock,
  createConnectToken: createConnectTokenMock,
}));

vi.mock('./pluggy-connect-widget', () => ({
  openPluggyConnect: openPluggyConnectMock,
}));

afterEach(() => {
  cleanup();
  disconnectBankConnectionMock.mockReset();
  refreshBankConnectionMock.mockReset();
  createConnectTokenMock.mockReset();
  openPluggyConnectMock.mockReset();
});

function renderList(connections: BankConnectionDto[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ConnectionsListView connections={connections} />
    </QueryClientProvider>,
  );
}

function connection(over: Partial<BankConnectionDto> = {}): BankConnectionDto {
  return {
    id: 'conn-1',
    institutionName: 'Banco Exemplo',
    status: 'active',
    lastSyncedAt: '2026-08-19T10:00:00.000Z',
    createdAt: '2026-08-01T10:00:00.000Z',
    accounts: [
      { id: 'acc-1', displayName: 'Conta Corrente', type: 'CHECKING_ACCOUNT', balance: '1500.00', currency: 'BRL' },
    ],
    creditCards: [
      { id: 'card-1', brand: 'Visa', lastDigits: '1234', currentBalance: '250.00', creditLimit: '5000.00' },
    ],
    ...over,
  };
}

describe('ConnectionsListView', () => {
  it('renders the empty-state message when there are no connections', () => {
    renderList([]);
    expect(screen.getByText('Nenhum banco conectado ainda.')).toBeInTheDocument();
  });

  it('renders institution name, status label, accounts and credit cards', () => {
    renderList([connection()]);
    expect(screen.getByText('Banco Exemplo')).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
    expect(screen.getByText('Conta Corrente')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument();
    expect(screen.getByText('Visa •••• 1234')).toBeInTheDocument();
    expect(screen.getByText('R$ 250,00')).toBeInTheDocument();
  });

  it('maps needs_attention and disconnected statuses to their labels', () => {
    renderList([
      connection({ id: 'conn-2', status: 'needs_attention' }),
      connection({ id: 'conn-3', status: 'disconnected' }),
    ]);
    expect(screen.getByText('Requer atenção')).toBeInTheDocument();
    expect(screen.getByText('Desconectada')).toBeInTheDocument();
  });

  it('shows a "Desconectar" button for active connections but not disconnected ones', () => {
    renderList([
      connection({ id: 'conn-active', status: 'active' }),
      connection({ id: 'conn-disconnected', status: 'disconnected' }),
    ]);
    expect(screen.getAllByRole('button', { name: 'Desconectar' })).toHaveLength(1);
  });

  it('calls disconnectBankConnection with the connection id when clicked', async () => {
    disconnectBankConnectionMock.mockResolvedValue(undefined);
    renderList([connection()]);

    fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }));

    await waitFor(() => expect(disconnectBankConnectionMock).toHaveBeenCalledWith('conn-1'));
  });

  it('shows an "Atualizar agora" button only for active connections', () => {
    renderList([
      connection({ id: 'conn-active', status: 'active' }),
      connection({ id: 'conn-attention', status: 'needs_attention' }),
      connection({ id: 'conn-disconnected', status: 'disconnected' }),
    ]);
    expect(screen.getAllByRole('button', { name: /Atualizar agora/ })).toHaveLength(1);
  });

  it('calls refreshBankConnection with the connection id when clicked', async () => {
    refreshBankConnectionMock.mockResolvedValue({ status: 'active' });
    renderList([connection()]);

    fireEvent.click(screen.getByRole('button', { name: /Atualizar agora/ }));

    await waitFor(() => expect(refreshBankConnectionMock).toHaveBeenCalledWith('conn-1'));
  });

  it('shows a syncing message when a connection has no accounts or cards yet', () => {
    renderList([connection({ accounts: [], creditCards: [] })]);
    expect(screen.getByText('Sincronizando dados...')).toBeInTheDocument();
  });

  it('shows a "Reautenticar" button only for connections that need attention', () => {
    renderList([
      connection({ id: 'conn-active', status: 'active' }),
      connection({ id: 'conn-attention', status: 'needs_attention' }),
      connection({ id: 'conn-disconnected', status: 'disconnected' }),
    ]);
    expect(screen.getAllByRole('button', { name: 'Reautenticar' })).toHaveLength(1);
  });

  it('creates a reauth connect token and opens the widget when "Reautenticar" is clicked', async () => {
    createConnectTokenMock.mockResolvedValue({ connectToken: 'connect-token-1', expiresAt: '2026-08-19T12:00:00.000Z' });
    openPluggyConnectMock.mockResolvedValue(undefined);
    renderList([connection({ id: 'conn-2', status: 'needs_attention' })]);

    fireEvent.click(screen.getByRole('button', { name: 'Reautenticar' }));

    await waitFor(() =>
      expect(createConnectTokenMock).toHaveBeenCalledWith({ mode: 'reauth', bankConnectionId: 'conn-2' }),
    );
    await waitFor(() =>
      expect(openPluggyConnectMock).toHaveBeenCalledWith(
        'connect-token-1',
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      ),
    );
  });

  it('shows an error message when creating the reauth connect token fails', async () => {
    createConnectTokenMock.mockRejectedValue(new Error('network error'));
    renderList([connection({ id: 'conn-2', status: 'needs_attention' })]);

    fireEvent.click(screen.getByRole('button', { name: 'Reautenticar' }));

    await waitFor(() =>
      expect(screen.getByText('Não foi possível iniciar a reautenticação.')).toBeInTheDocument(),
    );
  });

  it('shows an error message when the widget reports an error during reauth', async () => {
    createConnectTokenMock.mockResolvedValue({ connectToken: 'connect-token-1', expiresAt: '2026-08-19T12:00:00.000Z' });
    openPluggyConnectMock.mockImplementation(async (_token, handlers) => {
      handlers.onError(new Error('widget error'));
    });
    renderList([connection({ id: 'conn-2', status: 'needs_attention' })]);

    fireEvent.click(screen.getByRole('button', { name: 'Reautenticar' }));

    await waitFor(() =>
      expect(screen.getByText('A reautenticação falhou. Tente novamente.')).toBeInTheDocument(),
    );
  });
});
