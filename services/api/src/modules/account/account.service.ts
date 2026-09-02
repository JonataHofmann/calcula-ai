import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { BackupSnapshot, ImportMode, ImportResult, ResetResult } from '@finance/contracts';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { CreditCardEntity } from '../cards/entities/credit-card.entity';
import { AccountEntity } from '../accounts/entities/account.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { UserCategoryOverrideEntity } from '../categories/entities/user-category-override.entity';
import { UserHiddenCategoryEntity } from '../categories/entities/user-hidden-category.entity';
import { UserCategoryParentEntity } from '../categories/entities/user-category-parent.entity';

/**
 * Full "reset my data" wipe. Deletes every user-scoped row in one transaction so the reset is
 * atomic (all-or-nothing). System default categories (ownerId null) and the user's login are
 * left intact — only rows the user owns are removed. Categories are matched by ownerId = userId,
 * so the shared defaults are never touched.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async resetData(userId: string): Promise<ResetResult> {
    this.logger.warn(`Resetting ALL data for user ${userId}`);

    const result = await this.dataSource.transaction(async (manager) => {
      const transactions =
        (await manager.delete(TransactionEntity, { userId })).affected ?? 0;
      const categoryOverrides =
        (await manager.delete(UserCategoryOverrideEntity, { userId })).affected ?? 0;
      const hiddenCategories =
        (await manager.delete(UserHiddenCategoryEntity, { userId })).affected ?? 0;
      await manager.delete(UserCategoryParentEntity, { userId });
      // Only the user's own categories — system defaults (ownerId null) stay.
      const categories =
        (await manager.delete(CategoryEntity, { ownerId: userId })).affected ?? 0;
      const creditCards =
        (await manager.delete(CreditCardEntity, { userId })).affected ?? 0;
      const accounts =
        (await manager.delete(AccountEntity, { userId })).affected ?? 0;

      return {
        transactions,
        accounts,
        creditCards,
        categories,
        categoryOverrides,
        hiddenCategories,
      } satisfies ResetResult;
    });

    this.logger.warn(`Reset complete for user ${userId}: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Portable snapshot of everything the user owns. Custom categories only — system
   * defaults (ownerId null) live on every deployment and are referenced by id.
   */
  async exportData(userId: string): Promise<BackupSnapshot> {
    const [accounts, creditCards, categories, transactions] = await Promise.all([
      this.dataSource.getRepository(AccountEntity).find({ where: { userId } }),
      this.dataSource.getRepository(CreditCardEntity).find({ where: { userId } }),
      this.dataSource.getRepository(CategoryEntity).find({ where: { ownerId: userId } }),
      this.dataSource.getRepository(TransactionEntity).find({ where: { userId } }),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        bankId: a.bankId,
        icon: a.icon,
        color: a.color,
      })),
      creditCards: creditCards.map((c) => ({
        id: c.id,
        name: c.name,
        lastDigits: c.lastDigits,
        dueDay: c.dueDay,
        closingDay: c.closingDay,
        limit: c.limit,
        brandId: c.brandId,
      })),
      categories: categories.map((c) => ({
        id: c.id,
        parentId: c.parentId,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        description: t.description,
        originalDescription: t.originalDescription,
        dueDate: t.dueDate.toISOString(),
        amount: t.amount,
        effectiveAmount: t.effectiveAmount,
        recurrence: t.recurrence,
        effectiveDate: t.effectiveDate?.toISOString() ?? null,
        type: t.type,
        notes: t.notes,
        status: t.status,
        endDate: t.endDate?.toISOString() ?? null,
        installmentCount: t.installmentCount,
        installmentNumber: t.installmentNumber,
        groupId: t.groupId,
        categoryId: t.categoryId,
        accountId: t.accountId,
        creditCardId: t.creditCardId,
        source: t.source,
        externalId: t.externalId,
      })),
    };
  }

  /**
   * Merge import: every row gets a fresh id, so importing never collides with or
   * overwrites existing data. IDs are remapped consistently — old→new — across
   * categories (parent-first, so parentId resolves), accounts, cards and the
   * transactions that reference them. Transaction categoryId that is NOT a custom
   * category in the snapshot is kept verbatim (a shared system default). Runs in one
   * transaction so a bad row rolls the whole import back.
   *
   * `mode`:
   * - `merge` (default): append to existing data.
   * - `replace`: wipe every user-scoped row first (same deletes as {@link resetData}),
   *   inside the same transaction, so the whole replace is atomic — a failed insert
   *   rolls the wipe back too.
   */
  async importData(
    userId: string,
    snapshot: BackupSnapshot,
    mode: ImportMode = 'merge',
  ): Promise<ImportResult> {
    this.logger.warn(`Importing backup for user ${userId} (v${snapshot.version}, mode=${mode})`);

    return this.dataSource.transaction(async (manager) => {
      if (mode === 'replace') {
        this.logger.warn(`Replace import: wiping all data for user ${userId} first`);
        await manager.delete(TransactionEntity, { userId });
        await manager.delete(UserCategoryOverrideEntity, { userId });
        await manager.delete(UserHiddenCategoryEntity, { userId });
        await manager.delete(UserCategoryParentEntity, { userId });
        await manager.delete(CategoryEntity, { ownerId: userId });
        await manager.delete(CreditCardEntity, { userId });
        await manager.delete(AccountEntity, { userId });
      }

      const catIdMap = new Map<string, string>();
      // Roots first so children can resolve their remapped parentId.
      const roots = snapshot.categories.filter((c) => !c.parentId);
      const children = snapshot.categories.filter((c) => c.parentId);
      for (const c of [...roots, ...children]) {
        const newId = randomUUID();
        catIdMap.set(c.id, newId);
        await manager.insert(CategoryEntity, {
          id: newId,
          ownerId: userId,
          parentId: c.parentId ? (catIdMap.get(c.parentId) ?? null) : null,
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color,
          isSystem: false,
        });
      }

      const accIdMap = new Map<string, string>();
      for (const a of snapshot.accounts) {
        const newId = randomUUID();
        accIdMap.set(a.id, newId);
        await manager.insert(AccountEntity, {
          id: newId,
          userId,
          name: a.name,
          bankId: a.bankId,
          icon: a.icon,
          color: a.color,
        });
      }

      const cardIdMap = new Map<string, string>();
      for (const c of snapshot.creditCards) {
        const newId = randomUUID();
        cardIdMap.set(c.id, newId);
        await manager.insert(CreditCardEntity, {
          id: newId,
          userId,
          name: c.name,
          lastDigits: c.lastDigits,
          dueDay: c.dueDay,
          closingDay: c.closingDay,
          limit: c.limit,
          brandId: c.brandId,
        });
      }

      const groupIdMap = new Map<string, string>();
      let transactions = 0;
      for (const t of snapshot.transactions) {
        const accountId = t.accountId ? (accIdMap.get(t.accountId) ?? null) : null;
        const creditCardId = t.creditCardId ? (cardIdMap.get(t.creditCardId) ?? null) : null;
        // CHECK: exactly one origin. Skip rows that can't satisfy it after remap.
        if ((accountId === null) === (creditCardId === null)) continue;

        let groupId: string | null = null;
        if (t.groupId) {
          groupId = groupIdMap.get(t.groupId) ?? randomUUID();
          groupIdMap.set(t.groupId, groupId);
        }

        await manager.insert(TransactionEntity, {
          id: randomUUID(),
          userId,
          description: t.description,
          originalDescription: t.originalDescription ?? null,
          dueDate: new Date(t.dueDate),
          amount: t.amount,
          effectiveAmount: t.effectiveAmount ?? null,
          recurrence: t.recurrence,
          effectiveDate: t.effectiveDate ? new Date(t.effectiveDate) : null,
          type: t.type,
          notes: t.notes ?? null,
          status: t.status,
          endDate: t.endDate ? new Date(t.endDate) : null,
          installmentCount: t.installmentCount ?? null,
          installmentNumber: t.installmentNumber ?? null,
          groupId,
          categoryId: catIdMap.get(t.categoryId) ?? t.categoryId,
          accountId,
          creditCardId,
          source: t.source ?? 'manual',
          externalId: t.externalId ?? null,
        });
        transactions++;
      }

      const result: ImportResult = {
        accounts: accIdMap.size,
        creditCards: cardIdMap.size,
        categories: catIdMap.size,
        transactions,
      };
      this.logger.warn(`Import complete for user ${userId}: ${JSON.stringify(result)}`);
      return result;
    });
  }
}
