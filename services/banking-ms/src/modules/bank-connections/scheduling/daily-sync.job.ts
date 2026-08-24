import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runWithRequestContext } from '@finance/observability';
import { BankConnectionsService } from '../bank-connections.service';

@Injectable()
export class DailySyncJob {
  private readonly logger = new Logger(DailySyncJob.name);

  constructor(private readonly service: BankConnectionsService) {}

  // Fresh correlationId per run so job logs + downstream api calls share one trace.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    await runWithRequestContext({}, async () => {
      this.logger.log('Daily stale-connection sync started');
      await this.service.syncStaleConnections();
    });
  }
}
