import { createRemoteJWKSet, jwtVerify } from 'jose';
import { InvalidTokenError } from './errors.js';
import type { TokenVerifier, VerifiedToken } from './token-verifier.js';

export interface KeycloakTokenVerifierOptions {
  keycloakUrl: string;
  realm: string;
  audience?: string;
}

export class KeycloakTokenVerifier implements TokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience?: string;

  constructor(options: KeycloakTokenVerifierOptions) {
    this.issuer = `${options.keycloakUrl}/realms/${options.realm}`;
    this.audience = options.audience;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/protocol/openid-connect/certs`));
  }

  async verify(token: string): Promise<VerifiedToken> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });
      if (!payload.sub) {
        throw new InvalidTokenError('Token missing sub claim');
      }
      return { sub: payload.sub, payload: payload as Record<string, unknown> };
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error;
      }
      throw new InvalidTokenError();
    }
  }
}
