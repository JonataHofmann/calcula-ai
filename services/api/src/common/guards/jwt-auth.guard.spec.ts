import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { TokenVerifier } from '@finance/auth';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(headers: Record<string, string>, isPublic = false) {
  const req: Record<string, unknown> = { headers };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: jest.fn(() => isPublic),
  } as unknown as Reflector;
  return { context, req, reflector };
}

describe('JwtAuthGuard', () => {
  const validVerifier: TokenVerifier = {
    verify: jest.fn(async () => ({
      sub: 'kc-user-1',
      payload: { realm_access: { roles: ['user'] } },
    })),
  };

  const failingVerifier: TokenVerifier = {
    verify: jest.fn(async () => {
      throw new Error('invalid');
    }),
  };

  it('allows @Public routes without header', async () => {
    const { context, reflector } = makeContext({}, true);
    const guard = new JwtAuthGuard(reflector, failingVerifier);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects request without Authorization header', async () => {
    const { context, reflector } = makeContext({});
    const guard = new JwtAuthGuard(reflector, validVerifier);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects non-Bearer header', async () => {
    const { context, reflector } = makeContext({ authorization: 'Basic abc' });
    const guard = new JwtAuthGuard(reflector, validVerifier);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid token', async () => {
    const { context, reflector } = makeContext({ authorization: 'Bearer bad-token' });
    const guard = new JwtAuthGuard(reflector, failingVerifier);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts valid token and populates req.user with id = keycloakUserId', async () => {
    const { context, req, reflector } = makeContext({ authorization: 'Bearer good-token' });
    const guard = new JwtAuthGuard(reflector, validVerifier);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req['user']).toEqual({
      id: 'kc-user-1',
      keycloakUserId: 'kc-user-1',
      roles: ['user'],
    });
  });
});
