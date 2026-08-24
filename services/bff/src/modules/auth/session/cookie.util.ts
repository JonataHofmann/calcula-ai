import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';

export const SESSION_COOKIE_NAME = 'finance_session';

export function signSessionId(sessionId: string, secret: string): string {
  const hmac = createHmac('sha256', secret).update(sessionId).digest('base64url');
  return `${sessionId}.${hmac}`;
}

export function verifySessionCookie(value: string, secret: string): string | null {
  const separator = value.lastIndexOf('.');
  if (separator <= 0) {
    return null;
  }
  const sessionId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = createHmac('sha256', secret).update(sessionId).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }
  return sessionId;
}

/**
 * Atributos compartilhados. Em produção web e bff vivem em subdomínios distintos
 * (ex.: calculaai.dominio / calculaaibff.dominio). Sem `Domain`, o cookie é host-only
 * (só o bff o recebe) e o middleware do web nunca vê a sessão → loop de login.
 * Setar SESSION_COOKIE_DOMAIN=.dominio compartilha o cookie entre os subdomínios.
 * Em dev (localhost:PORT) deixe vazio: cookie host-only já é compartilhado entre portas.
 */
function cookieOptions() {
  const domain = process.env.SESSION_COOKIE_DOMAIN;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

export function setSessionCookie(res: Response, sessionId: string, secret: string): void {
  res.cookie(SESSION_COOKIE_NAME, signSessionId(sessionId, secret), cookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions());
}
