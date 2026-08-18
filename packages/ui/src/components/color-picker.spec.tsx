import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColorPicker } from './color-picker.js';

afterEach(cleanup);

describe('ColorPicker', () => {
  it('renders a radiogroup of colors', () => {
    render(<ColorPicker onChange={() => {}} label="Cor" />);
    expect(screen.getByRole('radiogroup', { name: 'Cor' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Vermelho' })).toBeInTheDocument();
  });

  it('returns the colorToken on select', () => {
    const onChange = vi.fn();
    render(<ColorPicker onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Verde' }));
    expect(onChange).toHaveBeenCalledWith('success');
  });

  it('marks the selected color', () => {
    render(<ColorPicker value="danger" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Vermelho' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
