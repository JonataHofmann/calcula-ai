import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from './use-session';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const validUser = {
  id: 'kc-1',
  name: 'Maria Silva',
  email: 'maria@ex.com',
  roles: ['user'],
};

describe('useSession', () => {
  const assignMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('location', {
      pathname: '/contas',
      search: '?page=2',
      assign: assignMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    assignMock.mockReset();
  });

  it('returns parsed user on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(validUser), { status: 200 })),
    );
    const { result } = renderHook(() => useSession(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.user).toEqual(validUser));
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('redirects to login with returnTo on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ code: 'UNAUTHENTICATED' }), { status: 401 })),
    );
    renderHook(() => useSession(), { wrapper: makeWrapper() });
    await waitFor(() => expect(assignMock).toHaveBeenCalled());
    const target = assignMock.mock.calls[0]?.[0] as string;
    expect(target).toContain('/auth/login?returnTo=');
    expect(target).toContain(encodeURIComponent('/contas?page=2'));
  });

  it('errors on invalid payload without redirect', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ wrong: true }), { status: 200 })),
    );
    const { result } = renderHook(() => useSession(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.user).toBeUndefined();
    expect(assignMock).not.toHaveBeenCalled();
  });
});
