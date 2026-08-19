import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForecastHorizonFilter } from './forecast-horizon-filter';

afterEach(cleanup);

describe('ForecastHorizonFilter', () => {
  it('renders exactly the options 1/3/6/12/24/36', () => {
    render(<ForecastHorizonFilter value={6} onValueChange={vi.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['1m', '3m', '6m', '12m', '24m', '36m']);
  });

  it('calls the change handler with the selected numeric value', () => {
    const onValueChange = vi.fn();
    render(<ForecastHorizonFilter value={6} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('tab', { name: '12m' }));
    expect(onValueChange).toHaveBeenCalledWith(12);
  });

  it('reflects the currently selected value in the UI', () => {
    render(<ForecastHorizonFilter value={24} onValueChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: '24m' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '6m' })).toHaveAttribute('aria-selected', 'false');
  });
});
