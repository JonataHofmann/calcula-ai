import { Inject, Injectable } from '@nestjs/common';
import {
  BANK_CONNECTION_REPOSITORY,
  type BankConnectionRepository,
} from '../../../domain/bank-connection.repository';
import { ConnectionNotFoundError, ImportRetriesExhaustedError } from '../../../domain/errors';
import { RetryFailedImportsUseCase } from '../retry-failed-imports/retry-failed-imports';

export interface RetryConnectionImportsInput {
  userId: string;
  bankConnectionId: string;
}

export interface RetryConnectionImportsResult {
  retried: number;
  succeeded: number;
  stillFailing: number;
}

/** Manually retries every currently-`error` synced_transaction for one connection, bypassing the backoff gate. */
@Injectable()
export class RetryConnectionImportsUseCase {
  constructor(
    @Inject(BANK_CONNECTION_REPOSITORY) private readonly connections: BankConnectionRepository,
    private readonly retryFailedImports: RetryFailedImportsUseCase,
  ) {}

  async execute(input: RetryConnectionImportsInput): Promise<RetryConnectionImportsResult> {
    const connection = await this.connections.findById(input.bankConnectionId, input.userId);
    if (!connection) throw new ConnectionNotFoundError(input.bankConnectionId);

    const [accounts, cards] = await Promise.all([
      this.connections.findLinkedAccountsByConnection(connection.id),
      this.connections.findLinkedCreditCardsByConnection(connection.id),
    ]);
    const origins = [
      ...accounts.map((a) => ({ linkedAccountId: a.id as string | null, linkedCreditCardId: null as string | null })),
      ...cards.map((c) => ({ linkedAccountId: null as string | null, linkedCreditCardId: c.id as string | null })),
    ];

    const errored = (
      await Promise.all(
        origins.map((o) =>
          this.connections.findSyncedTransactionsByOrigin(o.linkedAccountId, o.linkedCreditCardId),
        ),
      )
    )
      .flat()
      .filter((t) => t.syncStatus === 'error');

    let succeeded = 0;
    for (const synced of errored) {
      try {
        await this.retryFailedImports.execute({ synced, force: true });
        if (synced.syncStatus === 'success') succeeded++;
      } catch (err) {
        if (!(err instanceof ImportRetriesExhaustedError)) throw err;
      }
    }
    return { retried: errored.length, succeeded, stillFailing: errored.length - succeeded };
  }
}
