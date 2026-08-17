import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '@finance/contracts';
import type { Request, Response } from 'express';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { clearSessionCookie, SESSION_COOKIE_NAME, verifySessionCookie } from '../session/cookie.util';
import { SESSION_SECRET_TOKEN } from '../session/typeorm-session.store';
import { SESSION_STORE, type Session, type SessionStore } from '../session/session.store';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const REFRESH_WINDOW_MS = 60 * 1000;

export interface SessionRequestContext {
  user: AuthenticatedUser;
  session: Session;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
    private readonly authService: AuthService,
    @Inject(SESSION_SECRET_TOKEN) private readonly sessionSecret: string,
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
      .getRequest<Request & { cookies?: Record<string, string> } & Partial<SessionRequestContext>>();
    const response = context.switchToHttp().getResponse<Response>();

    const cookieValue = request.cookies?.[SESSION_COOKIE_NAME];
    if (!cookieValue) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }

    const sessionId = verifySessionCookie(cookieValue, this.sessionSecret);
    if (!sessionId) {
      clearSessionCookie(response);
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }

    const session = await this.sessionStore.findById(sessionId);
    if (!session) {
      clearSessionCookie(response);
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }

    const now = Date.now();
    if (
      now - session.lastActivityAt.getTime() > INACTIVITY_LIMIT_MS ||
      now > session.expiresAt.getTime()
    ) {
      await this.sessionStore.delete(session.id);
      clearSessionCookie(response);
      throw new UnauthorizedException({ code: 'SESSION_EXPIRED' });
    }

    if (session.tokens.accessTokenExpiresAt - now < REFRESH_WINDOW_MS) {
      try {
        const refreshed = await this.authService.refresh(session.tokens.refreshToken);
        await this.sessionStore.updateTokens(session.id, refreshed);
        session.tokens = refreshed;
      } catch {
        await this.sessionStore.delete(session.id);
        clearSessionCookie(response);
        throw new UnauthorizedException({ code: 'SESSION_EXPIRED' });
      }
    }

    await this.sessionStore.touch(session.id, new Date(now));

    request.user = {
      id: session.keycloakUserId,
      keycloakUserId: session.keycloakUserId,
      roles: [],
    };
    request.session = session;
    return true;
  }
}
