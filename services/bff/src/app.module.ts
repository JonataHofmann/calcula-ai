import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { SessionEntity } from './database/session.entity';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './common/common.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CardsModule } from './modules/cards/cards.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { BankConnectionsModule } from './modules/bank-connections/bank-connections.module';
import { SyncedTransactionsModule } from './modules/synced-transactions/synced-transactions.module';
import { InvoiceImportModule } from './modules/invoice-import/invoice-import.module';
import { AccountModule } from './modules/account/account.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      schema: 'bff',
      entities: [SessionEntity],
      synchronize: false,
      autoLoadEntities: true,
      // Roda migrations pendentes no boot (Docker/prod). Idempotente: só aplica o que falta.
      migrations: [join(__dirname, 'database', 'migrations', '*.{js,ts}')],
      migrationsRun: true,
    }),
    AuthModule,
    HealthModule,
    CommonModule,
    ReferenceModule,
    AccountsModule,
    CategoriesModule,
    CardsModule,
    TransactionsModule,
    BankConnectionsModule,
    SyncedTransactionsModule,
    InvoiceImportModule,
    AccountModule,
  ],
})
export class AppModule {}
