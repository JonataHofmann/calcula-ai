import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Badge } from './badge.js';

const RAW_PALETTE = /(#[0-9a-fA-F]{3,8}|-(blue|gray|red|green|yellow|slate|zinc|neutral)-\d{2,3})/;

afterEach(cleanup);

describe('Badge', () => {
  it.each(['default', 'success', 'warning', 'danger', 'info'] as const)(
    'renders %s variant without raw palette classes',
    (variant) => {
      render(<Badge variant={variant}>Tag</Badge>);
      const badge = screen.getByText('Tag');
      expect(badge.className).not.toMatch(RAW_PALETTE);
    },
  );

  it('renders the new info variant with info tokens', () => {
    render(<Badge variant="info">Info</Badge>);
    expect(screen.getByText('Info').className).toContain('bg-info-soft');
  });
});
