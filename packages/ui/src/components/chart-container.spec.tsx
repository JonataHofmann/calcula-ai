import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChartContainer } from './chart-container.js';

afterEach(cleanup);

describe('ChartContainer', () => {
  it('renders title, legend, actions and children', () => {
    render(
      <ChartContainer
        title="Estatísticas"
        legend={[
          { label: 'Receita', colorToken: 'success' },
          { label: 'Despesa', colorToken: 'danger' },
        ]}
        actions={<button type="button">Período</button>}
      >
        <div data-testid="chart" />
      </ChartContainer>,
    );
    expect(screen.getByRole('heading', { name: 'Estatísticas' })).toBeInTheDocument();
    expect(screen.getByText('Receita')).toBeInTheDocument();
    expect(screen.getByText('Despesa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Período' })).toBeInTheDocument();
    expect(screen.getByTestId('chart')).toBeInTheDocument();
  });

  it('omits legend when not provided', () => {
    render(
      <ChartContainer title="Simples">
        <div />
      </ChartContainer>,
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
