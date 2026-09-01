import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../common/auth.module';
import { ServiceAccountGuard } from '../../common/guards/service-account.guard';
import { CreditCardEntity } from './entities/credit-card.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  imports: [TypeOrmModule.forFeature([CreditCardEntity, TransactionEntity]), AuthModule],
  controllers: [CardsController],
  providers: [CardsService, ServiceAccountGuard],
})
export class CardsModule {}
