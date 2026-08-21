import { Injectable } from '@nestjs/common';
import { proxyRequest, type ApiRequestOptions } from './api-client';

/** Thin HTTP client for BFF -> banking-ms calls (Pluggy bank connections proxy). */
@Injectable()
export class BankingApiClient {
  private readonly base = process.env.BANKING_MS_URL ?? 'http://localhost:3004';

  async get<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return proxyRequest<T>(this.base, 'GET', path, opts);
  }

  async post<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return proxyRequest<T>(this.base, 'POST', path, opts);
  }

  async delete<T>(path: string, opts: ApiRequestOptions): Promise<T> {
    return proxyRequest<T>(this.base, 'DELETE', path, opts);
  }
}
