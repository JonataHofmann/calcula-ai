import { Injectable, Logger } from '@nestjs/common';
import type { SyncedTransactionDto, SyncStatus } from '@finance/contracts';
import { BankingApiClient } from '../../common/banking-api-client';

/** Proxies imported-transaction reads to banking-ms; the import audit trail lives upstream. */
@Injectable()
export class SyncedTransactionsService {
  private readonly logger = new Logger(SyncedTransactionsService.name);

  constructor(private readonly api: BankingApiClient) {}

  list(token: string, status?: SyncStatus): Promise<SyncedTransactionDto[]> {
    const path = status
      ? `/synced-transactions?status=${encodeURIComponent(status)}`
      : '/synced-transactions';
    this.logger.log(`Proxying GET ${path}`);
    return this.api.get<SyncedTransactionDto[]>(path, { token });
  }
}
