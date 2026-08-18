import { Inject, Injectable } from '@nestjs/common';
import type { ListTransactionsQuery } from '@finance/contracts';
import type { Transaction } from '../../../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../../../domain/transaction.repository';

@Injectable()
export class ListTransactionsUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
  ) {}

  async execute(userId: string, query: ListTransactionsQuery): Promise<Transaction[]> {
    return this.transactions.find(userId, {
      dueFrom: new Date(query.dueFrom),
      dueTo: new Date(query.dueTo),
      search: query.search,
      amount: query.amount,
      recurrence: query.recurrence,
      type: query.type,
      categoryId: query.categoryId,
      accountId: query.accountId,
      creditCardId: query.creditCardId,
      sort: query.sort,
      order: query.order,
    });
  }
}
