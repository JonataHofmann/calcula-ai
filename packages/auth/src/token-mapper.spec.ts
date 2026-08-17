import { describe, expect, it } from 'vitest';
import { extractRoles, toAuthenticatedUser } from './token-mapper.js';

describe('extractRoles', () => {
  it('extracts realm roles', () => {
    expect(extractRoles({ realm_access: { roles: ['user', 'admin'] } })).toEqual(['user', 'admin']);
  });

  it('returns empty array when claim absent', () => {
    expect(extractRoles({})).toEqual([]);
  });

  it('filters non-string roles', () => {
    expect(extractRoles({ realm_access: { roles: ['user', 42] } })).toEqual(['user']);
  });
});

describe('toAuthenticatedUser', () => {
  it('maps verified token to authenticated user', () => {
    const user = toAuthenticatedUser(
      { sub: 'kc-123', payload: { realm_access: { roles: ['user'] } } },
      'local-1',
    );
    expect(user).toEqual({ id: 'local-1', keycloakUserId: 'kc-123', roles: ['user'] });
  });
});
