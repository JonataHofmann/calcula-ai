import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from '../accounts/infrastructure/persistence/entities/account.entity';
import { CategoryEntity } from '../categories/infrastructure/persistence/entities/category.entity';
import { CreditCardEntity } from '../cards/infrastructure/persistence/entities/credit-card.entity';
import { TRANSACTION_REPOSITORY } from './domain/transaction.repository';
import { ACCOUNT_LOOKUP, CARD_LOOKUP, CATEGORY_LOOKUP } from './domain/lookups';
import { TransactionEntity } from './infrastructure/persistence/entities/transaction.entity';
import { TypeOrmTransactionRepository } from './infrastructure/persistence/repositories/transaction.repository';
import { TypeOrmCategoryLookup } from './infrastructure/persistence/lookups/category.lookup';
import { TypeOrmAccountLookup } from './infrastructure/persistence/lookups/account.lookup';
import { TypeOrmCardLookup } from './infrastructure/persistence/lookups/card.lookup';
import { CreateTransactionUseCase } from './application/use-cases/create-transaction/create-transaction';
import { ListTransactionsUseCase } from './application/use-cases/list-transactions/list-transactions';
import { GetTransactionUseCase } from './application/use-cases/get-transaction/get-transaction';
import { UpdateTransactionUseCase } from './application/use-cases/update-transaction/update-transaction';
import { DeleteTransactionUseCase } from './application/use-cases/delete-transaction/delete-transaction';
import { EffectuateTransactionUseCase } from './application/use-cases/effectuate-transaction/effectuate-transaction';
import { ListOverdueUseCase } from './application/use-cases/list-overdue/list-overdue';
import { GetForecastUseCase } from './application/use-cases/get-forecast/get-forecast';
import { TransactionsController } from './presentation/transactions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionEntity,
      CategoryEntity,
      AccountEntity,
      CreditCardEntity,
    ]),
  ],
  controllers: [TransactionsController],
  providers: [
    { provide: TRANSACTION_REPOSITORY, useClass: TypeOrmTransactionRepository },
    { provide: CATEGORY_LOOKUP, useClass: TypeOrmCategoryLookup },
    { provide: ACCOUNT_LOOKUP, useClass: TypeOrmAccountLookup },
    { provide: CARD_LOOKUP, useClass: TypeOrmCardLookup },
    CreateTransactionUseCase,
    ListTransactionsUseCase,
    GetTransactionUseCase,
    UpdateTransactionUseCase,
    DeleteTransactionUseCase,
    EffectuateTransactionUseCase,
    ListOverdueUseCase,
    GetForecastUseCase,
  ],
})
export class TransactionsModule {}
