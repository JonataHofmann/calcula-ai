import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CREDIT_CARD_REPOSITORY } from './domain/credit-card.repository';
import { CreditCardEntity } from './infrastructure/persistence/entities/credit-card.entity';
import { TypeOrmCreditCardRepository } from './infrastructure/persistence/repositories/credit-card.repository';
import { CreateCardUseCase } from './application/use-cases/create-card/create-card.use-case';
import { ListCardsUseCase } from './application/use-cases/list-cards/list-cards.use-case';
import { UpdateCardUseCase } from './application/use-cases/update-card/update-card.use-case';
import { DeleteCardUseCase } from './application/use-cases/delete-card/delete-card.use-case';
import { CardsController } from './presentation/cards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CreditCardEntity])],
  controllers: [CardsController],
  providers: [
    { provide: CREDIT_CARD_REPOSITORY, useClass: TypeOrmCreditCardRepository },
    CreateCardUseCase,
    ListCardsUseCase,
    UpdateCardUseCase,
    DeleteCardUseCase,
  ],
})
export class CardsModule {}
