import { HttpException, Injectable } from '@nestjs/common';

export interface ApiRequestOptions {
  token: string;
  body?: unknown;
  idempotencyKey?: string;
}

/**
 * Shared fetch-based proxy logic for BFF -> upstream microservice calls. Forwards
 * the user's access token as a Bearer credential and propagates the Idempotency-Key
 * on writes. Upstream error statuses are re-thrown as Nest HttpExceptions so the
 * BFF mirrors them (e.g. 404).
 */
export async function proxyRequest<T>(
  base: string,
  method: string,
  path: string,
  { token, body, idempotencyKey }: ApiRequestOptions,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new HttpException(data ?? { message: res.statusText }, res.status);
  }
  return data as T;
}

/** Thin HTTP client for BFF -> API-MS calls. */
@Injectable()
export class ApiClient {
  private readonly base = process.env.API_URL ?? 'http://localhost:3031';

  async get<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return proxyRequest<T>(this.base, 'GET', path, opts);
  }

  async post<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return proxyRequest<T>(this.base, 'POST', path, opts);
  }

  async patch<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return proxyRequest<T>(this.base, 'PATCH', path, opts);
  }

  async delete<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return proxyRequest<T>(this.base, 'DELETE', path, opts);
  }
}
