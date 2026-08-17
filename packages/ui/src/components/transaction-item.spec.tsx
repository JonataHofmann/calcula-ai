import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TransactionItem, TransactionList } from './transaction-item.js';

afterEach(cleanup);

describe('TransactionItem', () => {
  it('renders negative amount in danger with minus prefix', () => {
    render(
      <ul>
        <TransactionItem description="Mercado" date="13 dez 2020" amount="-75.67" />
      </ul>,
    );
    const amount = screen.getByText('-R$ 75,67');
    expect(amount.className).toContain('text-danger');
  });

  it('renders positive amount in success with plus prefix', () => {
    render(
      <ul>
        <TransactionItem description="Salário" date="01 dez 2020" amount="3500.00" />
      </ul>,
    );
    const amount = screen.getByText('+R$ 3.500,00');
    expect(amount.className).toContain('text-success');
  });

  it('truncates long descriptions with ellipsis class', () => {
    render(
      <ul>
        <TransactionItem
          description="Uma descrição extremamente longa que precisa truncar"
          date="hoje"
          amount="1.00"
        />
      </ul>,
    );
    expect(
      screen.getByText('Uma descrição extremamente longa que precisa truncar').className,
    ).toContain('truncate');
  });
});

describe('TransactionList', () => {
  it('renders items', () => {
    render(
      <TransactionList
        items={[
          { description: 'A', date: 'hoje', amount: '1.00' },
          { description: 'B', date: 'ontem', amount: '-2.00' },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders default empty state', () => {
    render(<TransactionList items={[]} />);
    expect(screen.getByText('Nenhuma transação')).toBeInTheDocument();
  });

  it('renders custom empty message', () => {
    render(<TransactionList items={[]} emptyMessage="Nada por aqui" />);
    expect(screen.getByText('Nada por aqui')).toBeInTheDocument();
  });
});
