import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Skeleton } from './skeleton.js';

const RAW_PALETTE = /(#[0-9a-fA-F]{3,8}|-(blue|gray|red|green|yellow|slate|zinc|neutral)-\d{2,3})/;

afterEach(cleanup);

describe('Skeleton', () => {
  it('renders with token classes only', () => {
    render(<Skeleton data-testid="skeleton" className="h-4 w-24" />);
    const el = screen.getByTestId('skeleton');
    expect(el.className).not.toMatch(RAW_PALETTE);
    expect(el.className).toContain('animate-pulse');
  });
});
