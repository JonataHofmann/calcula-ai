import type { Account } from './account';

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

/** Persistence port. Every method is scoped by userId so cross-user rows are invisible. */
export interface AccountRepository {
  create(account: Account): Promise<void>;
  save(account: Account): Promise<void>;
  findById(id: string, userId: string): Promise<Account | null>;
  findAllByUser(userId: string): Promise<Account[]>;
  delete(id: string, userId: string): Promise<void>;
}
