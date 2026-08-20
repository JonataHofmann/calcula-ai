import { Inject, Injectable } from '@nestjs/common';
import {
  BANK_CONNECTION_REPOSITORY,
  type BankConnectionRepository,
} from '../../../domain/bank-connection.repository';
import { ImportRetriesExhaustedError } from '../../../domain/errors';
import type { SyncedTransaction } from '../../../domain/synced-transaction';
import {
  TRANSACTIONS_IMPORTER,
  type TransactionsImporter,
} from '../../../domain/transactions-importer.port';

/** Retry budget for a single `synced_transaction` row before it's treated as permanently failed (FR-012). */
export const RETRY_LIMIT = 5;
/** Base delay for the exponential backoff: `BASE_BACKOFF_MINUTES * 2 ** (retryCount - 1)`. */
export const BASE_BACKOFF_MINUTES = 10;

export interface RetryFailedImportsInput {
  synced: SyncedTransaction;
  now?: Date;
  /** Bypasses the exponential backoff gate for manual/on-demand retries. */
  force?: boolean;
}

/**
 * Retries one errored `synced_transaction` row in place (never creates a duplicate, R6).
 * Skips rows not yet due per the exponential backoff. On exhausting the retry budget, flags
 * the owning bank_connection as `needs_attention` (FR-012) and raises ImportRetriesExhaustedError
 * so the caller (the retry job) can log it — the row itself stays `error` for manual follow-up.
 */
@Injectable()
export class RetryFailedImportsUseCase {
  constructor(
    @Inject(BANK_CONNECTION_REPOSITORY) private readonly connections: BankConnectionRepository,
    @Inject(TRANSACTIONS_IMPORTER) private readonly importer: TransactionsImporter,
  ) {}

  async execute(input: RetryFailedImportsInput): Promise<void> {
    const { synced } = input;
    const now = input.now ?? new Date();
    if (!input.force && !isDueForRetry(synced, now)) return;

    const { apiAccountId, apiCreditCardId } = await this.resolveApiLinkage(synced);

    synced.retry(now);
    synced.startProcessing(now);
    try {
      const { transactionsMsId } = await this.importer.importTransaction({
        userId: synced.userId,
        pluggyTransactionId: synced.pluggyTransactionId,
        description: synced.description,
        amount: synced.amount,
        dueDate: synced.date,
        type: synced.direction === 'credit' ? 'income' : 'expense',
        accountId: apiAccountId,
        creditCardId: apiCreditCardId,
        installmentNumber: synced.installmentNumber,
        installmentCount: synced.installmentTotal,
        pluggyStatus: synced.pluggyStatus,
      });
      synced.markSuccess(transactionsMsId, now);
      await this.connections.upsertSyncedTransaction(synced);
      return;
    } catch (err) {
      synced.markError(err instanceof Error ? err.message : String(err), now);
      await this.connections.upsertSyncedTransaction(synced);
    }

    if (synced.hasReachedRetryLimit(RETRY_LIMIT)) {
      await this.flagConnectionNeedsAttention(synced);
      throw new ImportRetriesExhaustedError(synced.pluggyTransactionId);
    }
  }

  private async resolveApiLinkage(
    synced: SyncedTransaction,
  ): Promise<{ apiAccountId: string | null; apiCreditCardId: string | null }> {
    const bankConnectionId = await this.connections.findBankConnectionIdForOrigin(
      synced.linkedAccountId,
      synced.linkedCreditCardId,
    );
    if (!bankConnectionId) return { apiAccountId: null, apiCreditCardId: null };

    if (synced.linkedAccountId) {
      const accounts = await this.connections.findLinkedAccountsByConnection(bankConnectionId);
      const apiAccountId = accounts.find((a) => a.id === synced.linkedAccountId)?.apiAccountId ?? null;
      return { apiAccountId, apiCreditCardId: null };
    }
    if (synced.linkedCreditCardId) {
      const cards = await this.connections.findLinkedCreditCardsByConnection(bankConnectionId);
      const apiCreditCardId = cards.find((c) => c.id === synced.linkedCreditCardId)?.apiCreditCardId ?? null;
      return { apiAccountId: null, apiCreditCardId };
    }
    return { apiAccountId: null, apiCreditCardId: null };
  }

  private async flagConnectionNeedsAttention(synced: SyncedTransaction): Promise<void> {
    const bankConnectionId = await this.connections.findBankConnectionIdForOrigin(
      synced.linkedAccountId,
      synced.linkedCreditCardId,
    );
    if (!bankConnectionId) return;
    const connection = await this.connections.findById(bankConnectionId, synced.userId);
    if (!connection) return;
    connection.markNeedsAttention();
    await this.connections.save(connection);
  }
}

function isDueForRetry(synced: SyncedTransaction, now: Date): boolean {
  const backoffMs = BASE_BACKOFF_MINUTES * 60_000 * 2 ** Math.max(synced.retryCount - 1, 0);
  return now.getTime() - synced.updatedAt.getTime() >= backoffMs;
}
