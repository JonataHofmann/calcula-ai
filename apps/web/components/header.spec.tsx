import { configureStore } from '@reduxjs/toolkit';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uiReducer } from '../store/ui-slice';
import { Header } from './header';

const sessionMock = vi.hoisted(() => ({
  value: { user: undefined as unknown, isLoading: true },
}));

vi.mock('../features/auth/use-session', () => ({
  useSession: () => sessionMock.value,
}));

const logoutMock = vi.hoisted(() => vi.fn());

vi.mock('../services/auth-api', () => ({
  logout: logoutMock,
}));

function renderHeader() {
  const store = configureStore({ reducer: { ui: uiReducer } });
  return render(
    <Provider store={store}>
      <Header />
    </Provider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  logoutMock.mockReset();
  sessionMock.value = { user: undefined, isLoading: true };
});

describe('Header', () => {
  it('shows skeleton while session loads', () => {
    sessionMock.value = { user: undefined, isLoading: true };
    const { container } = renderHeader();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows user name and email when loaded', () => {
    sessionMock.value = {
      user: { id: 'kc-1', name: 'Maria Silva', email: 'maria@ex.com', roles: ['user'] },
      isLoading: false,
    };
    renderHeader();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('maria@ex.com')).toBeInTheDocument();
  });

  it('logs out navigating to logoutUrl', async () => {
    sessionMock.value = {
      user: { id: 'kc-1', name: 'Maria', roles: [] },
      isLoading: false,
    };
    logoutMock.mockResolvedValue('http://keycloak/logout');
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });

    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /Sair/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('http://keycloak/logout'));
  });

  it('falls back to / when logoutUrl is null', async () => {
    sessionMock.value = {
      user: { id: 'kc-1', name: 'Maria', roles: [] },
      isLoading: false,
    };
    logoutMock.mockResolvedValue(null);
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });

    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /Sair/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
  });

  it('has a mobile hamburger button', () => {
    sessionMock.value = { user: undefined, isLoading: true };
    renderHeader();
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument();
  });
});
