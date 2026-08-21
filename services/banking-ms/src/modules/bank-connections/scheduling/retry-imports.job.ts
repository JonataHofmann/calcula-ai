import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BankConnectionsService, RETRY_LIMIT } from '../bank-connections.service';

@Injectable()
export class RetryImportsJob {
  private readonly logger = new Logger(RetryImportsJob.name);

  constructor(private readonly service: BankConnectionsService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    const errored = await this.service.findErroredSyncedTransactions(RETRY_LIMIT);
    for (const synced of errored) {
      try {
        await this.service.retryFailedImports({ synced });
      } catch (error) {
        this.logger.warn(`Retry failed for transaction ${synced.pluggyTransactionId}: ${(error as Error).message}`);
      }
    }
  }
}
