import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ForecastQuery, ForecastResponse } from '@finance/contracts';
import { periodReducer, setMonth } from '../../store/period-slice';
import { ForecastReport } from './forecast-report';
import { ForecastView } from './forecast-view';

const getForecastMock = vi.hoisted(() => vi.fn());

vi.mock('./forecast-api', () => ({
  getForecast: getForecastMock,
}));

afterEach(cleanup);

function forecast(over: Partial<ForecastResponse> = {}): ForecastResponse {
  return {
    months: ['2026-01', '2026-02'],
    rows: [
      {
        key: 'g1',
        description: 'carro',
        recurrence: 'installment',
        installmentCount: 36,
        cells: [
          { month: '2026-01', amount: '500.00' },
          { month: '2026-02', amount: '500.00' },
        ],
      },
      {
        key: 'g2',
        description: 'aluguel',
        recurrence: 'fixed',
        installmentCount: null,
        cells: [
          { month: '2026-01', amount: '1200.00' },
          { month: '2026-02', amount: null },
        ],
      },
    ],
    totals: [
      { month: '2026-01', amount: '1700.00' },
      { month: '2026-02', amount: '500.00' },
    ],
    ...over,
  };
}

describe('ForecastReport', () => {
  it('renders one row per API row with the correct label', () => {
    render(<ForecastReport forecast={forecast()} />);
    expect(screen.getByText('carro (36x)')).toBeInTheDocument();
    expect(screen.getByText('aluguel (fixa)')).toBeInTheDocument();
  });

  it('renders "-" for null cells', () => {
    render(<ForecastReport forecast={forecast()} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders a BR-formatted totals row', () => {
    render(<ForecastReport forecast={forecast()} />);
    const totalRow = screen.getByText('Total').closest('tr') as HTMLElement;
    expect(within(totalRow).getByText('R$ 1.700,00')).toBeInTheDocument();
    expect(within(totalRow).getByText('R$ 500,00')).toBeInTheDocument();
  });

  it('renders the empty-state message when rows is empty', () => {
    render(<ForecastReport forecast={forecast({ rows: [] })} />);
    expect(
      screen.getByText('Nenhum parcelamento ou despesa fixa cadastrado'),
    ).toBeInTheDocument();
  });
});

describe('ForecastView (US2 integration)', () => {
  function renderView() {
    const store = configureStore({ reducer: { period: periodReducer } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ForecastView />
        </QueryClientProvider>
      </Provider>,
    );
    return { store };
  }

  function lastQuery(): ForecastQuery {
    const calls = getForecastMock.mock.calls;
    return calls[calls.length - 1]![0] as ForecastQuery;
  }

  afterEach(() => {
    getForecastMock.mockReset();
  });

  it('re-requests with the new months value when the horizon changes, keeping from unchanged', async () => {
    getForecastMock.mockResolvedValue(forecast());
    renderView();
    await waitFor(() => expect(getForecastMock).toHaveBeenCalled());
    const initialFrom = lastQuery().from;
    expect(lastQuery().months).toBe(6);

    fireEvent.click(screen.getByRole('tab', { name: '12m' }));

    await waitFor(() => expect(lastQuery().months).toBe(12));
    expect(lastQuery().from).toBe(initialFrom);
  });

  it('re-requests with the new from value when the global period changes, keeping months unchanged', async () => {
    getForecastMock.mockResolvedValue(forecast());
    const { store } = renderView();
    await waitFor(() => expect(getForecastMock).toHaveBeenCalled());
    const initialMonths = lastQuery().months;

    store.dispatch(setMonth({ year: 2030, month: 5 }));

    await waitFor(() => expect(lastQuery().from).toBe('2030-06'));
    expect(lastQuery().months).toBe(initialMonths);
  });
});
