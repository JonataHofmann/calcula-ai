import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { extractRoles, type TokenVerifier } from '@finance/auth';
import type { Request } from 'express';
import { TOKEN_VERIFIER } from './jwt-auth.guard';

const REQUIRED_ROLE = 'svc-transactions-import';

/**
 * Guards routes only Keycloak client-credentials service tokens may call (e.g. banking-ms's
 * synced-import routes). Distinct from JwtAuthGuard: it requires the `svc-transactions-import`
 * role instead of trusting any authenticated end-user, since these routes take `userId`
 * explicitly in the body rather than from the token (the sole exception to rule 2 in AGENTS.md).
 */
@Injectable()
export class ServiceAccountGuard implements CanActivate {
  constructor(@Inject(TOKEN_VERIFIER) private readonly tokenVerifier: TokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }

    const token = header.slice('Bearer '.length);
    try {
      const verified = await this.tokenVerifier.verify(token);
      const roles = extractRoles(verified.payload);
      if (!roles.includes(REQUIRED_ROLE)) {
        throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
      }
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }
  }
}
