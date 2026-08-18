import { DataSource, Repository } from 'typeorm';
import { Category } from '../../../domain/category';
import { CategoryEntity } from '../entities/category.entity';
import { UserHiddenCategoryEntity } from '../entities/user-hidden-category.entity';
import { UserCategoryOverrideEntity } from '../entities/user-category-override.entity';
import { TypeOrmCategoryRepository } from './category.repository';
import { TypeOrmHiddenCategoryRepository } from './hidden-category.repository';
import { TypeOrmCategoryOverrideRepository } from './category-override.repository';

/**
 * Integration test against a real Postgres — self-referencing FK, composite
 * primary keys and the idempotent hide/override upserts only exercise against
 * the real driver. Gated behind TEST_DATABASE_URL so `pnpm test` stays green
 * without a database; set it (e.g. the dev compose DB) to run.
 */
const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const SYSTEM_ID = '00000000-0000-4000-a000-000000000001';

const ENTITIES = [CategoryEntity, UserHiddenCategoryEntity, UserCategoryOverrideEntity];

function customRoot(userId: string, name = 'Mercado'): Category {
  return Category.create({
    id: crypto.randomUUID(),
    ownerId: userId,
    name,
    type: 'expense',
    icon: 'utensils',
    color: 'primary',
  });
}

maybe('Categories repositories (integration)', () => {
  let dataSource: DataSource;
  let categories: TypeOrmCategoryRepository;
  let hidden: TypeOrmHiddenCategoryRepository;
  let overrides: TypeOrmCategoryOverrideRepository;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url,
      entities: ENTITIES,
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    const catRepo: Repository<CategoryEntity> = dataSource.getRepository(CategoryEntity);
    const hidRepo: Repository<UserHiddenCategoryEntity> =
      dataSource.getRepository(UserHiddenCategoryEntity);
    const ovrRepo: Repository<UserCategoryOverrideEntity> =
      dataSource.getRepository(UserCategoryOverrideEntity);
    categories = new TypeOrmCategoryRepository(catRepo);
    hidden = new TypeOrmHiddenCategoryRepository(hidRepo);
    overrides = new TypeOrmCategoryOverrideRepository(ovrRepo);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(UserHiddenCategoryEntity).clear();
    await dataSource.getRepository(UserCategoryOverrideEntity).clear();
    await dataSource.getRepository(CategoryEntity).clear();
  });

  it('round-trips a self-referencing root + subcategory', async () => {
    const root = customRoot(USER_A);
    await categories.create(root);
    const sub = Category.createSubcategory({
      id: crypto.randomUUID(),
      ownerId: USER_A,
      parent: root,
      name: 'Feira',
      icon: 'utensils',
      color: 'primary',
    });
    await categories.create(sub);

    const owned = await categories.findAllByOwner(USER_A);
    expect(owned).toHaveLength(2);
    const persistedSub = owned.find((c) => c.id === sub.id);
    expect(persistedSub?.parentId).toBe(root.id);
    expect(persistedSub?.type).toBe('expense');
  });

  it('deletes a custom node with its descendants in one transaction (cascade)', async () => {
    const root = customRoot(USER_A);
    await categories.create(root);
    const sub = Category.createSubcategory({
      id: crypto.randomUUID(),
      ownerId: USER_A,
      parent: root,
      name: 'Feira',
      icon: 'utensils',
      color: 'primary',
    });
    await categories.create(sub);

    await categories.deleteWithDescendants(root.id, USER_A);
    expect(await categories.findAllByOwner(USER_A)).toHaveLength(0);
  });

  it("does not delete another user's tree", async () => {
    const root = customRoot(USER_A);
    await categories.create(root);
    await categories.deleteWithDescendants(root.id, USER_B);
    expect(await categories.findAccessible(root.id, USER_A)).not.toBeNull();
  });

  it('exposes system defaults and own custom via findAccessible, never other users’ custom', async () => {
    const systemRoot = Category.restore({
      id: SYSTEM_ID,
      ownerId: null,
      parentId: null,
      name: 'Alimentação',
      type: 'expense',
      icon: 'utensils',
      color: 'primary',
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await categories.create(systemRoot);
    const bRoot = customRoot(USER_B, 'Privado');
    await categories.create(bRoot);

    expect(await categories.findAccessible(SYSTEM_ID, USER_A)).not.toBeNull();
    expect(await categories.findAccessible(bRoot.id, USER_A)).toBeNull();
  });

  it('hides a category idempotently (second hide is a no-op)', async () => {
    await hidden.hide(USER_A, SYSTEM_ID);
    await hidden.hide(USER_A, SYSTEM_ID);
    expect(await hidden.findHiddenIds(USER_A)).toEqual([SYSTEM_ID]);
    await hidden.unhide(USER_A, SYSTEM_ID);
    expect(await hidden.findHiddenIds(USER_A)).toEqual([]);
  });

  it('upserts an override replacing prior values, scoped per user, revert idempotent', async () => {
    await overrides.upsert(USER_A, {
      categoryId: SYSTEM_ID,
      name: 'Comida',
      icon: 'utensils',
      color: 'primary',
    });
    await overrides.upsert(USER_A, {
      categoryId: SYSTEM_ID,
      name: 'Rango',
      icon: 'utensils',
      color: 'accent',
    });

    const mine = await overrides.findByUser(USER_A);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.name).toBe('Rango');
    expect(mine[0]?.color).toBe('accent');
    expect(await overrides.findOne(USER_B, SYSTEM_ID)).toBeNull();

    await overrides.revert(USER_A, SYSTEM_ID);
    await overrides.revert(USER_A, SYSTEM_ID);
    expect(await overrides.findOne(USER_A, SYSTEM_ID)).toBeNull();
  });
});
