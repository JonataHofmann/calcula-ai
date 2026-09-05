import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../common/auth.module';
import { ServiceAccountGuard } from '../../common/guards/service-account.guard';
import { AccountEntity } from '../accounts/entities/account.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { CreditCardEntity } from '../cards/entities/credit-card.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { ProjectionEstimateEntity } from './entities/projection-estimate.entity';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionEntity,
      ProjectionEstimateEntity,
      CategoryEntity,
      AccountEntity,
      CreditCardEntity,
    ]),
    AuthModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, ServiceAccountGuard],
})
export class TransactionsModule {}
