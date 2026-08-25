import { Injectable } from '@nestjs/common';
import { outgoingTraceHeaders } from '@finance/observability';
import { UpstreamError, upstreamMessage } from './upstream-error';

export interface ApiRequestOptions {
  token: string;
  body?: unknown;
  idempotencyKey?: string;
}

/**
 * Shared fetch-based proxy logic for BFF -> upstream microservice calls. Forwards
 * the user's access token as a Bearer credential e propaga a Idempotency-Key nas
 * escritas. Qualquer falha (rede OU status !ok) vira UpstreamError com o `service`
 * de origem, para o filtro global do BFF devolver um erro rastreável — nunca um
 * "Internal Server Error" genérico.
 */
export async function proxyRequest<T>(
  service: string,
  base: string,
  method: string,
  path: string,
  { token, body, idempotencyKey }: ApiRequestOptions,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...outgoingTraceHeaders(),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    // Falha de rede (ECONNREFUSED, DNS, timeout) — upstream inalcançável => 502.
    throw new UpstreamError({
      service,
      status: 502,
      message: `Falha de rede ao contatar ${service} (${method} ${path}): ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      cause,
    });
  }

  if (res.status === 204) return undefined as T;

  // Parse robusto: corpo pode não ser JSON (proxy, HTML de erro, texto cru).
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new UpstreamError({
      service,
      status: res.status,
      upstreamStatus: res.status,
      body: data,
      message: upstreamMessage(data) ?? res.statusText ?? `Erro ${res.status} em ${service}`,
    });
  }
  return data as T;
}

/** Thin HTTP client for BFF -> API-MS calls. */
@Injectable()
export class ApiClient {
  private readonly service = 'api-ms';
  private readonly base = process.env.API_URL ?? 'http://localhost:3031';

  async get<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return proxyRequest<T>(this.service, this.base, 'GET', path, opts);
  }

  async post<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return proxyRequest<T>(this.service, this.base, 'POST', path, opts);
  }

  async patch<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return proxyRequest<T>(this.service, this.base, 'PATCH', path, opts);
  }

  async delete<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return proxyRequest<T>(this.service, this.base, 'DELETE', path, opts);
  }
}
