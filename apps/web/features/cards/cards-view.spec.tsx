import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreditCardDto } from '@finance/contracts';
import { CardsView } from './cards-view';

const listCardsMock = vi.hoisted(() => vi.fn());
const deleteCardMock = vi.hoisted(() => vi.fn());
const getCardTransactionCountMock = vi.hoisted(() => vi.fn());

vi.mock('./cards-api', () => ({
  listCards: listCardsMock,
  createCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: deleteCardMock,
  getCardTransactionCount: getCardTransactionCountMock,
}));

afterEach(() => {
  cleanup();
  listCardsMock.mockReset();
  deleteCardMock.mockReset();
  getCardTransactionCountMock.mockReset();
});

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CardsView />
    </QueryClientProvider>,
  );
}

function card(over: Partial<CreditCardDto> = {}): CreditCardDto {
  return {
    id: 'card-1',
    name: 'Nubank',
    lastDigits: '1234',
    dueDay: 10,
    closingDay: 3,
    limit: '5000.00',
    brandId: 'mastercard',
    ...over,
  };
}

describe('CardsView delete dialog', () => {
  it('shows the linked-transaction count and cascades when the checkbox is checked', async () => {
    listCardsMock.mockResolvedValue([card()]);
    getCardTransactionCountMock.mockResolvedValue({ count: 3 });
    deleteCardMock.mockResolvedValue(undefined);
    renderView();

    fireEvent.click(await screen.findByLabelText('Excluir Nubank'));

    const checkbox = await screen.findByRole('checkbox');
    expect(screen.getByText(/3 transações vinculadas/)).toBeInTheDocument();

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(deleteCardMock).toHaveBeenCalledWith('card-1', true),
    );
  });

  it('hides the checkbox and keeps transactions when there are none linked', async () => {
    listCardsMock.mockResolvedValue([card()]);
    getCardTransactionCountMock.mockResolvedValue({ count: 0 });
    deleteCardMock.mockResolvedValue(undefined);
    renderView();

    fireEvent.click(await screen.findByLabelText('Excluir Nubank'));

    await screen.findByText(/Esta ação não pode ser desfeita/);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(deleteCardMock).toHaveBeenCalledWith('card-1', false));
  });
});
