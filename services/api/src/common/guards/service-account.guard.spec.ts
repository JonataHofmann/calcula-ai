import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { TokenVerifier } from '@finance/auth';
import { ServiceAccountGuard } from './service-account.guard';

function makeContext(headers: Record<string, string>) {
  const req: Record<string, unknown> = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return context;
}

describe('ServiceAccountGuard', () => {
  const serviceVerifier: TokenVerifier = {
    verify: jest.fn(async () => ({
      sub: 'service-account-banking-ms',
      payload: { realm_access: { roles: ['svc-transactions-import'] } },
    })),
  };

  const userVerifier: TokenVerifier = {
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

  it('rejects request without Authorization header', async () => {
    const context = makeContext({});
    const guard = new ServiceAccountGuard(serviceVerifier);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid token', async () => {
    const context = makeContext({ authorization: 'Bearer bad-token' });
    const guard = new ServiceAccountGuard(failingVerifier);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a valid token missing the svc-transactions-import role', async () => {
    const context = makeContext({ authorization: 'Bearer good-user-token' });
    const guard = new ServiceAccountGuard(userVerifier);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid token carrying the svc-transactions-import role', async () => {
    const context = makeContext({ authorization: 'Bearer good-service-token' });
    const guard = new ServiceAccountGuard(serviceVerifier);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
