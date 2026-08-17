import {
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { sessionUserSchema, type SessionUser } from '@finance/contracts';
import { extractRoles } from '@finance/auth';
import type { Request, Response } from 'express';
import {
  AuthService,
  InvalidCallbackError,
  ProviderUnavailableError,
} from './auth.service';
import { Public } from './decorators/public.decorator';
import { clearSessionCookie, setSessionCookie } from './session/cookie.util';
import { SESSION_SECRET_TOKEN } from './session/typeorm-session.store';
import { SESSION_STORE, type Session, type SessionStore } from './session/session.store';

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) {
    return {};
  }
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

function toSessionUser(claims: Record<string, unknown>): SessionUser {
  const sub = typeof claims['sub'] === 'string' ? claims['sub'] : '';
  const name =
    typeof claims['name'] === 'string' && claims['name'].length > 0
      ? claims['name']
      : typeof claims['preferred_username'] === 'string'
        ? claims['preferred_username']
        : sub;
  const email = typeof claims['email'] === 'string' ? claims['email'] : undefined;
  return sessionUserSchema.parse({
    id: sub,
    name,
    email,
    roles: extractRoles(claims),
  });
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
    @Inject(SESSION_SECRET_TOKEN) private readonly sessionSecret: string,
  ) {}

  @Public()
  @Get('login')
  async login(@Query('returnTo') returnTo: string | undefined, @Res() res: Response) {
    const safeReturnTo = this.authService.validateReturnTo(returnTo);
    try {
      const url = await this.authService.createAuthorizationUrl(safeReturnTo);
      return res.redirect(302, url);
    } catch {
      return res.redirect(
        302,
        `${this.authService.options.webUrl}/auth/error?reason=provider_unavailable`,
      );
    }
  }

  @Public()
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const currentUrl = new URL(
      req.originalUrl,
      this.authService.options.bffPublicUrl,
    );
    try {
      const result = await this.authService.handleCallback(currentUrl);
      const keycloakUserId =
        typeof result.claims['sub'] === 'string' ? result.claims['sub'] : '';
      if (!keycloakUserId) {
        throw new InvalidCallbackError('Missing sub claim');
      }
      const session = await this.sessionStore.create({
        keycloakUserId,
        tokens: result.tokens,
        expiresAt: result.refreshExpiresAt,
      });
      setSessionCookie(res, session.id, this.sessionSecret);
      return res.redirect(302, `${this.authService.options.webUrl}${result.returnTo}`);
    } catch (error) {
      const reason =
        error instanceof ProviderUnavailableError ? 'provider_unavailable' : 'invalid_callback';
      return res.redirect(302, `${this.authService.options.webUrl}/auth/error?reason=${reason}`);
    }
  }

  @Get('me')
  me(@Req() req: Request & { session?: Session }): SessionUser {
    const session = req.session as Session;
    const claims = decodeJwtPayload(session.tokens.accessToken);
    if (typeof claims['sub'] !== 'string') {
      claims['sub'] = session.keycloakUserId;
    }
    return toSessionUser(claims);
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request & { session?: Session }, @Res() res: Response) {
    const cookieValue = (req as Request & { cookies?: Record<string, string> }).cookies?.[
      'finance_session'
    ];
    let logoutUrl: string | null = null;
    if (cookieValue) {
      const { verifySessionCookie } = await import('./session/cookie.util');
      const sessionId = verifySessionCookie(cookieValue, this.sessionSecret);
      if (sessionId) {
        const session = await this.sessionStore.findById(sessionId);
        if (session) {
          logoutUrl = await this.authService.buildLogoutUrl(session.tokens.idToken);
          await this.sessionStore.delete(session.id);
        }
      }
    }
    clearSessionCookie(res);
    return res.status(200).json({ logoutUrl });
  }
}
