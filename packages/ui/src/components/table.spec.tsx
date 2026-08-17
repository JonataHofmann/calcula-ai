import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from './table.js';

afterEach(cleanup);

describe('Table', () => {
  it('renders semantic table with rows', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Mercado</TableCell>
            <TableCell>R$ 75,67</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Descrição' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Mercado' })).toBeInTheDocument();
  });

  it('renders empty state with default message', () => {
    render(
      <Table>
        <TableBody>
          <TableEmpty colSpan={2} />
        </TableBody>
      </Table>,
    );
    const cell = screen.getByRole('cell', { name: 'Nenhum registro encontrado' });
    expect(cell).toHaveAttribute('colspan', '2');
  });

  it('renders empty state with custom message', () => {
    render(
      <Table>
        <TableBody>
          <TableEmpty colSpan={3} message="Sem transações" />
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('cell', { name: 'Sem transações' })).toBeInTheDocument();
  });
});
