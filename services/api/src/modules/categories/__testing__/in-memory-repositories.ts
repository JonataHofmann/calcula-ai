import { FindOperator, type Repository } from 'typeorm';
import type { CategoryType } from '@finance/contracts';
import { CategoryEntity } from '../entities/category.entity';
import { TransactionEntity } from '../../transactions/entities/transaction.entity';
import { UserHiddenCategoryEntity } from '../entities/user-hidden-category.entity';
import { UserCategoryOverrideEntity } from '../entities/user-category-override.entity';
import { UserCategoryParentEntity } from '../entities/user-category-parent.entity';

/**
 * Owner-scoped in-memory fakes of the three TypeORM repositories the
 * {@link CategoriesService} injects. They implement only the subset the service
 * uses, mirroring the SQL scoping rules so specs run without a database.
 */

const byCreated = (a: CategoryEntity, b: CategoryEntity): number =>
  a.createdAt.getTime() - b.createdAt.getTime();

/** Resolve `where.id`, which the service passes either as a bare id or `In([...])`. */
function idMatcher(value: unknown): (id: string) => boolean {
  if (value instanceof FindOperator) {
    const set = new Set(value.value as string[]);
    return (id) => set.has(id);
  }
  return (id) => id === value;
}

export function makeFakeCategoryRepo(seed: CategoryEntity[] = []): Repository<CategoryEntity> {
  const store = new Map<string, CategoryEntity>(seed.map((c) => [c.id, { ...c }]));
  const fake = {
    create: (data: Partial<CategoryEntity>) => Object.assign(new CategoryEntity(), data),
    insert: async (e: CategoryEntity) => void store.set(e.id, { ...e }),
    save: async (e: CategoryEntity) => (store.set(e.id, { ...e }), e),
    find: async (o: { where?: { ownerId?: unknown }; order?: unknown }) => {
      let rows = [...store.values()];
      const where = o?.where ?? {};
      if ('ownerId' in where) {
        // `IsNull()` (a FindOperator) selects the shared system defaults; a bare value scopes by owner.
        const w = where.ownerId;
        rows = w instanceof FindOperator ? rows.filter((r) => r.ownerId === null) : rows.filter((r) => r.ownerId === w);
      }
      if (o?.order) rows = rows.sort(byCreated);
      return rows.map((r) => ({ ...r }));
    },
    findOne: async (o: { where: { id: string } }) => {
      const r = store.get(o.where.id);
      return r ? { ...r } : null;
    },
    delete: async (c: { id: unknown; ownerId?: string | null }) => {
      const matches = idMatcher(c.id);
      for (const r of [...store.values()]) {
        if (matches(r.id) && (c.ownerId === undefined || r.ownerId === c.ownerId)) {
          store.delete(r.id);
        }
      }
    },
  };
  return fake as unknown as Repository<CategoryEntity>;
}

export function makeFakeHiddenRepo(): Repository<UserHiddenCategoryEntity> {
  const store = new Set<string>();
  const k = (userId: string, categoryId: string) => `${userId}:${categoryId}`;
  const fake = {
    find: async (o: { where: { userId: string } }) => {
      const prefix = `${o.where.userId}:`;
      return [...store]
        .filter((key) => key.startsWith(prefix))
        .map((key) => {
          const row = new UserHiddenCategoryEntity();
          row.userId = o.where.userId;
          row.categoryId = key.slice(prefix.length);
          return row;
        });
    },
    findOne: async (o: { where: { userId: string; categoryId: string } }) => {
      if (!store.has(k(o.where.userId, o.where.categoryId))) return null;
      const row = new UserHiddenCategoryEntity();
      row.userId = o.where.userId;
      row.categoryId = o.where.categoryId;
      return row;
    },
    insert: async (e: { userId: string; categoryId: string }) => void store.add(k(e.userId, e.categoryId)),
    delete: async (c: { userId: string; categoryId: string }) =>
      void store.delete(k(c.userId, c.categoryId)),
  };
  return fake as unknown as Repository<UserHiddenCategoryEntity>;
}

export function makeFakeOverrideRepo(): Repository<UserCategoryOverrideEntity> {
  const store = new Map<string, UserCategoryOverrideEntity>();
  const k = (userId: string, categoryId: string) => `${userId}:${categoryId}`;
  const fake = {
    find: async (o: { where: { userId: string } }) =>
      [...store.values()].filter((r) => r.userId === o.where.userId).map((r) => ({ ...r })),
    findOne: async (o: { where: { userId: string; categoryId: string } }) => {
      const r = store.get(k(o.where.userId, o.where.categoryId));
      return r ? { ...r } : null;
    },
    upsert: async (v: Partial<UserCategoryOverrideEntity>) => {
      const row = Object.assign(new UserCategoryOverrideEntity(), v);
      store.set(k(row.userId, row.categoryId), row);
    },
    delete: async (c: { userId: string; categoryId: string }) =>
      void store.delete(k(c.userId, c.categoryId)),
  };
  return fake as unknown as Repository<UserCategoryOverrideEntity>;
}

export function makeFakeParentRepo(): Repository<UserCategoryParentEntity> {
  const store = new Map<string, UserCategoryParentEntity>();
  const k = (userId: string, categoryId: string) => `${userId}:${categoryId}`;
  const fake = {
    find: async (o: { where: { userId: string } }) =>
      [...store.values()].filter((r) => r.userId === o.where.userId).map((r) => ({ ...r })),
    upsert: async (v: Partial<UserCategoryParentEntity>) => {
      const row = Object.assign(new UserCategoryParentEntity(), v);
      store.set(k(row.userId, row.categoryId), row);
    },
    // Criteria: { userId, categoryId?: id|In([...]), parentId?: In([...]) }.
    delete: async (c: { userId: string; categoryId?: unknown; parentId?: unknown }) => {
      const catMatch = 'categoryId' in c ? idMatcher(c.categoryId) : null;
      const parentMatch = 'parentId' in c ? idMatcher(c.parentId) : null;
      for (const r of [...store.values()]) {
        if (r.userId !== c.userId) continue;
        if (catMatch && !catMatch(r.categoryId)) continue;
        if (parentMatch && !parentMatch(r.parentId ?? '')) continue;
        store.delete(k(r.userId, r.categoryId));
      }
    },
  };
  return fake as unknown as Repository<UserCategoryParentEntity>;
}

/**
 * In-memory fake of the transaction repo subset the {@link CategoriesService} uses:
 * count/delete scoped by user, with `categoryId` passed as a bare id or `In([...])`.
 */
export function makeFakeTransactionRepo(
  seed: TransactionEntity[] = [],
): Repository<TransactionEntity> {
  let store = [...seed];
  const fake = {
    count: async (o: { where: { categoryId: unknown; userId: string } }) => {
      const matches = idMatcher(o.where.categoryId);
      return store.filter((t) => matches(t.categoryId) && t.userId === o.where.userId).length;
    },
    delete: async (c: { categoryId: unknown; userId: string }) => {
      const matches = idMatcher(c.categoryId);
      const before = store.length;
      store = store.filter((t) => !(matches(t.categoryId) && t.userId === c.userId));
      return { affected: before - store.length };
    },
    __store: () => store,
  };
  return fake as unknown as Repository<TransactionEntity>;
}

let seq = 0;

/** Build a persisted system default category with deterministic ordering. */
export function systemCategory(input: {
  id: string;
  name: string;
  type: CategoryType;
  parentId?: string | null;
  icon?: string;
  color?: string;
}): CategoryEntity {
  const now = new Date(2020, 0, 1, 0, 0, 0, seq++);
  return Object.assign(new CategoryEntity(), {
    id: input.id,
    ownerId: null,
    parentId: input.parentId ?? null,
    name: input.name,
    type: input.type,
    icon: input.icon ?? 'utensils',
    color: input.color ?? 'primary',
    isSystem: true,
    createdAt: now,
    updatedAt: now,
  });
}

/** Build a persisted custom category owned by a user. */
export function customCategory(input: {
  id: string;
  ownerId: string;
  name: string;
  type: CategoryType;
  parentId?: string | null;
  icon?: string;
  color?: string;
}): CategoryEntity {
  const now = new Date(2020, 0, 1, 0, 0, 0, seq++);
  return Object.assign(new CategoryEntity(), {
    id: input.id,
    ownerId: input.ownerId,
    parentId: input.parentId ?? null,
    name: input.name,
    type: input.type,
    icon: input.icon ?? 'tag',
    color: input.color ?? 'accent',
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  });
}
