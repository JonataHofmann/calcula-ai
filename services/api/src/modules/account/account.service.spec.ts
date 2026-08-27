import { DataSource, EntityManager } from 'typeorm';
import { AccountService } from './account.service';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { CreditCardEntity } from '../cards/entities/credit-card.entity';
import { AccountEntity } from '../accounts/entities/account.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { UserCategoryOverrideEntity } from '../categories/entities/user-category-override.entity';
import { UserHiddenCategoryEntity } from '../categories/entities/user-hidden-category.entity';

const USER = 'user-1';

/** Fake EntityManager whose delete returns a fixed affected count per entity. */
function setup(affected: Map<unknown, number>) {
  const del = jest.fn(async (entity: unknown) => ({
    affected: affected.get(entity) ?? 0,
    raw: [],
  }));
  const manager = { delete: del } as unknown as EntityManager;
  const dataSource = {
    transaction: (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
  } as unknown as DataSource;
  const service = new AccountService(dataSource);
  return { service, del };
}

const EMPTY_SNAPSHOT = {
  version: 1 as const,
  exportedAt: new Date().toISOString(),
  accounts: [],
  creditCards: [],
  categories: [],
  transactions: [],
};

/** Fake EntityManager tracking delete + insert calls, for import mode tests. */
function setupImport() {
  const del = jest.fn(async () => ({ affected: 0, raw: [] }));
  const insert = jest.fn(async () => ({ identifiers: [], generatedMaps: [], raw: [] }));
  const manager = { delete: del, insert } as unknown as EntityManager;
  const dataSource = {
    transaction: (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
  } as unknown as DataSource;
  return { service: new AccountService(dataSource), del, insert };
}

describe('AccountService.importData', () => {
  it('merge mode never deletes existing data', async () => {
    const { service, del } = setupImport();

    await service.importData(USER, EMPTY_SNAPSHOT, 'merge');

    expect(del).not.toHaveBeenCalled();
  });

  it('replace mode wipes every user-scoped table before importing', async () => {
    const { service, del } = setupImport();

    await service.importData(USER, EMPTY_SNAPSHOT, 'replace');

    expect(del).toHaveBeenCalledWith(TransactionEntity, { userId: USER });
    expect(del).toHaveBeenCalledWith(UserCategoryOverrideEntity, { userId: USER });
    expect(del).toHaveBeenCalledWith(UserHiddenCategoryEntity, { userId: USER });
    expect(del).toHaveBeenCalledWith(CategoryEntity, { ownerId: USER });
    expect(del).toHaveBeenCalledWith(CreditCardEntity, { userId: USER });
    expect(del).toHaveBeenCalledWith(AccountEntity, { userId: USER });
  });

  it('defaults to merge when no mode is given', async () => {
    const { service, del } = setupImport();

    await service.importData(USER, EMPTY_SNAPSHOT);

    expect(del).not.toHaveBeenCalled();
  });
});

describe('AccountService.resetData', () => {
  it('deletes every user-scoped table and returns the counts', async () => {
    const { service, del } = setup(
      new Map<unknown, number>([
        [TransactionEntity, 5],
        [AccountEntity, 2],
        [CreditCardEntity, 1],
        [CategoryEntity, 3],
        [UserCategoryOverrideEntity, 4],
        [UserHiddenCategoryEntity, 6],
      ]),
    );

    const result = await service.resetData(USER);

    expect(result).toEqual({
      transactions: 5,
      accounts: 2,
      creditCards: 1,
      categories: 3,
      categoryOverrides: 4,
      hiddenCategories: 6,
    });

    // Transactions/cards/accounts/overrides/hidden scoped by userId; categories by ownerId.
    expect(del).toHaveBeenCalledWith(TransactionEntity, { userId: USER });
    expect(del).toHaveBeenCalledWith(AccountEntity, { userId: USER });
    expect(del).toHaveBeenCalledWith(CreditCardEntity, { userId: USER });
    expect(del).toHaveBeenCalledWith(UserCategoryOverrideEntity, { userId: USER });
    expect(del).toHaveBeenCalledWith(UserHiddenCategoryEntity, { userId: USER });
    expect(del).toHaveBeenCalledWith(CategoryEntity, { ownerId: USER });
  });

  it('never deletes system categories (matches ownerId, not a null scope)', async () => {
    const { service, del } = setup(new Map());

    await service.resetData(USER);

    const categoryCall = del.mock.calls.find((c) => c[0] === CategoryEntity);
    expect(categoryCall?.[1]).toEqual({ ownerId: USER });
    // No call ever deletes categories by a bare/system scope.
    expect(del).not.toHaveBeenCalledWith(CategoryEntity, {});
  });

  it('treats a null affected count as zero', async () => {
    const del = jest.fn(async () => ({ affected: null, raw: [] }));
    const manager = { delete: del } as unknown as EntityManager;
    const dataSource = {
      transaction: (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
    } as unknown as DataSource;
    const service = new AccountService(dataSource);

    const result = await service.resetData(USER);

    expect(result).toEqual({
      transactions: 0,
      accounts: 0,
      creditCards: 0,
      categories: 0,
      categoryOverrides: 0,
      hiddenCategories: 0,
    });
  });
});
