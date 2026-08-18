import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { SessionEntity } from './auth/session/session.entity';
import { HealthModule } from './health/health.module';
import { SharedModule } from './shared/shared.module';
import { ReferenceModule } from './reference/reference.module';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { CardsModule } from './cards/cards.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [SessionEntity],
      synchronize: false,
      autoLoadEntities: true,
    }),
    AuthModule,
    HealthModule,
    SharedModule,
    ReferenceModule,
    AccountsModule,
    CategoriesModule,
    CardsModule,
    TransactionsModule,
  ],
})
export class AppModule {}
