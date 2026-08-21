import type { SyncedTransactionDto } from '@finance/contracts';
import type { SyncedTransaction } from '../synced-transaction';

/**
 * SyncedTransaction aggregate -> HTTP contract (R8 detail/list view). Exposes the full
 * import audit trail (syncStatus, transactionsMsId, retryCount, lastError) so callers can
 * tell success from error from pending/processing per row.
 */
export class SyncedTransactionConverter {
  static toResponse(transaction: SyncedTransaction): SyncedTransactionDto {
    return {
      id: transaction.id,
      pluggyTransactionId: transaction.pluggyTransactionId,
      linkedAccountId: transaction.linkedAccountId,
      linkedCreditCardId: transaction.linkedCreditCardId,
      description: transaction.description,
      amount: transaction.amount,
      date: transaction.date.toISOString(),
      direction: transaction.direction,
      pluggyStatus: transaction.pluggyStatus,
      installmentNumber: transaction.installmentNumber,
      installmentTotal: transaction.installmentTotal,
      syncStatus: transaction.syncStatus,
      transactionsMsId: transaction.transactionsMsId,
      retryCount: transaction.retryCount,
      lastError: transaction.lastError,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }
}
