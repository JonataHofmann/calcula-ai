import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Select } from './select.js';

afterEach(cleanup);

const options = [
  { value: 'a', label: 'Conta A' },
  { value: 'b', label: 'Conta B', disabled: true },
];

describe('Select', () => {
  it('renders options and placeholder', () => {
    render(<Select label="Conta" options={options} placeholder="Selecione" />);
    const select = screen.getByLabelText('Conta');
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Selecione' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Conta A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Conta B' })).toBeDisabled();
  });

  it('shows error state', () => {
    render(<Select label="Conta" options={options} error="Obrigatório" />);
    const select = screen.getByLabelText('Conta');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Obrigatório')).toBeInTheDocument();
  });

  it('supports disabled', () => {
    render(<Select label="Conta" options={options} disabled />);
    expect(screen.getByLabelText('Conta')).toBeDisabled();
  });
});
