import { Inject, Injectable } from '@nestjs/common';
import type { CreditCard } from '../../../domain/credit-card';
import {
  CREDIT_CARD_REPOSITORY,
  type CreditCardRepository,
} from '../../../domain/credit-card.repository';

@Injectable()
export class ListCardsUseCase {
  constructor(
    @Inject(CREDIT_CARD_REPOSITORY) private readonly cards: CreditCardRepository,
  ) {}

  execute(userId: string): Promise<CreditCard[]> {
    return this.cards.findAllByUser(userId);
  }
}
