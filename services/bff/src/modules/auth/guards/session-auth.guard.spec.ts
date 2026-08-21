import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { AuthService } from '../auth.service';
import { signSessionId } from '../session/cookie.util';
import type { Session, SessionStore, SessionTokens } from '../session/session.store';
import { SessionAuthGuard } from './session-auth.guard';

const SECRET = 'test-secret-with-at-least-32-chars!!';

function makeTokens(overrides: Partial<SessionTokens> = {}): SessionTokens {
  return {
    accessToken: 'access',
    refreshToken: 'refresh',
    idToken: 'id',
    accessTokenExpiresAt: Date.now() + 300_000,
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    keycloakUserId: 'kc-1',
    tokens: makeTokens(),
    createdAt: new Date(),
    lastActivityAt: new Date(),
    expiresAt: new Date(Date.now() + 3_600_000),
    ...overrides,
  };
}

function makeFakeStore(session: Session | null = null) {
  return {
    create: jest.fn(),
    findById: jest.fn(async () => session),
    updateTokens: jest.fn(),
    touch: jest.fn(),
    delete: jest.fn(),
  } satisfies SessionStore;
}

function makeContext(cookies: Record<string, string>, request: Record<string, unknown> = {}) {
  const req = { cookies, headers: {}, ...request };
  const res = { clearCookie: jest.fn() } as unknown as Response;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { context, req: req as Record<string, unknown>, res };
}

function makeGuard(
  store: SessionStore,
  authService: Partial<AuthService> = {},
  isPublic = false,
) {
  const reflector = {
    getAllAndOverride: jest.fn(() => isPublic),
  } as unknown as Reflector;
  return new SessionAuthGuard(reflector, store, authService as AuthService, SECRET);
}

describe('SessionAuthGuard', () => {
  it('allows @Public routes without cookie', async () => {
    const guard = makeGuard(makeFakeStore(), {}, true);
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects request without cookie', async () => {
    const guard = makeGuard(makeFakeStore());
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects tampered cookie', async () => {
    const guard = makeGuard(makeFakeStore(makeSession()));
    const { context } = makeContext({
      finance_session: `${signSessionId('session-1', SECRET)}tampered`,
    });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when session does not exist', async () => {
    const guard = makeGuard(makeFakeStore(null));
    const { context } = makeContext({ finance_session: signSessionId('session-1', SECRET) });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('destroys session after 30min inactivity with SESSION_EXPIRED', async () => {
    const session = makeSession({ lastActivityAt: new Date(Date.now() - 31 * 60 * 1000) });
    const store = makeFakeStore(session);
    const guard = makeGuard(store);
    const { context } = makeContext({ finance_session: signSessionId('session-1', SECRET) });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'SESSION_EXPIRED' },
    });
    expect(store.delete).toHaveBeenCalledWith('session-1');
  });

  it('destroys session when refresh fails', async () => {
    const session = makeSession({
      tokens: makeTokens({ accessTokenExpiresAt: Date.now() + 10_000 }),
    });
    const store = makeFakeStore(session);
    const authService = { refresh: jest.fn().mockRejectedValue(new Error('refresh failed')) };
    const guard = makeGuard(store, authService);
    const { context } = makeContext({ finance_session: signSessionId('session-1', SECRET) });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'SESSION_EXPIRED' },
    });
    expect(store.delete).toHaveBeenCalledWith('session-1');
  });

  it('refreshes tokens when access token expires in <60s', async () => {
    const session = makeSession({
      tokens: makeTokens({ accessTokenExpiresAt: Date.now() + 10_000 }),
    });
    const store = makeFakeStore(session);
    const refreshed = makeTokens({ accessToken: 'new-access' });
    const authService = { refresh: jest.fn().mockResolvedValue(refreshed) };
    const guard = makeGuard(store, authService);
    const { context, req } = makeContext({ finance_session: signSessionId('session-1', SECRET) });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(store.updateTokens).toHaveBeenCalledWith('session-1', refreshed);
    expect(req['user']).toEqual({ id: 'kc-1', keycloakUserId: 'kc-1', roles: [] });
  });

  it('happy path: populates req.user and touches session', async () => {
    const session = makeSession();
    const store = makeFakeStore(session);
    const guard = makeGuard(store);
    const { context, req } = makeContext({ finance_session: signSessionId('session-1', SECRET) });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(store.touch).toHaveBeenCalled();
    expect(req['user']).toEqual({ id: 'kc-1', keycloakUserId: 'kc-1', roles: [] });
    expect(req['session']).toBe(session);
  });
});
