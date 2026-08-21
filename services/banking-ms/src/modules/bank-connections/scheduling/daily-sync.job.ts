import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BankConnectionsService } from '../bank-connections.service';

@Injectable()
export class DailySyncJob {
  private readonly logger = new Logger(DailySyncJob.name);

  constructor(private readonly service: BankConnectionsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    this.logger.log('Daily stale-connection sync started');
    await this.service.syncStaleConnections();
  }
}
