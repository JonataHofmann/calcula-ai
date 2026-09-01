import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../common/auth.module';
import { ServiceAccountGuard } from '../../common/guards/service-account.guard';
import { AccountEntity } from './entities/account.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccountEntity, TransactionEntity]), AuthModule],
  controllers: [AccountsController],
  providers: [AccountsService, ServiceAccountGuard],
})
export class AccountsModule {}
