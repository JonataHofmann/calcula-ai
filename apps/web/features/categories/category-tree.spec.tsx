import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CategoryNodeDto } from '@finance/contracts';
import { CategoryTree } from './category-tree';

afterEach(cleanup);

function node(partial: Partial<CategoryNodeDto> & Pick<CategoryNodeDto, 'id' | 'name'>): CategoryNodeDto {
  return {
    icon: 'utensils',
    color: 'primary',
    type: 'expense',
    source: 'default',
    children: [],
    ...partial,
  } as CategoryNodeDto;
}

function callbacks() {
  return { onAddSub: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onRevert: vi.fn() };
}

describe('CategoryTree', () => {
  it('renders parent and nested child names recursively', () => {
    const nodes = [
      node({ id: 'p', name: 'Alimentação', children: [node({ id: 'c', name: 'Mercado' })] }),
    ];
    render(<CategoryTree nodes={nodes} {...callbacks()} />);

    expect(screen.getByText('Alimentação')).toBeInTheDocument();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
  });

  it('shows the Personalizado badge for custom nodes and Editado for overridden', () => {
    const nodes = [
      node({ id: 'a', name: 'Pets', source: 'custom' }),
      node({ id: 'b', name: 'Comida', source: 'default-overridden' }),
    ];
    render(<CategoryTree nodes={nodes} {...callbacks()} />);

    expect(screen.getByText('Personalizado')).toBeInTheDocument();
    expect(screen.getByText('Editado')).toBeInTheDocument();
  });

  it('fires add-subcategory, edit and delete callbacks with the node', () => {
    const cb = callbacks();
    const n = node({ id: 'a', name: 'Pets', source: 'custom' });
    render(<CategoryTree nodes={[n]} {...cb} />);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar subcategoria em Pets' }));
    expect(cb.onAddSub).toHaveBeenCalledWith(n);

    fireEvent.click(screen.getByRole('button', { name: 'Editar Pets' }));
    expect(cb.onEdit).toHaveBeenCalledWith(n);

    fireEvent.click(screen.getByRole('button', { name: 'Excluir Pets' }));
    expect(cb.onDelete).toHaveBeenCalledWith(n);
  });

  it('labels the delete action "Ocultar" for default categories', () => {
    render(<CategoryTree nodes={[node({ id: 'd', name: 'Alimentação' })]} {...callbacks()} />);
    expect(screen.getByRole('button', { name: 'Ocultar Alimentação' })).toBeInTheDocument();
  });

  it('offers revert only for overridden defaults', () => {
    const cb = callbacks();
    const overridden = node({ id: 'o', name: 'Comida', source: 'default-overridden' });
    const { rerender } = render(<CategoryTree nodes={[overridden]} {...cb} />);

    const revert = screen.getByRole('button', { name: 'Reverter edição de Comida' });
    fireEvent.click(revert);
    expect(cb.onRevert).toHaveBeenCalledWith(overridden);

    rerender(<CategoryTree nodes={[node({ id: 'p', name: 'Plain' })]} {...cb} />);
    expect(screen.queryByRole('button', { name: 'Reverter edição de Plain' })).toBeNull();
  });
});
