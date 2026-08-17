import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './button.js';

const RAW_PALETTE = /(#[0-9a-fA-F]{3,8}|-(blue|gray|red|green|yellow|slate|zinc|neutral)-\d{2,3})/;

afterEach(cleanup);

describe('Button', () => {
  it.each(['primary', 'secondary', 'destructive', 'ghost'] as const)(
    'renders %s variant without raw palette classes',
    (variant) => {
      render(<Button variant={variant}>Ok</Button>);
      const button = screen.getByRole('button', { name: 'Ok' });
      expect(button.className).not.toMatch(RAW_PALETTE);
    },
  );

  it('shows spinner, disables and sets aria-busy when loading', () => {
    render(<Button loading>Salvar</Button>);
    const button = screen.getByRole('button', { name: /Salvar/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('keeps default type=button and merges className', () => {
    render(<Button className="extra">Ok</Button>);
    const button = screen.getByRole('button', { name: 'Ok' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('extra');
  });
});
