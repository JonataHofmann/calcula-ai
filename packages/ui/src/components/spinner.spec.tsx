import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Spinner } from './spinner.js';

afterEach(cleanup);

describe('Spinner', () => {
  it('has role status with default sr-only label', () => {
    render(<Spinner />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Carregando…');
  });

  it('accepts custom label', () => {
    render(<Spinner label="Enviando" />);
    expect(screen.getByRole('status')).toHaveTextContent('Enviando');
  });
});
