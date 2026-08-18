import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatePicker } from './date-picker.js';

afterEach(cleanup);

describe('DatePicker', () => {
  it('shows the selected date on the trigger', () => {
    render(<DatePicker label="Vencimento" value="2026-01-15" onChange={() => {}} />);
    const trigger = screen.getByLabelText('Vencimento');
    expect(trigger).toHaveTextContent('15/01/2026');
    expect(trigger).toHaveAttribute('data-value', '2026-01-15');
  });

  it('shows the placeholder when empty', () => {
    render(<DatePicker label="Vencimento" value="" onChange={() => {}} placeholder="Escolha" />);
    expect(screen.getByLabelText('Vencimento')).toHaveTextContent('Escolha');
  });

  it('opens the calendar and emits the picked day', () => {
    const onChange = vi.fn();
    render(<DatePicker label="Vencimento" value="2026-01-15" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Vencimento'));
    fireEvent.click(screen.getByLabelText('2026-01-20'));
    expect(onChange).toHaveBeenCalledWith('2026-01-20');
  });

  it('closes after selecting a day', () => {
    render(<DatePicker label="Vencimento" value="2026-01-15" onChange={() => {}} />);
    const trigger = screen.getByLabelText('Vencimento');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByLabelText('2026-01-20'));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('disables days before min', () => {
    render(
      <DatePicker label="Vencimento" value="2026-01-15" onChange={() => {}} min="2026-01-10" />,
    );
    fireEvent.click(screen.getByLabelText('Vencimento'));
    expect(screen.getByLabelText('2026-01-05')).toBeDisabled();
    expect(screen.getByLabelText('2026-01-20')).not.toBeDisabled();
  });
});
