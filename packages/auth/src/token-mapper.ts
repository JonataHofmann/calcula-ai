import type { AuthenticatedUser } from '@finance/contracts';
import type { VerifiedToken } from './token-verifier.js';

interface RealmAccessClaim {
  roles?: unknown;
}

export function extractRoles(payload: Record<string, unknown>): string[] {
  const realmAccess = payload['realm_access'] as RealmAccessClaim | undefined;
  if (!realmAccess || !Array.isArray(realmAccess.roles)) {
    return [];
  }
  return realmAccess.roles.filter((role): role is string => typeof role === 'string');
}

export function toAuthenticatedUser(token: VerifiedToken, localUserId: string): AuthenticatedUser {
  return {
    id: localUserId,
    keycloakUserId: token.sub,
    roles: extractRoles(token.payload),
  };
}
