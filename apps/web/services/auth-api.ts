import { sessionUserSchema, type SessionUser } from '@finance/contracts';

const BFF_URL = process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:3002';

export class UnauthenticatedError extends Error {
  constructor() {
    super('Unauthenticated');
  }
}

export async function getMe(): Promise<SessionUser> {
  const response = await fetch(`${BFF_URL}/auth/me`, {
    credentials: 'include',
  });
  if (response.status === 401) {
    throw new UnauthenticatedError();
  }
  if (!response.ok) {
    throw new Error(`Failed to load session: ${response.status}`);
  }
  const data: unknown = await response.json();
  return sessionUserSchema.parse(data);
}

export async function logout(): Promise<string | null> {
  const response = await fetch(`${BFF_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { logoutUrl?: string | null };
  return data.logoutUrl ?? null;
}

export function getLoginUrl(returnTo: string): string {
  return `${BFF_URL}/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}
