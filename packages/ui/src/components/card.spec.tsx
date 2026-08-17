import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card, CardContent, CardHeader, CardTitle } from './card.js';

const RAW_PALETTE = /(#[0-9a-fA-F]{3,8}|-(blue|gray|red|green|yellow|slate|zinc|neutral)-\d{2,3})/;

afterEach(cleanup);

describe('Card', () => {
  it('renders composed card with token classes only', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Título</CardTitle>
        </CardHeader>
        <CardContent>Conteúdo</CardContent>
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card.className).not.toMatch(RAW_PALETTE);
    expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });
});
