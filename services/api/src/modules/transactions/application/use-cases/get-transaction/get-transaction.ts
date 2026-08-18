import { Inject, Injectable } from '@nestjs/common';
import type { Transaction } from '../../../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../../../domain/transaction.repository';
import { TransactionNotFoundError } from '../../../domain/errors';

@Injectable()
export class GetTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
  ) {}

  async execute(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactions.findById(id, userId);
    if (!transaction) throw new TransactionNotFoundError(id);
    return transaction;
  }
}
