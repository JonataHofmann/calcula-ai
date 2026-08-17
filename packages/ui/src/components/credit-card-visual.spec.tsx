import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CreditCardVisual } from './credit-card-visual.js';

afterEach(cleanup);

describe('CreditCardVisual', () => {
  it('renders masked number, holder and expiry', () => {
    render(
      <CreditCardVisual
        brand="Visa"
        holderName="Mike Smith"
        maskedNumber="**** **** **** 1234"
        expiry="12/28"
      />,
    );
    expect(screen.getByText('**** **** **** 1234')).toBeInTheDocument();
    expect(screen.getByText('Mike Smith')).toBeInTheDocument();
    expect(screen.getByText('Visa')).toBeInTheDocument();
    expect(screen.getByText('12/28')).toBeInTheDocument();
  });

  it('uses primary tone tokens when requested', () => {
    const { container } = render(
      <CreditCardVisual holderName="Ana" maskedNumber="**** 0001" tone="primary" />,
    );
    expect(container.firstElementChild?.className).toContain('bg-primary');
  });

  it('defaults to dark tone', () => {
    const { container } = render(<CreditCardVisual holderName="Ana" maskedNumber="**** 0001" />);
    expect(container.firstElementChild?.className).toContain('bg-surface-strong');
  });
});
