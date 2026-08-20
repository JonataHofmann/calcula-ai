import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../common/auth/auth.module';
import { ServiceAccountGuard } from '../../common/auth/service-account.guard';
import { ACCOUNT_REPOSITORY } from './domain/account.repository';
import { AccountEntity } from './infrastructure/persistence/entities/account.entity';
import { TypeOrmAccountRepository } from './infrastructure/persistence/repositories/account.repository';
import { CreateAccountUseCase } from './application/use-cases/create-account/create-account.use-case';
import { ListAccountsUseCase } from './application/use-cases/list-accounts/list-accounts.use-case';
import { UpdateAccountUseCase } from './application/use-cases/update-account/update-account.use-case';
import { DeleteAccountUseCase } from './application/use-cases/delete-account/delete-account.use-case';
import { AccountsController } from './presentation/accounts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccountEntity]), AuthModule],
  controllers: [AccountsController],
  providers: [
    { provide: ACCOUNT_REPOSITORY, useClass: TypeOrmAccountRepository },
    CreateAccountUseCase,
    ListAccountsUseCase,
    UpdateAccountUseCase,
    DeleteAccountUseCase,
    ServiceAccountGuard,
  ],
})
export class AccountsModule {}
