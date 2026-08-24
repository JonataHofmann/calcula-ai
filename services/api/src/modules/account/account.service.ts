import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { ResetResult } from '@finance/contracts';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { CreditCardEntity } from '../cards/entities/credit-card.entity';
import { AccountEntity } from '../accounts/entities/account.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { UserCategoryOverrideEntity } from '../categories/entities/user-category-override.entity';
import { UserHiddenCategoryEntity } from '../categories/entities/user-hidden-category.entity';

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
}
