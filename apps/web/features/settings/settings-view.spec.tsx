import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsView } from './settings-view';

const resetDataMock = vi.hoisted(() => vi.fn());

vi.mock('./settings-api', () => ({ resetData: resetDataMock }));

afterEach(() => {
  cleanup();
  resetDataMock.mockReset();
});

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SettingsView />
    </QueryClientProvider>,
  );
}

describe('SettingsView reset flow', () => {
  it('gates the wipe behind typing RESETAR and shows the summary', async () => {
    resetDataMock.mockResolvedValue({
      transactions: 5,
      accounts: 2,
      creditCards: 1,
      categories: 3,
      categoryOverrides: 0,
      hiddenCategories: 0,
    });

    renderView();

    // Open the confirm modal.
    fireEvent.click(screen.getByRole('button', { name: /Resetar dados/i }));

    // "Apagar tudo" stays disabled until the confirm word is typed.
    const confirmBtn = screen.getByRole('button', { name: /Apagar tudo/i });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Confirmação'), {
      target: { value: 'nope' },
    });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Confirmação'), {
      target: { value: 'resetar' },
    });
    expect(confirmBtn).toBeEnabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => expect(resetDataMock).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/5 transação\(ões\)/i),
    ).toBeInTheDocument();
  });

  it('does not call the api when the word is wrong', async () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: /Resetar dados/i }));
    fireEvent.change(screen.getByLabelText('Confirmação'), {
      target: { value: 'RESETA' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Apagar tudo/i }));

    expect(resetDataMock).not.toHaveBeenCalled();
  });
});
