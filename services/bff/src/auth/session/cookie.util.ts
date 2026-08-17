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

export function setSessionCookie(res: Response, sessionId: string, secret: string): void {
  res.cookie(SESSION_COOKIE_NAME, signSessionId(sessionId, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
