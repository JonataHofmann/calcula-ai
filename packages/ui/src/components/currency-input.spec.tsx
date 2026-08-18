import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CurrencyInput } from './currency-input.js';

afterEach(cleanup);

describe('CurrencyInput', () => {
  it('displays a decimal value as pt-BR', () => {
    render(<CurrencyInput label="Valor" value="1200.00" onChange={() => {}} />);
    expect(screen.getByLabelText('Valor')).toHaveValue('1.200,00');
  });

  it('renders empty when value is empty', () => {
    render(<CurrencyInput label="Valor" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Valor')).toHaveValue('');
  });

  it('emits a dot decimal filling from the right', () => {
    const onChange = vi.fn();
    render(<CurrencyInput label="Valor" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '12345' } });
    expect(onChange).toHaveBeenCalledWith('123.45');
  });

  it('strips non-digits before parsing', () => {
    const onChange = vi.fn();
    render(<CurrencyInput label="Valor" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: 'R$ 1.200,00' } });
    expect(onChange).toHaveBeenCalledWith('1200.00');
  });

  it('emits empty when cleared', () => {
    const onChange = vi.fn();
    render(<CurrencyInput label="Valor" value="10.00" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('renders an error message', () => {
    render(<CurrencyInput label="Valor" value="" onChange={() => {}} error="Obrigatório" />);
    expect(screen.getByText('Obrigatório')).toBeInTheDocument();
  });
});
