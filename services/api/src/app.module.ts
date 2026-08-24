import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './common/auth.module';
import { HealthModule } from './modules/health/health.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CardsModule } from './modules/cards/cards.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AccountModule } from './modules/account/account.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      synchronize: false,
      autoLoadEntities: true,
      // Roda migrations pendentes no boot (Docker/prod). Idempotente: só aplica o que falta.
      migrations: [join(__dirname, 'database', 'migrations', '*.{js,ts}')],
      migrationsRun: true,
    }),
    AuthModule,
    HealthModule,
    AccountsModule,
    CategoriesModule,
    CardsModule,
    TransactionsModule,
    AccountModule,
  ],
})
export class AppModule {}
