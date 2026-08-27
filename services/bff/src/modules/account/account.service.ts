import { Injectable, Logger } from '@nestjs/common';
import type { BackupSnapshot, ImportMode, ImportResult, ResetResult } from '@finance/contracts';
import { ApiClient } from '../../common/api-client';

/** Proxies user-account maintenance to the API-MS. No business logic — forwards the token only. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly api: ApiClient) {}

  reset(token: string, idempotencyKey?: string): Promise<ResetResult> {
    this.logger.warn('Proxying POST /account/reset');
    return this.api.post<ResetResult>('/account/reset', { token, idempotencyKey });
  }

  export(token: string): Promise<BackupSnapshot> {
    this.logger.log('Proxying GET /account/export');
    return this.api.get<BackupSnapshot>('/account/export', { token });
  }

  import(
    token: string,
    snapshot: unknown,
    mode: ImportMode,
    idempotencyKey?: string,
  ): Promise<ImportResult> {
    this.logger.warn(`Proxying POST /account/import mode=${mode}`);
    return this.api.post<ImportResult>(`/account/import?mode=${mode}`, {
      token,
      body: snapshot,
      idempotencyKey,
    });
  }
}
