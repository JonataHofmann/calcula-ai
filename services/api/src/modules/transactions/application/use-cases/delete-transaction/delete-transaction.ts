import { Inject, Injectable } from '@nestjs/common';
import type { GroupScope } from '@finance/contracts';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../../../domain/transaction.repository';
import { TransactionNotFoundError } from '../../../domain/errors';

@Injectable()
export class DeleteTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
  ) {}

  /** Deletes one occurrence, or a group scope (one/future/all) including paid rows (R6). */
  async execute(userId: string, id: string, scope?: GroupScope): Promise<void> {
    const target = await this.transactions.findById(id, userId);
    if (!target) throw new TransactionNotFoundError(id);

    if (!target.groupId || !scope || scope === 'one') {
      await this.transactions.delete(id, userId);
      return;
    }

    if (scope === 'all') {
      await this.transactions.deleteGroup(target.groupId, userId);
      return;
    }

    // scope === 'future': this occurrence and every later one in the group.
    const group = await this.transactions.findGroup(target.groupId, userId);
    const targets = group.filter((t) => t.dueDate.getTime() >= target.dueDate.getTime());
    for (const t of targets) {
      await this.transactions.delete(t.id, userId);
    }
  }
}
