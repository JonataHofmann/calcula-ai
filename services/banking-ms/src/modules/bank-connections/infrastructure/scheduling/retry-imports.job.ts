import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BANK_CONNECTION_REPOSITORY, type BankConnectionRepository } from '../../domain/bank-connection.repository';
import {
  RETRY_LIMIT,
  RetryFailedImportsUseCase,
} from '../../application/use-cases/retry-failed-imports/retry-failed-imports';

@Injectable()
export class RetryImportsJob {
  private readonly logger = new Logger(RetryImportsJob.name);

  constructor(
    @Inject(BANK_CONNECTION_REPOSITORY) private readonly connections: BankConnectionRepository,
    private readonly retryFailedImports: RetryFailedImportsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    const errored = await this.connections.findErroredSyncedTransactions(RETRY_LIMIT);

    for (const synced of errored) {
      try {
        await this.retryFailedImports.execute({ synced });
      } catch (error) {
        this.logger.warn(`Retry failed for transaction ${synced.pluggyTransactionId}: ${(error as Error).message}`);
      }
    }
  }
}
