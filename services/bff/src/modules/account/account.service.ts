import { Injectable, Logger } from '@nestjs/common';
import type { ResetResult } from '@finance/contracts';
import { ApiClient } from '../../common/api-client';

/** Proxies the "reset my data" wipe to the API-MS. No business logic — forwards the token only. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly api: ApiClient) {}

  reset(token: string, idempotencyKey?: string): Promise<ResetResult> {
    this.logger.warn('Proxying POST /account/reset');
    return this.api.post<ResetResult>('/account/reset', { token, idempotencyKey });
  }
}
