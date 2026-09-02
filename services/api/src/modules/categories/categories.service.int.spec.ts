import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CategoriesService } from './categories.service';
import { CategoryEntity } from './entities/category.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { UserHiddenCategoryEntity } from './entities/user-hidden-category.entity';
import { UserCategoryOverrideEntity } from './entities/user-category-override.entity';
import { UserCategoryParentEntity } from './entities/user-category-parent.entity';
import { CategoryNotFoundError } from './categories.types';

/**
 * Integration test against a real Postgres — self-referencing FK, composite
 * primary keys and the idempotent hide/override upserts only exercise against
 * the real driver. Gated behind TEST_DATABASE_URL so `pnpm test` stays green
 * without a database. Exercises CategoriesService directly (the custom
 * repositories were removed, FR-009a).
 */
const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const SYSTEM_ID = '00000000-0000-4000-a000-000000000001';

const ENTITIES = [
  CategoryEntity,
  TransactionEntity,
  UserHiddenCategoryEntity,
  UserCategoryOverrideEntity,
  UserCategoryParentEntity,
];

maybe('CategoriesService (integration)', () => {
  let dataSource: DataSource;
  let service: CategoriesService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url,
      entities: ENTITIES,
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    service = new CategoriesService(
      dataSource.getRepository(CategoryEntity),
      dataSource.getRepository(UserHiddenCategoryEntity),
      dataSource.getRepository(UserCategoryOverrideEntity),
      dataSource.getRepository(UserCategoryParentEntity),
      dataSource.getRepository(TransactionEntity),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(TransactionEntity).clear();
    await dataSource.getRepository(UserHiddenCategoryEntity).clear();
    await dataSource.getRepository(UserCategoryOverrideEntity).clear();
    await dataSource.getRepository(UserCategoryParentEntity).clear();
    await dataSource.getRepository(CategoryEntity).clear();
  });

  /** Seed a transaction under a category, on an account (origin CHECK needs exactly one). */
  async function seedTx(userId: string, categoryId: string): Promise<void> {
    const repo = dataSource.getRepository(TransactionEntity);
    const now = new Date();
    await repo.insert(
      repo.create({
        id: randomUUID(),
        description: 'lançamento',
        dueDate: now,
        purchaseDate: null,
        amount: '10.00',
        recurrence: 'single',
        type: 'expense',
        status: 'pending',
        categoryId,
        accountId: randomUUID(),
        creditCardId: null,
        userId,
      }),
    );
  }

  /** Seed a shared system default straight through the repo (the service only ever creates custom rows). */
  async function seedSystem(): Promise<void> {
    const now = new Date();
    await dataSource.getRepository(CategoryEntity).insert({
      id: SYSTEM_ID,
      ownerId: null,
      parentId: null,
      name: 'Alimentação',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  it('round-trips a self-referencing root + subcategory', async () => {
    const root = await service.create(USER_A, {
      name: 'Mercado',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
    });
    const sub = await service.addSubcategory(USER_A, root.id, {
      name: 'Feira',
      icon: 'utensils',
      color: 'primary',
    });

    const tree = await service.list(USER_A);
    const persistedRoot = tree.expense.find((n) => n.id === root.id);
    expect(persistedRoot?.children.map((c) => c.id)).toEqual([sub.id]);
    expect(persistedRoot?.children[0]?.type).toBe('expense');
  });

  it('deletes a custom node with its descendants', async () => {
    const root = await service.create(USER_A, {
      name: 'Mercado',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
    });
    await service.addSubcategory(USER_A, root.id, {
      name: 'Feira',
      icon: 'utensils',
      color: 'primary',
    });

    await service.delete(USER_A, root.id);
    const tree = await service.list(USER_A);
    expect(tree.expense).toHaveLength(0);
  });

  it('counts and cascades transactions across the whole subtree', async () => {
    const root = await service.create(USER_A, {
      name: 'Mercado',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
    });
    const sub = await service.addSubcategory(USER_A, root.id, {
      name: 'Feira',
      icon: 'utensils',
      color: 'primary',
    });
    const other = await service.create(USER_A, {
      name: 'Transporte',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
    });
    await seedTx(USER_A, root.id);
    await seedTx(USER_A, sub.id); // descendant — must be included
    await seedTx(USER_A, other.id); // unrelated — must be untouched
    await seedTx(USER_B, root.id); // other user — never counted

    expect(await service.countTransactions(USER_A, root.id)).toBe(2);

    const txRepo = dataSource.getRepository(TransactionEntity);
    await service.delete(USER_A, root.id, true);
    expect(await txRepo.count({ where: { userId: USER_A } })).toBe(1); // only `other` remains
    expect(await txRepo.count({ where: { categoryId: other.id } })).toBe(1);
  });

  it('keeps subtree transactions when the flag is not set', async () => {
    const root = await service.create(USER_A, {
      name: 'Mercado',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
    });
    await seedTx(USER_A, root.id);
    const txRepo = dataSource.getRepository(TransactionEntity);
    await service.delete(USER_A, root.id);
    expect(await txRepo.count({ where: { categoryId: root.id } })).toBe(1);
  });

  it("does not delete another user's tree", async () => {
    const root = await service.create(USER_A, {
      name: 'Mercado',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
    });
    await expect(service.delete(USER_B, root.id)).rejects.toBeInstanceOf(CategoryNotFoundError);
    expect((await service.list(USER_A)).expense.some((n) => n.id === root.id)).toBe(true);
  });

  it('exposes system defaults, never another user’s custom node', async () => {
    await seedSystem();
    const bRoot = await service.create(USER_B, {
      name: 'Privado',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
    });

    // USER_A sees the shared default and can act on it, but not USER_B's custom node.
    expect((await service.list(USER_A)).expense.some((n) => n.id === SYSTEM_ID)).toBe(true);
    await expect(service.update(USER_A, bRoot.id, { name: 'x' })).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });

  it('hides a system default idempotently and restores it', async () => {
    await seedSystem();
    await service.delete(USER_A, SYSTEM_ID);
    await service.delete(USER_A, SYSTEM_ID);
    expect((await service.list(USER_A)).expense.some((n) => n.id === SYSTEM_ID)).toBe(false);

    await service.restore(USER_A, SYSTEM_ID);
    expect((await service.list(USER_A)).expense.some((n) => n.id === SYSTEM_ID)).toBe(true);
  });

  it('upserts an override replacing prior values, scoped per user, revert idempotent', async () => {
    await seedSystem();
    await service.update(USER_A, SYSTEM_ID, { name: 'Comida', color: 'primary' });
    await service.update(USER_A, SYSTEM_ID, { name: 'Rango', color: 'accent' });

    const aFood = (await service.list(USER_A)).expense.find((n) => n.id === SYSTEM_ID);
    expect(aFood?.name).toBe('Rango');
    expect(aFood?.color).toBe('accent');
    expect(aFood?.source).toBe('default-overridden');
    // USER_B still sees the untouched default (no override leaks).
    const bFood = (await service.list(USER_B)).expense.find((n) => n.id === SYSTEM_ID);
    expect(bFood?.name).toBe('Alimentação');
    expect(bFood?.source).toBe('default');

    await service.revert(USER_A, SYSTEM_ID);
    await service.revert(USER_A, SYSTEM_ID);
    const reverted = (await service.list(USER_A)).expense.find((n) => n.id === SYSTEM_ID);
    expect(reverted?.name).toBe('Alimentação');
    expect(reverted?.source).toBe('default');
  });

  it('reparents a custom category and persists it', async () => {
    const target = await service.create(USER_A, {
      name: 'Mercado',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
    });
    const moved = await service.create(USER_A, {
      name: 'Feira',
      type: 'expense',
      icon: 'utensils',
      color: 'accent',
    });

    await service.move(USER_A, moved.id, target.id);
    const nested = (await service.list(USER_A)).expense.find((n) => n.id === target.id);
    expect(nested?.children.map((c) => c.id)).toEqual([moved.id]);

    await service.move(USER_A, moved.id, null);
    expect((await service.list(USER_A)).expense.some((n) => n.id === moved.id)).toBe(true);
  });

  it('reparents a system default per-user via a placement, isolated between users', async () => {
    await seedSystem();
    const target = await service.create(USER_A, {
      name: 'Extras',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
    });

    await service.move(USER_A, SYSTEM_ID, target.id);

    const aTree = await service.list(USER_A);
    expect(aTree.expense.some((n) => n.id === SYSTEM_ID)).toBe(false);
    expect(
      aTree.expense.find((n) => n.id === target.id)?.children.some((c) => c.id === SYSTEM_ID),
    ).toBe(true);
    // USER_B is unaffected — still sees the default as a root.
    expect((await service.list(USER_B)).expense.some((n) => n.id === SYSTEM_ID)).toBe(true);

    const placements = dataSource.getRepository(UserCategoryParentEntity);
    expect(await placements.count({ where: { userId: USER_A } })).toBe(1);
  });

  it('cleans up placements when the parent category is deleted', async () => {
    await seedSystem();
    const target = await service.create(USER_A, {
      name: 'Extras',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
    });
    await service.move(USER_A, SYSTEM_ID, target.id);

    await service.delete(USER_A, target.id);
    const placements = dataSource.getRepository(UserCategoryParentEntity);
    expect(await placements.count({ where: { userId: USER_A } })).toBe(0);
    // The default falls back to its natural root position.
    expect((await service.list(USER_A)).expense.some((n) => n.id === SYSTEM_ID)).toBe(true);
  });
});
