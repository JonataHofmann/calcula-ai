import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CreateCreditCardInput } from '@finance/contracts';
import { CreditCard } from '../../../domain/credit-card';
import {
  CREDIT_CARD_REPOSITORY,
  type CreditCardRepository,
} from '../../../domain/credit-card.repository';

@Injectable()
export class CreateCardUseCase {
  constructor(
    @Inject(CREDIT_CARD_REPOSITORY) private readonly cards: CreditCardRepository,
  ) {}

  async execute(userId: string, input: CreateCreditCardInput): Promise<CreditCard> {
    const card = CreditCard.create({
      id: randomUUID(),
      userId,
      name: input.name,
      lastDigits: input.lastDigits,
      dueDay: input.dueDay,
      closingDay: input.closingDay,
      limit: input.limit,
      brandId: input.brandId,
    });
    await this.cards.create(card);
    return card;
  }
}
