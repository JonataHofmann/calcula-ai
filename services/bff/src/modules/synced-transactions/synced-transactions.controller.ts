import { Controller, Get, Logger, Query, Req } from '@nestjs/common';
import type { SyncedTransactionDto, SyncStatus } from '@finance/contracts';
import type { Request } from 'express';
import { SyncedTransactionsService } from './synced-transactions.service';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

/** Proxies imported-transaction reads to banking-ms, scoped by the caller's session token. */
@Controller('synced-transactions')
export class SyncedTransactionsController {
  private readonly logger = new Logger(SyncedTransactionsController.name);

  constructor(private readonly syncedTransactions: SyncedTransactionsService) {}

  @Get()
  list(
    @Req() req: SessionRequest,
    @Query('status') status?: SyncStatus,
  ): Promise<SyncedTransactionDto[]> {
    this.logger.log(`GET /synced-transactions${status ? ` (status=${status})` : ''}`);
    return this.syncedTransactions.list(tokenOf(req), status);
  }
}
