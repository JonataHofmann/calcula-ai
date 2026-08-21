import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { toAuthenticatedUser, type TokenVerifier } from '@finance/auth';
import type { AuthenticatedUser } from '@finance/contracts';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly tokenVerifier: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }

    const token = header.slice('Bearer '.length);
    try {
      const verified = await this.tokenVerifier.verify(token);
      request.user = toAuthenticatedUser(verified, verified.sub);
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }
  }
}
