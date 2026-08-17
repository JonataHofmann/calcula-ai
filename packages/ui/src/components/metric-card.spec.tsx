import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MetricCard } from './metric-card.js';

afterEach(cleanup);

describe('MetricCard', () => {
  it('formats value as BRL', () => {
    render(<MetricCard title="Saldo" value="24098.00" />);
    expect(screen.getByText('R$ 24.098,00')).toBeInTheDocument();
  });

  it('formats millions without overflow of precision', () => {
    render(<MetricCard title="Total" value="1234567.89" />);
    expect(screen.getByText('R$ 1.234.567,89')).toBeInTheDocument();
  });

  it('shows positive delta with success color and plus sign', () => {
    render(<MetricCard title="Receita" value="100.00" delta="12.5" deltaLabel="vs. mês anterior" />);
    const delta = screen.getByText('+12,5%');
    expect(delta.closest('span')?.className).toContain('text-success');
    expect(screen.getByText('vs. mês anterior')).toBeInTheDocument();
  });

  it('shows negative delta with danger color', () => {
    render(<MetricCard title="Despesa" value="100.00" delta="-3.2" />);
    const delta = screen.getByText('-3,2%');
    expect(delta.closest('span')?.className).toContain('text-danger');
  });

  it('renders strong tone with strong surface tokens', () => {
    const { container } = render(<MetricCard title="Saldo" value="1.00" tone="strong" />);
    expect(container.firstElementChild?.className).toContain('bg-surface-strong');
  });
});
