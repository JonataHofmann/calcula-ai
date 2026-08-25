import { Injectable, Logger } from '@nestjs/common';
import * as oidc from 'openid-client';
import type { SessionTokens } from './session/session.store';

export interface AuthServiceOptions {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  bffPublicUrl: string;
  webUrl: string;
}

export interface LoginState {
  returnTo: string;
  nonce: string;
  codeVerifier: string;
  createdAt: number;
}

export interface CallbackResult {
  tokens: SessionTokens;
  claims: Record<string, unknown>;
  returnTo: string;
  refreshExpiresAt: Date;
}

export class ProviderUnavailableError extends Error {
  constructor() {
    super('OIDC provider unavailable');
  }
}

export class InvalidCallbackError extends Error {
  constructor(message = 'Invalid OIDC callback') {
    super(message);
  }
}

const STATE_TTL_MS = 10 * 60 * 1000;
const DISCOVERY_TIMEOUT_MS = 5_000;
const DEFAULT_REFRESH_LIFETIME_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private config: oidc.Configuration | null = null;
  private readonly states = new Map<string, LoginState>();

  constructor(readonly options: AuthServiceOptions) {}

  private async getConfig(): Promise<oidc.Configuration> {
    if (this.config) {
      return this.config;
    }
    const issuer = new URL(`${this.options.keycloakUrl}/realms/${this.options.realm}`);
    try {
      this.config = await oidc.discovery(
        issuer,
        this.options.clientId,
        this.options.clientSecret,
        undefined,
        {
          [oidc.customFetch]: ((url, opts) =>
            fetch(url, {
              ...opts,
              signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
            })) satisfies oidc.CustomFetch,
          execute: issuer.protocol === 'http:' ? [oidc.allowInsecureRequests] : [],
        },
      );
      return this.config;
    } catch {
      this.logger.warn('OIDC discovery failed');
      throw new ProviderUnavailableError();
    }
  }

  validateReturnTo(returnTo: string | undefined): string {
    if (!returnTo) {
      return '/';
    }
    if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('://')) {
      return '/';
    }
    return returnTo;
  }

  async createAuthorizationUrl(returnTo: string): Promise<string> {
    const config = await this.getConfig();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();

    this.pruneStates();
    this.states.set(state, { returnTo, nonce, codeVerifier, createdAt: Date.now() });

    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: `${this.options.bffPublicUrl}/auth/callback`,
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return url.href;
  }

  async handleCallback(currentUrl: URL): Promise<CallbackResult> {
    if (currentUrl.searchParams.get('error')) {
      throw new InvalidCallbackError('Provider returned an error');
    }
    const state = currentUrl.searchParams.get('state');
    if (!state) {
      throw new InvalidCallbackError('Missing state');
    }
    const loginState = this.states.get(state);
    if (!loginState || Date.now() - loginState.createdAt > STATE_TTL_MS) {
      this.states.delete(state);
      throw new InvalidCallbackError('Unknown or expired state');
    }
    this.states.delete(state);

    const config = await this.getConfig();
    let response: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
    try {
      response = await oidc.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: loginState.codeVerifier,
        expectedState: state,
        expectedNonce: loginState.nonce,
        idTokenExpected: true,
      });
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        throw error;
      }
      // Loga a causa real do Keycloak (invalid_grant / invalid_client / redirect_uri…).
      const err = error as {
        message?: string;
        error?: string;
        error_description?: string;
        cause?: unknown;
      };
      this.logger.warn(
        `Token exchange failed: ${err.error ?? ''} ${err.error_description ?? ''} ${err.message ?? String(error)}`,
      );
      throw new InvalidCallbackError('Token exchange failed');
    }

    return this.toCallbackResult(response, loginState.returnTo);
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    const config = await this.getConfig();
    const response = await oidc.refreshTokenGrant(config, refreshToken);
    return this.toSessionTokens(response, refreshToken);
  }

  async buildLogoutUrl(idToken: string): Promise<string | null> {
    try {
      const config = await this.getConfig();
      const url = oidc.buildEndSessionUrl(config, {
        id_token_hint: idToken,
        post_logout_redirect_uri: this.options.webUrl,
      });
      return url.href;
    } catch {
      return null;
    }
  }

  private toCallbackResult(
    response: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
    returnTo: string,
  ): CallbackResult {
    const claims = (response.claims() ?? {}) as Record<string, unknown>;
    const refreshExpiresIn = (response as Record<string, unknown>)['refresh_expires_in'];
    const refreshLifetimeMs =
      typeof refreshExpiresIn === 'number' && refreshExpiresIn > 0
        ? refreshExpiresIn * 1000
        : DEFAULT_REFRESH_LIFETIME_MS;
    return {
      tokens: this.toSessionTokens(response),
      claims,
      returnTo,
      refreshExpiresAt: new Date(Date.now() + refreshLifetimeMs),
    };
  }

  private toSessionTokens(
    response: oidc.TokenEndpointResponse,
    fallbackRefreshToken?: string,
  ): SessionTokens {
    const refreshToken = response.refresh_token ?? fallbackRefreshToken;
    const idToken = response.id_token;
    if (!response.access_token || !refreshToken || !idToken) {
      throw new InvalidCallbackError('Token response missing required tokens');
    }
    const expiresIn = response.expires_in ?? 300;
    return {
      accessToken: response.access_token,
      refreshToken,
      idToken,
      accessTokenExpiresAt: Date.now() + expiresIn * 1000,
    };
  }

  private pruneStates(): void {
    const now = Date.now();
    for (const [key, value] of this.states) {
      if (now - value.createdAt > STATE_TTL_MS) {
        this.states.delete(key);
      }
    }
  }
}
