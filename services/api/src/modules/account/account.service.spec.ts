import { DataSource, EntityManager } from 'typeorm';
import { AccountService } from './account.service';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { CreditCardEntity } from '../cards/entities/credit-card.entity';
import { AccountEntity } from '../accounts/entities/account.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { UserCategoryOverrideEntity } from '../categories/entities/user-category-override.entity';
import { UserHiddenCategoryEntity } from '../categories/entities/user-hidden-category.entity';
import { UserCategoryParentEntity } from '../categories/entities/user-category-parent.entity';

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
  version: 2 as const,
  exportedAt: new Date().toISOString(),
  accounts: [],
  creditCards: [],
  categories: [],
  transactions: [],
  categoryOverrides: [],
  hiddenCategories: [],
  categoryPlacements: [],
};

/** One captured `insert().into(E).values(v).orIgnore().execute()` chain. */
interface CapturedInsert {
  entity: unknown;
  values: unknown;
}

/** Fake EntityManager tracking delete + insert calls, for import mode tests. */
function setupImport() {
  const del = jest.fn(async () => ({ affected: 0, raw: [] }));
  const insert = jest.fn(async () => ({ identifiers: [], generatedMaps: [], raw: [] }));
  // The system-category customizations are restored via the query builder; capture each chain.
  const inserts: CapturedInsert[] = [];
  const qb: Record<string, unknown> = {};
  let pending: CapturedInsert = { entity: undefined, values: undefined };
  qb.insert = () => qb;
  qb.into = (entity: unknown) => {
    pending = { entity, values: undefined };
    return qb;
  };
  qb.values = (values: unknown) => {
    pending.values = values;
    return qb;
  };
  qb.orIgnore = () => qb;
  qb.execute = async () => {
    inserts.push(pending);
    return { raw: [] };
  };
  const manager = {
    delete: del,
    insert,
    createQueryBuilder: () => qb,
  } as unknown as EntityManager;
  const dataSource = {
    transaction: (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
  } as unknown as DataSource;
  return { service: new AccountService(dataSource), del, insert, inserts };
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
    expect(del).toHaveBeenCalledWith(UserCategoryParentEntity, { userId: USER });
    expect(del).toHaveBeenCalledWith(CategoryEntity, { ownerId: USER });
    expect(del).toHaveBeenCalledWith(CreditCardEntity, { userId: USER });
    expect(del).toHaveBeenCalledWith(AccountEntity, { userId: USER });
  });

  it('defaults to merge when no mode is given', async () => {
    const { service, del } = setupImport();

    await service.importData(USER, EMPTY_SNAPSHOT);

    expect(del).not.toHaveBeenCalled();
  });

  it('restores system-category customizations (overrides, hidden, placements)', async () => {
    const { service, inserts } = setupImport();
    const SYS = '11111111-1111-4111-8111-111111111111';
    const SYS2 = '22222222-2222-4222-8222-222222222222';

    await service.importData(
      USER,
      {
        ...EMPTY_SNAPSHOT,
        categoryOverrides: [{ categoryId: SYS, name: 'Comida', icon: 'utensils', color: 'red' }],
        hiddenCategories: [SYS2],
        categoryPlacements: [{ categoryId: SYS, parentId: null }],
      },
      'merge',
    );

    const overrides = inserts.find((i) => i.entity === UserCategoryOverrideEntity);
    const hidden = inserts.find((i) => i.entity === UserHiddenCategoryEntity);
    const placements = inserts.find((i) => i.entity === UserCategoryParentEntity);

    // categoryId is a stable system-default id, kept verbatim (never remapped).
    expect(overrides?.values).toEqual([
      { userId: USER, categoryId: SYS, name: 'Comida', icon: 'utensils', color: 'red' },
    ]);
    expect(hidden?.values).toEqual([{ userId: USER, categoryId: SYS2 }]);
    expect(placements?.values).toEqual([{ userId: USER, categoryId: SYS, parentId: null }]);
  });

  it('remaps a placement parentId that points at a custom category from the snapshot', async () => {
    const { service, inserts } = setupImport();
    const SYS = '11111111-1111-4111-8111-111111111111';
    const CUSTOM = '33333333-3333-4333-8333-333333333333';

    await service.importData(
      USER,
      {
        ...EMPTY_SNAPSHOT,
        categories: [
          { id: CUSTOM, parentId: null, name: 'Meus', type: 'expense', icon: 'folder', color: 'blue' },
        ],
        // A system default reparented under the custom category above.
        categoryPlacements: [{ categoryId: SYS, parentId: CUSTOM }],
      },
      'merge',
    );

    const placements = inserts.find((i) => i.entity === UserCategoryParentEntity);
    const value = (placements?.values as Array<{ parentId: string }>)[0];
    // parentId must be the custom category's NEW id, not the stale snapshot id.
    expect(value?.parentId).not.toBe(CUSTOM);
    expect(typeof value?.parentId).toBe('string');
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
