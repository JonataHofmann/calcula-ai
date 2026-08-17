import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Input } from './input.js';

afterEach(cleanup);

describe('Input', () => {
  it('links label and input', () => {
    render(<Input label="E-mail" />);
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });

  it('shows helpText via aria-describedby', () => {
    render(<Input label="Nome" helpText="Como no documento" />);
    const input = screen.getByLabelText('Nome');
    const help = screen.getByText('Como no documento');
    expect(input).toHaveAttribute('aria-describedby', help.id);
  });

  it('shows error with aria-invalid and aria-describedby', () => {
    render(<Input label="Valor" error="Campo obrigatório" />);
    const input = screen.getByLabelText('Valor');
    const error = screen.getByText('Campo obrigatório');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
  });

  it('supports disabled', () => {
    render(<Input label="Nome" disabled />);
    expect(screen.getByLabelText('Nome')).toBeDisabled();
  });
});
