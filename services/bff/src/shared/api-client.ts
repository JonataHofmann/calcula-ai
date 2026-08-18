import { HttpException, Injectable } from '@nestjs/common';

export interface ApiRequestOptions {
  token: string;
  body?: unknown;
  idempotencyKey?: string;
}

/**
 * Thin HTTP client for BFF -> API-MS calls. Forwards the user's access token as a
 * Bearer credential and propagates the Idempotency-Key on writes. API error
 * statuses are re-thrown as Nest HttpExceptions so the BFF mirrors them (e.g. 404).
 */
@Injectable()
export class ApiClient {
  private readonly base = process.env.API_URL ?? 'http://localhost:3001';

  async get<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return this.request<T>('GET', path, opts);
  }

  async post<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return this.request<T>('POST', path, opts);
  }

  async patch<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, opts);
  }

  async delete<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, opts);
  }

  private async request<T>(
    method: string,
    path: string,
    { token, body, idempotencyKey }: ApiRequestOptions,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const res = await fetch(`${this.base}${path}`, {
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
}
