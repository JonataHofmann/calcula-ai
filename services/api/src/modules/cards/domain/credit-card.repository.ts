import type { CreditCard } from './credit-card';

export const CREDIT_CARD_REPOSITORY = Symbol('CREDIT_CARD_REPOSITORY');

/** Persistence port. Every method is scoped by userId so cross-user rows are invisible. */
export interface CreditCardRepository {
  create(card: CreditCard): Promise<void>;
  save(card: CreditCard): Promise<void>;
  findById(id: string, userId: string): Promise<CreditCard | null>;
  findAllByUser(userId: string): Promise<CreditCard[]>;
  delete(id: string, userId: string): Promise<void>;
}
