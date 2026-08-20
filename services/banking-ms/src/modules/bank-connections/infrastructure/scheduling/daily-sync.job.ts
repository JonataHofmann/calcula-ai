import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BANK_CONNECTION_REPOSITORY, type BankConnectionRepository } from '../../domain/bank-connection.repository';
import { PLUGGY_CLIENT, type PluggyClient } from '../../domain/pluggy-client.port';
import { SyncConnectionUseCase } from '../../application/use-cases/sync-connection/sync-connection';

export const STALE_SYNC_THRESHOLD_HOURS = 20;

@Injectable()
export class DailySyncJob {
  private readonly logger = new Logger(DailySyncJob.name);

  constructor(
    @Inject(BANK_CONNECTION_REPOSITORY) private readonly connections: BankConnectionRepository,
    @Inject(PLUGGY_CLIENT) private readonly pluggy: PluggyClient,
    private readonly syncConnection: SyncConnectionUseCase,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    const threshold = new Date(Date.now() - STALE_SYNC_THRESHOLD_HOURS * 60 * 60 * 1000);
    const stale = await this.connections.findStaleActiveConnections(threshold);

    for (const connection of stale) {
      try {
        await this.pluggy.forceRefreshItem(connection.pluggyItemId);
        await this.syncConnection.execute({ userId: connection.userId, bankConnectionId: connection.id });
      } catch (error) {
        this.logger.warn(`Daily sync failed for connection ${connection.id}: ${(error as Error).message}`);
      }
    }
  }
}
