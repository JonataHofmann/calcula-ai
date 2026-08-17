import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchField } from './search-field.js';

afterEach(cleanup);

describe('SearchField', () => {
  it('renders a search input', () => {
    render(<SearchField placeholder="Buscar" />);
    expect(screen.getByPlaceholderText('Buscar')).toHaveAttribute('type', 'search');
  });

  it('calls onSearch on Enter', () => {
    const onSearch = vi.fn();
    render(<SearchField placeholder="Buscar" onSearch={onSearch} />);
    const input = screen.getByPlaceholderText('Buscar');
    fireEvent.change(input, { target: { value: 'mercado' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith('mercado');
  });

  it('does not call onSearch on other keys', () => {
    const onSearch = vi.fn();
    render(<SearchField placeholder="Buscar" onSearch={onSearch} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Buscar'), { key: 'a' });
    expect(onSearch).not.toHaveBeenCalled();
  });
});
