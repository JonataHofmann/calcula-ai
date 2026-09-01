export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  accessTokenExpiresAt: number;
}

export interface Session {
  id: string;
  keycloakUserId: string;
  tokens: SessionTokens;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
}

export interface CreateSessionInput {
  keycloakUserId: string;
  tokens: SessionTokens;
  expiresAt: Date;
}

export const SESSION_STORE = Symbol('SESSION_STORE');

export interface SessionStore {
  create(input: CreateSessionInput): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  /** Persists refreshed tokens; when `expiresAt` is given, slides the session window forward. */
  updateTokens(id: string, tokens: SessionTokens, expiresAt?: Date): Promise<void>;
  touch(id: string, lastActivityAt: Date): Promise<void>;
  delete(id: string): Promise<void>;
}
