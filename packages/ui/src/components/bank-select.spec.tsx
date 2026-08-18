import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BankSelect } from './bank-select.js';

afterEach(cleanup);

describe('BankSelect', () => {
  it('renders bank options', () => {
    render(<BankSelect onChange={() => {}} label="Banco" />);
    expect(screen.getByLabelText('Banco')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Nubank' })).toBeInTheDocument();
  });

  it('returns the bankId on change', () => {
    const onChange = vi.fn();
    render(<BankSelect onChange={onChange} label="Banco" />);
    fireEvent.change(screen.getByLabelText('Banco'), { target: { value: 'itau' } });
    expect(onChange).toHaveBeenCalledWith('itau');
  });

  it('shows an error message', () => {
    render(<BankSelect onChange={() => {}} label="Banco" error="Obrigatório" />);
    expect(screen.getByText('Obrigatório')).toBeInTheDocument();
  });
});
