/**
 * Cross-cutting security & idempotency guarantees (FR-021, regra 7) exercised
 * across the three write modules — accounts, cards, categories — with in-memory
 * fakes. Two invariants are asserted for every module:
 *   1. A resource owned by another user is invisible → NotFound (surfaced as 404).
 *   2. Repeated writes are idempotent in effect (no duplication, no corruption).
 */
import { Account } from '../modules/accounts/domain/account';
import type { AccountRepository } from '../modules/accounts/domain/account.repository';
import { AccountNotFoundError } from '../modules/accounts/domain/errors';
import { UpdateAccountUseCase } from '../modules/accounts/application/use-cases/update-account/update-account.use-case';
import { DeleteAccountUseCase } from '../modules/accounts/application/use-cases/delete-account/delete-account.use-case';

import { CreditCard } from '../modules/cards/domain/credit-card';
import type { CreditCardRepository } from '../modules/cards/domain/credit-card.repository';
import { CreditCardNotFoundError } from '../modules/cards/domain/errors';
import { UpdateCardUseCase } from '../modules/cards/application/use-cases/update-card/update-card.use-case';
import { DeleteCardUseCase } from '../modules/cards/application/use-cases/delete-card/delete-card.use-case';

import { CategoryNotFoundError } from '../modules/categories/domain/errors';
import { UpdateCategoryUseCase } from '../modules/categories/application/use-cases/update-category/update-category.use-case';
import { DeleteCategoryUseCase } from '../modules/categories/application/use-cases/delete-category/delete-category.use-case';
import {
  InMemoryCategoryRepository,
  InMemoryHiddenCategoryRepository,
  InMemoryCategoryOverrideRepository,
  customCategory,
  systemCategory,
} from '../modules/categories/application/use-cases/__testing__/in-memory-repositories';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const MISSING = '99999999-9999-9999-9999-999999999999';

/** Owner-scoped in-memory fake mirroring the SQL WHERE user_id = :userId rule. */
class InMemoryAccountRepository implements AccountRepository {
  private items: Account[] = [];
  async create(a: Account): Promise<void> {
    this.items.push(a);
  }
  async save(a: Account): Promise<void> {
    this.items = this.items.map((i) => (i.id === a.id ? a : i));
  }
  async findById(id: string, userId: string): Promise<Account | null> {
    return this.items.find((i) => i.id === id && i.userId === userId) ?? null;
  }
  async findAllByUser(userId: string): Promise<Account[]> {
    return this.items.filter((i) => i.userId === userId);
  }
  async delete(id: string, userId: string): Promise<void> {
    this.items = this.items.filter((i) => !(i.id === id && i.userId === userId));
  }
}

class InMemoryCardRepository implements CreditCardRepository {
  private items: CreditCard[] = [];
  async create(c: CreditCard): Promise<void> {
    this.items.push(c);
  }
  async save(c: CreditCard): Promise<void> {
    this.items = this.items.map((i) => (i.id === c.id ? c : i));
  }
  async findById(id: string, userId: string): Promise<CreditCard | null> {
    return this.items.find((i) => i.id === id && i.userId === userId) ?? null;
  }
  async findAllByUser(userId: string): Promise<CreditCard[]> {
    return this.items.filter((i) => i.userId === userId);
  }
  async delete(id: string, userId: string): Promise<void> {
    this.items = this.items.filter((i) => !(i.id === id && i.userId === userId));
  }
}

describe('Cross-cutting: user isolation → 404 (FR-021)', () => {
  it('accounts: another user cannot update or delete', async () => {
    const repo = new InMemoryAccountRepository();
    const account = Account.create({
      id: crypto.randomUUID(),
      userId: USER_A,
      name: 'Conta',
      bankId: 'nubank',
      icon: 'utensils',
      color: 'primary',
    });
    await repo.create(account);

    await expect(
      new UpdateAccountUseCase(repo).execute(USER_B, account.id, { name: 'Hack' }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    await expect(
      new DeleteAccountUseCase(repo).execute(USER_B, account.id),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    // Owner's row is untouched.
    expect(await repo.findById(account.id, USER_A)).not.toBeNull();
  });

  it('cards: another user cannot update or delete', async () => {
    const repo = new InMemoryCardRepository();
    const card = CreditCard.create({
      id: crypto.randomUUID(),
      userId: USER_A,
      name: 'Nubank',
      lastDigits: '1234',
      dueDay: 10,
      closingDay: 3,
      limit: '5000.00',
      brandId: 'visa',
    });
    await repo.create(card);

    await expect(
      new UpdateCardUseCase(repo).execute(USER_B, card.id, { name: 'Hack' }),
    ).rejects.toBeInstanceOf(CreditCardNotFoundError);
    await expect(
      new DeleteCardUseCase(repo).execute(USER_B, card.id),
    ).rejects.toBeInstanceOf(CreditCardNotFoundError);
    expect(await repo.findById(card.id, USER_A)).not.toBeNull();
  });

  it("categories: another user cannot update or delete a user's custom node", async () => {
    const custom = customCategory({
      id: crypto.randomUUID(),
      ownerId: USER_A,
      name: 'Privado',
      type: 'expense',
    });
    const categories = new InMemoryCategoryRepository([custom]);
    const hidden = new InMemoryHiddenCategoryRepository();
    const overrides = new InMemoryCategoryOverrideRepository();

    await expect(
      new UpdateCategoryUseCase(categories, overrides).execute(USER_B, custom.id, {
        name: 'Hack',
      }),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
    await expect(
      new DeleteCategoryUseCase(categories, hidden).execute(USER_B, custom.id),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
    // Missing id is a 404 too.
    await expect(
      new DeleteCategoryUseCase(categories, hidden).execute(USER_A, MISSING),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});

describe('Cross-cutting: idempotent repeated writes (regra 7)', () => {
  it('accounts/cards: deleting another user’s resource repeatedly is a safe no-op', async () => {
    const accounts = new InMemoryAccountRepository();
    const account = Account.create({
      id: crypto.randomUUID(),
      userId: USER_A,
      name: 'Conta',
      bankId: 'nubank',
      icon: 'utensils',
      color: 'primary',
    });
    await accounts.create(account);
    await accounts.delete(account.id, USER_B);
    await accounts.delete(account.id, USER_B);
    expect(await accounts.findById(account.id, USER_A)).not.toBeNull();

    const cards = new InMemoryCardRepository();
    const card = CreditCard.create({
      id: crypto.randomUUID(),
      userId: USER_A,
      name: 'Nubank',
      lastDigits: '1234',
      dueDay: 10,
      closingDay: 3,
      limit: '5000.00',
      brandId: 'visa',
    });
    await cards.create(card);
    await cards.delete(card.id, USER_B);
    await cards.delete(card.id, USER_B);
    expect(await cards.findById(card.id, USER_A)).not.toBeNull();
  });

  it('categories: hiding a system default twice hides it exactly once', async () => {
    const system = systemCategory({
      id: crypto.randomUUID(),
      name: 'Alimentação',
      type: 'expense',
    });
    const categories = new InMemoryCategoryRepository([system]);
    const hidden = new InMemoryHiddenCategoryRepository();
    const del = new DeleteCategoryUseCase(categories, hidden);

    await del.execute(USER_A, system.id);
    await del.execute(USER_A, system.id);

    expect(await hidden.findHiddenIds(USER_A)).toEqual([system.id]);
    // The shared default row is never removed by a hide.
    expect(await categories.findAccessible(system.id, USER_A)).not.toBeNull();
  });

  it('categories: editing a system default twice keeps a single override row', async () => {
    const system = systemCategory({
      id: crypto.randomUUID(),
      name: 'Alimentação',
      type: 'expense',
    });
    const categories = new InMemoryCategoryRepository([system]);
    const overrides = new InMemoryCategoryOverrideRepository();
    const update = new UpdateCategoryUseCase(categories, overrides);

    await update.execute(USER_A, system.id, { name: 'Comida' });
    await update.execute(USER_A, system.id, { name: 'Rango' });

    const mine = await overrides.findByUser(USER_A);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.name).toBe('Rango');
    // Other users still see the untouched default (no override leaks).
    expect(await overrides.findOne(USER_B, system.id)).toBeNull();
  });
});
