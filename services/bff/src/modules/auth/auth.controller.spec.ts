import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import {
  AuthService,
  InvalidCallbackError,
  ProviderUnavailableError,
} from './auth.service';
import { signSessionId } from './session/cookie.util';
import type { Session, SessionStore, SessionTokens } from './session/session.store';

const SECRET = 'test-secret-with-at-least-32-chars!!';

const options = {
  keycloakUrl: 'http://localhost:8080',
  realm: 'finance',
  clientId: 'finance-web',
  clientSecret: 'dev-secret',
  bffPublicUrl: 'http://localhost:3002',
  webUrl: 'http://localhost:3000',
};

function makeTokens(overrides: Partial<SessionTokens> = {}): SessionTokens {
  return {
    accessToken: 'header.payload.sig',
    refreshToken: 'refresh',
    idToken: 'id-token',
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
    create: jest.fn(async () => makeSession()),
    findById: jest.fn(async () => session),
    updateTokens: jest.fn(),
    touch: jest.fn(),
    delete: jest.fn(),
  } satisfies SessionStore;
}

function makeResponse() {
  const res = {
    redirect: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & typeof res;
}

function makeAuthService(overrides: Partial<AuthService> = {}): AuthService {
  const service = new AuthService(options);
  return Object.assign(service, overrides);
}

function encodeClaims(claims: Record<string, unknown>): string {
  return `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
}

describe('AuthController', () => {
  describe('GET /auth/login', () => {
    it('redirects to authorization URL with valid returnTo', async () => {
      const authService = makeAuthService({
        createAuthorizationUrl: jest.fn(async () => 'http://keycloak/auth?state=x'),
      });
      const controller = new AuthController(authService, makeFakeStore(), SECRET);
      const res = makeResponse();

      await controller.login('/contas', res);
      expect(authService.createAuthorizationUrl).toHaveBeenCalledWith('/contas');
      expect(res.redirect).toHaveBeenCalledWith(302, 'http://keycloak/auth?state=x');
    });

    it('sanitizes malicious returnTo', async () => {
      const authService = makeAuthService({
        createAuthorizationUrl: jest.fn(async () => 'http://keycloak/auth'),
      });
      const controller = new AuthController(authService, makeFakeStore(), SECRET);

      await controller.login('//evil.com', makeResponse());
      expect(authService.createAuthorizationUrl).toHaveBeenCalledWith('/');
    });

    it('redirects to error page when provider unavailable', async () => {
      const authService = makeAuthService({
        createAuthorizationUrl: jest.fn(async () => {
          throw new ProviderUnavailableError();
        }),
      });
      const controller = new AuthController(authService, makeFakeStore(), SECRET);
      const res = makeResponse();

      await controller.login(undefined, res);
      expect(res.redirect).toHaveBeenCalledWith(
        302,
        'http://localhost:3000/auth/error?reason=provider_unavailable',
      );
    });
  });

  describe('GET /auth/callback', () => {
    it('creates session, sets cookie and redirects to returnTo on success', async () => {
      const authService = makeAuthService({
        handleCallback: jest.fn(async () => ({
          tokens: makeTokens(),
          claims: { sub: 'kc-1', name: 'Maria' },
          returnTo: '/contas',
          refreshExpiresAt: new Date(Date.now() + 3_600_000),
        })),
      });
      const store = makeFakeStore();
      const controller = new AuthController(authService, store, SECRET);
      const res = makeResponse();

      await controller.callback(
        { originalUrl: '/auth/callback?code=x&state=y' } as Request,
        res,
      );
      expect(store.create).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        'finance_session',
        expect.stringContaining('session-1.'),
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
      expect(res.redirect).toHaveBeenCalledWith(302, 'http://localhost:3000/contas');
    });

    it('redirects to invalid_callback on invalid state', async () => {
      const authService = makeAuthService({
        handleCallback: jest.fn(async () => {
          throw new InvalidCallbackError();
        }),
      });
      const controller = new AuthController(authService, makeFakeStore(), SECRET);
      const res = makeResponse();

      await controller.callback({ originalUrl: '/auth/callback?state=bad' } as Request, res);
      expect(res.redirect).toHaveBeenCalledWith(
        302,
        'http://localhost:3000/auth/error?reason=invalid_callback',
      );
    });

    it('redirects to provider_unavailable when token endpoint is down', async () => {
      const authService = makeAuthService({
        handleCallback: jest.fn(async () => {
          throw new ProviderUnavailableError();
        }),
      });
      const controller = new AuthController(authService, makeFakeStore(), SECRET);
      const res = makeResponse();

      await controller.callback({ originalUrl: '/auth/callback?code=x&state=y' } as Request, res);
      expect(res.redirect).toHaveBeenCalledWith(
        302,
        'http://localhost:3000/auth/error?reason=provider_unavailable',
      );
    });
  });

  describe('GET /auth/me', () => {
    it('returns SessionUser derived from access token claims', () => {
      const controller = new AuthController(makeAuthService(), makeFakeStore(), SECRET);
      const session = makeSession({
        tokens: makeTokens({
          accessToken: encodeClaims({
            sub: 'kc-1',
            name: 'Maria Silva',
            email: 'maria@ex.com',
            realm_access: { roles: ['user'] },
          }),
        }),
      });

      const user = controller.me({ session } as never);
      expect(user).toEqual({
        id: 'kc-1',
        name: 'Maria Silva',
        email: 'maria@ex.com',
        roles: ['user'],
      });
    });

    it('falls back to preferred_username when name missing', () => {
      const controller = new AuthController(makeAuthService(), makeFakeStore(), SECRET);
      const session = makeSession({
        tokens: makeTokens({
          accessToken: encodeClaims({ sub: 'kc-1', preferred_username: 'maria' }),
        }),
      });

      const user = controller.me({ session } as never);
      expect(user.name).toBe('maria');
      expect(user.roles).toEqual([]);
    });
  });

  describe('POST /auth/logout', () => {
    it('destroys session, clears cookie and returns logoutUrl', async () => {
      const session = makeSession();
      const store = makeFakeStore(session);
      const authService = makeAuthService({
        buildLogoutUrl: jest.fn(async () => 'http://keycloak/logout?id_token_hint=id-token'),
      });
      const controller = new AuthController(authService, store, SECRET);
      const res = makeResponse();

      await controller.logout(
        { cookies: { finance_session: signSessionId('session-1', SECRET) } } as never,
        res,
      );
      expect(store.delete).toHaveBeenCalledWith('session-1');
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        logoutUrl: 'http://keycloak/logout?id_token_hint=id-token',
      });
      expect(authService.buildLogoutUrl).toHaveBeenCalledWith('id-token');
    });

    it('returns 200 with null logoutUrl for invalid session', async () => {
      const store = makeFakeStore(null);
      const controller = new AuthController(makeAuthService(), store, SECRET);
      const res = makeResponse();

      await controller.logout({ cookies: {} } as never, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ logoutUrl: null });
      expect(res.clearCookie).toHaveBeenCalled();
    });

    it('handles tampered cookie gracefully', async () => {
      const store = makeFakeStore(makeSession());
      const controller = new AuthController(makeAuthService(), store, SECRET);
      const res = makeResponse();

      await controller.logout(
        { cookies: { finance_session: 'tampered.value' } } as never,
        res,
      );
      expect(store.delete).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ logoutUrl: null });
    });
  });
});
