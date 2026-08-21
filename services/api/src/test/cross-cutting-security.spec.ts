/**
 * Cross-cutting security & idempotency guarantees (FR-021, regra 7) exercised
 * across the three write modules — accounts, cards, categories — with in-memory
 * fakes. Two invariants are asserted for every module:
 *   1. A resource owned by another user is invisible → NotFound (surfaced as 404).
 *   2. Repeated writes are idempotent in effect (no duplication, no corruption).
 */
import type { Repository } from 'typeorm';
import { AccountsService } from '../modules/accounts/accounts.service';
import { AccountEntity } from '../modules/accounts/entities/account.entity';
import { AccountNotFoundError } from '../modules/accounts/accounts.types';

import { CardsService } from '../modules/cards/cards.service';
import { CreditCardEntity } from '../modules/cards/entities/credit-card.entity';
import { CreditCardNotFoundError } from '../modules/cards/cards.types';

import { CategoriesService } from '../modules/categories/categories.service';
import { CategoryNotFoundError } from '../modules/categories/categories.types';
import {
  makeFakeCategoryRepo,
  makeFakeHiddenRepo,
  makeFakeOverrideRepo,
  customCategory,
  systemCategory,
} from '../modules/categories/__testing__/in-memory-repositories';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const MISSING = '99999999-9999-9999-9999-999999999999';

/** Owner-scoped in-memory fake of the TypeORM repo, mirroring WHERE user_id = :userId. */
function makeFakeAccountRepo(): Repository<AccountEntity> {
  const store = new Map<string, AccountEntity>();
  const fake = {
    create: (data: Partial<AccountEntity>) => Object.assign(new AccountEntity(), data),
    insert: async (e: AccountEntity) => void store.set(e.id, { ...e } as AccountEntity),
    save: async (e: AccountEntity) => (store.set(e.id, { ...e } as AccountEntity), e),
    find: async (o: { where: { userId: string } }) =>
      [...store.values()].filter((a) => a.userId === o.where.userId),
    findOne: async (o: { where: { id: string; userId: string } }) => {
      const r = store.get(o.where.id);
      return r && r.userId === o.where.userId ? r : null;
    },
    delete: async (c: { id: string; userId: string }) => {
      const r = store.get(c.id);
      if (r && r.userId === c.userId) store.delete(c.id);
    },
  };
  return fake as unknown as Repository<AccountEntity>;
}

const ACCOUNT_INPUT = { name: 'Conta', bankId: 'nubank', icon: 'utensils', color: 'primary' };
const CARD_INPUT = {
  name: 'Nubank',
  lastDigits: '1234',
  dueDay: 10,
  closingDay: 3,
  limit: '5000.00',
  brandId: 'visa',
};

/** Owner-scoped in-memory fake of the TypeORM repo, mirroring WHERE user_id = :userId. */
function makeFakeCardRepo(): Repository<CreditCardEntity> {
  const store = new Map<string, CreditCardEntity>();
  const fake = {
    create: (data: Partial<CreditCardEntity>) => Object.assign(new CreditCardEntity(), data),
    insert: async (e: CreditCardEntity) => void store.set(e.id, { ...e } as CreditCardEntity),
    save: async (e: CreditCardEntity) => (store.set(e.id, { ...e } as CreditCardEntity), e),
    find: async (o: { where: { userId: string } }) =>
      [...store.values()].filter((c) => c.userId === o.where.userId),
    findOne: async (o: { where: { id: string; userId: string } }) => {
      const r = store.get(o.where.id);
      return r && r.userId === o.where.userId ? r : null;
    },
    delete: async (c: { id: string; userId: string }) => {
      const r = store.get(c.id);
      if (r && r.userId === c.userId) store.delete(c.id);
    },
  };
  return fake as unknown as Repository<CreditCardEntity>;
}

describe('Cross-cutting: user isolation → 404 (FR-021)', () => {
  it('accounts: another user cannot update or delete', async () => {
    const service = new AccountsService(makeFakeAccountRepo());
    const account = await service.create(USER_A, ACCOUNT_INPUT);

    await expect(
      service.update(USER_B, account.id, { name: 'Hack' }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    await expect(service.delete(USER_B, account.id)).rejects.toBeInstanceOf(AccountNotFoundError);
    // Owner's row is untouched.
    expect((await service.list(USER_A)).find((a) => a.id === account.id)).toBeDefined();
  });

  it('cards: another user cannot update or delete', async () => {
    const service = new CardsService(makeFakeCardRepo());
    const card = await service.create(USER_A, CARD_INPUT);

    await expect(
      service.update(USER_B, card.id, { name: 'Hack' }),
    ).rejects.toBeInstanceOf(CreditCardNotFoundError);
    await expect(service.delete(USER_B, card.id)).rejects.toBeInstanceOf(CreditCardNotFoundError);
    expect((await service.list(USER_A)).find((c) => c.id === card.id)).toBeDefined();
  });

  it("categories: another user cannot update or delete a user's custom node", async () => {
    const custom = customCategory({
      id: crypto.randomUUID(),
      ownerId: USER_A,
      name: 'Privado',
      type: 'expense',
    });
    const service = new CategoriesService(
      makeFakeCategoryRepo([custom]),
      makeFakeHiddenRepo(),
      makeFakeOverrideRepo(),
    );

    await expect(
      service.update(USER_B, custom.id, { name: 'Hack' }),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
    await expect(service.delete(USER_B, custom.id)).rejects.toBeInstanceOf(CategoryNotFoundError);
    // Missing id is a 404 too.
    await expect(service.delete(USER_A, MISSING)).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});

describe('Cross-cutting: idempotent repeated writes (regra 7)', () => {
  it('accounts/cards: deleting another user’s resource repeatedly is a safe no-op', async () => {
    const accounts = new AccountsService(makeFakeAccountRepo());
    const account = await accounts.create(USER_A, ACCOUNT_INPUT);
    // At the HTTP boundary a cross-user delete is a 404 each time; the owner's row stays intact.
    await expect(accounts.delete(USER_B, account.id)).rejects.toBeInstanceOf(AccountNotFoundError);
    await expect(accounts.delete(USER_B, account.id)).rejects.toBeInstanceOf(AccountNotFoundError);
    expect((await accounts.list(USER_A)).find((a) => a.id === account.id)).toBeDefined();

    const cards = new CardsService(makeFakeCardRepo());
    const card = await cards.create(USER_A, CARD_INPUT);
    await expect(cards.delete(USER_B, card.id)).rejects.toBeInstanceOf(CreditCardNotFoundError);
    await expect(cards.delete(USER_B, card.id)).rejects.toBeInstanceOf(CreditCardNotFoundError);
    expect((await cards.list(USER_A)).find((c) => c.id === card.id)).toBeDefined();
  });

  it('categories: hiding a system default twice hides it exactly once', async () => {
    const system = systemCategory({
      id: crypto.randomUUID(),
      name: 'Alimentação',
      type: 'expense',
    });
    const categoryRepo = makeFakeCategoryRepo([system]);
    const hiddenRepo = makeFakeHiddenRepo();
    const service = new CategoriesService(categoryRepo, hiddenRepo, makeFakeOverrideRepo());

    await service.delete(USER_A, system.id);
    await service.delete(USER_A, system.id);

    expect((await hiddenRepo.find({ where: { userId: USER_A } })).map((h) => h.categoryId)).toEqual([
      system.id,
    ]);
    // The shared default row is never removed by a hide.
    expect(await categoryRepo.findOne({ where: { id: system.id } })).not.toBeNull();
  });

  it('categories: editing a system default twice keeps a single override row', async () => {
    const system = systemCategory({
      id: crypto.randomUUID(),
      name: 'Alimentação',
      type: 'expense',
    });
    const overrideRepo = makeFakeOverrideRepo();
    const service = new CategoriesService(
      makeFakeCategoryRepo([system]),
      makeFakeHiddenRepo(),
      overrideRepo,
    );

    await service.update(USER_A, system.id, { name: 'Comida' });
    await service.update(USER_A, system.id, { name: 'Rango' });

    const mine = await overrideRepo.find({ where: { userId: USER_A } });
    expect(mine).toHaveLength(1);
    expect(mine[0]?.name).toBe('Rango');
    // Other users still see the untouched default (no override leaks).
    expect(await overrideRepo.findOne({ where: { userId: USER_B, categoryId: system.id } })).toBeNull();
  });
});
