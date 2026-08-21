import { Module } from '@nestjs/common';
import { SyncedTransactionsController } from './synced-transactions.controller';
import { SyncedTransactionsService } from './synced-transactions.service';

@Module({
  controllers: [SyncedTransactionsController],
  providers: [SyncedTransactionsService],
})
export class SyncedTransactionsModule {}
