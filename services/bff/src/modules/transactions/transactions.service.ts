import { Injectable, Logger } from '@nestjs/common';
import type {
  CreateTransactionInput,
  EffectuateInput,
  ForecastQuery,
  ForecastResponse,
  TransactionDto,
  UpdateTransactionInput,
} from '@finance/contracts';
import { ApiClient } from '../../common/api-client';

function withQuery(path: string, query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export interface CreateResult {
  transactions: TransactionDto[];
}

export interface EffectuateResult {
  transaction: TransactionDto;
  next: TransactionDto | null;
}

/** Proxies transaction endpoints to the API-MS. All money/scope rules live in the API-MS (regra 6). */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly api: ApiClient) {}

  list(token: string, query: Record<string, unknown>): Promise<TransactionDto[]> {
    this.logger.log('Proxying GET /transactions');
    return this.api.get<TransactionDto[]>(withQuery('/transactions', query), { token });
  }

  overdue(token: string, query: Record<string, unknown>): Promise<TransactionDto[]> {
    this.logger.log('Proxying GET /transactions/overdue');
    return this.api.get<TransactionDto[]>(withQuery('/transactions/overdue', query), { token });
  }

  forecast(token: string, query: ForecastQuery): Promise<ForecastResponse> {
    this.logger.log('Proxying GET /transactions/forecast');
    return this.api.get<ForecastResponse>(withQuery('/transactions/forecast', query), { token });
  }

  get(token: string, id: string): Promise<TransactionDto> {
    this.logger.log(`Proxying GET /transactions/${id}`);
    return this.api.get<TransactionDto>(`/transactions/${id}`, { token });
  }

  create(token: string, body: CreateTransactionInput, idempotencyKey?: string): Promise<CreateResult> {
    this.logger.log('Proxying POST /transactions');
    return this.api.post<CreateResult>('/transactions', { token, body, idempotencyKey });
  }

  update(
    token: string,
    id: string,
    body: UpdateTransactionInput,
    scope?: string,
    idempotencyKey?: string,
  ): Promise<CreateResult> {
    this.logger.log(`Proxying PATCH /transactions/${id}`);
    return this.api.patch<CreateResult>(withQuery(`/transactions/${id}`, { scope }), {
      token,
      body,
      idempotencyKey,
    });
  }

  effectuate(
    token: string,
    id: string,
    body: EffectuateInput,
    idempotencyKey?: string,
  ): Promise<EffectuateResult> {
    this.logger.log(`Proxying POST /transactions/${id}/effectuate`);
    return this.api.post<EffectuateResult>(`/transactions/${id}/effectuate`, {
      token,
      body,
      idempotencyKey,
    });
  }

  remove(token: string, id: string, scope?: string, idempotencyKey?: string): Promise<void> {
    this.logger.log(`Proxying DELETE /transactions/${id}`);
    return this.api.delete<void>(withQuery(`/transactions/${id}`, { scope }), {
      token,
      idempotencyKey,
    });
  }
}
