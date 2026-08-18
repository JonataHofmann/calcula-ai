import { Inject, Injectable } from '@nestjs/common';
import {
  CREDIT_CARD_REPOSITORY,
  type CreditCardRepository,
} from '../../../domain/credit-card.repository';
import { CreditCardNotFoundError } from '../../../domain/errors';

@Injectable()
export class DeleteCardUseCase {
  constructor(
    @Inject(CREDIT_CARD_REPOSITORY) private readonly cards: CreditCardRepository,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const card = await this.cards.findById(id, userId);
    if (!card) throw new CreditCardNotFoundError(id);
    await this.cards.delete(id, userId);
  }
}
