import { Inject, Injectable } from '@nestjs/common';
import {
  BANK_CONNECTION_REPOSITORY,
  type BankConnectionRepository,
} from '../../../domain/bank-connection.repository';
import { ConnectionNotActiveError, ConnectionNotFoundError } from '../../../domain/errors';
import { PLUGGY_CLIENT, type PluggyClient } from '../../../domain/pluggy-client.port';
import { SyncConnectionUseCase } from '../sync-connection/sync-connection';

export interface TriggerManualRefreshInput {
  userId: string;
  bankConnectionId: string;
  forceFullSync?: boolean;
}

@Injectable()
export class TriggerManualRefreshUseCase {
  constructor(
    @Inject(BANK_CONNECTION_REPOSITORY) private readonly connections: BankConnectionRepository,
    @Inject(PLUGGY_CLIENT) private readonly pluggy: PluggyClient,
    private readonly syncConnection: SyncConnectionUseCase,
  ) {}

  async execute(input: TriggerManualRefreshInput): Promise<void> {
    const connection = await this.connections.findById(input.bankConnectionId, input.userId);
    if (!connection) throw new ConnectionNotFoundError(input.bankConnectionId);
    if (connection.status !== 'active') throw new ConnectionNotActiveError(input.bankConnectionId);

    await this.pluggy.forceRefreshItem(connection.pluggyItemId);

    // Fire-and-forget: the caller doesn't wait on the full account/transaction sync (AGENTS.md rule 8).
    void this.syncConnection
      .execute({
        userId: input.userId,
        bankConnectionId: connection.id,
        forceFullSync: input.forceFullSync,
      })
      .catch(() => undefined);
  }
}
