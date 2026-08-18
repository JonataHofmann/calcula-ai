import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntitySelect, type EntityOption } from './entity-select.js';

afterEach(cleanup);

const OPTIONS: EntityOption[] = [
  { value: 'a', label: 'Alimentação', icon: 'utensils', color: 'success' },
  { value: 'b', label: 'Transporte', icon: 'car', color: 'info' },
  { value: 'c', label: 'Cartão Nubank', colorHex: '#820ad1', hint: '•••• 1234' },
];

describe('EntitySelect', () => {
  it('shows the placeholder when nothing is selected', () => {
    render(<EntitySelect label="Categoria" value="" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveTextContent('Selecione');
  });

  it('shows the selected option label', () => {
    render(<EntitySelect label="Categoria" value="a" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveTextContent('Alimentação');
  });

  it('opens the listbox and emits the picked value', () => {
    const onChange = vi.fn();
    render(<EntitySelect label="Categoria" value="" onChange={onChange} options={OPTIONS} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    fireEvent.click(screen.getByRole('option', { name: 'Transporte' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('closes after picking an option', () => {
    render(<EntitySelect label="Categoria" value="" onChange={() => {}} options={OPTIONS} />);
    const trigger = screen.getByRole('combobox', { name: 'Categoria' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Cartão Nubank' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks the selected option', () => {
    render(<EntitySelect label="Categoria" value="a" onChange={() => {}} options={OPTIONS} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    expect(screen.getByRole('option', { name: 'Alimentação' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
