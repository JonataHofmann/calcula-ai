import { Inject, Injectable } from '@nestjs/common';
import type { UpdateCreditCardInput } from '@finance/contracts';
import type { CreditCard } from '../../../domain/credit-card';
import {
  CREDIT_CARD_REPOSITORY,
  type CreditCardRepository,
} from '../../../domain/credit-card.repository';
import { CreditCardNotFoundError } from '../../../domain/errors';

@Injectable()
export class UpdateCardUseCase {
  constructor(
    @Inject(CREDIT_CARD_REPOSITORY) private readonly cards: CreditCardRepository,
  ) {}

  async execute(userId: string, id: string, input: UpdateCreditCardInput): Promise<CreditCard> {
    const card = await this.cards.findById(id, userId);
    if (!card) throw new CreditCardNotFoundError(id);
    card.update(input);
    await this.cards.save(card);
    return card;
  }
}
