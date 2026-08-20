import { Inject, Injectable } from '@nestjs/common';
import { Transaction } from '../../../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../../../domain/transaction.repository';
import { TransactionNotFoundError } from '../../../domain/errors';

@Injectable()
export class UndoEffectuateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
  ) {}

  /** paid -> pending. Inverse of EffectuateTransactionUseCase; does not un-materialize a next fixed occurrence. */
  async execute(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactions.findById(id, userId);
    if (!transaction) throw new TransactionNotFoundError(id);
    transaction.undoEffectuate();
    await this.transactions.save(transaction);
    return transaction;
  }
}
