import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IconPicker } from './icon-picker.js';

afterEach(cleanup);

describe('IconPicker', () => {
  it('renders a radiogroup of icons', () => {
    render(<IconPicker onChange={() => {}} label="Ícone" />);
    expect(screen.getByRole('radiogroup', { name: 'Ícone' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'utensils' })).toBeInTheDocument();
  });

  it('returns the iconKey on select', () => {
    const onChange = vi.fn();
    render(<IconPicker onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'utensils' }));
    expect(onChange).toHaveBeenCalledWith('utensils');
  });

  it('filters icons by search query', () => {
    render(<IconPicker onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Buscar ícone'), {
      target: { value: 'pizza' },
    });
    expect(screen.getByRole('radio', { name: 'pizza' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'utensils' })).not.toBeInTheDocument();
  });

  it('marks the selected icon', () => {
    render(<IconPicker value="pizza" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'pizza' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
