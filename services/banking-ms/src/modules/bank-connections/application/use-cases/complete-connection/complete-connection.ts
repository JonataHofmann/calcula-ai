import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { BankConnection, type BankConnectionProps } from '../../../domain/bank-connection';
import {
  BANK_CONNECTION_REPOSITORY,
  type BankConnectionRepository,
} from '../../../domain/bank-connection.repository';
import { DuplicateConnectionError } from '../../../domain/errors';
import { PLUGGY_CLIENT, type PluggyClient } from '../../../domain/pluggy-client.port';
import { SyncConnectionUseCase } from '../sync-connection/sync-connection';

export interface CompleteConnectionInput {
  userId: string;
  pluggyItemId: string;
}

export type CompleteConnectionResult = BankConnectionProps;

@Injectable()
export class CompleteConnectionUseCase {
  constructor(
    @Inject(BANK_CONNECTION_REPOSITORY) private readonly connections: BankConnectionRepository,
    @Inject(PLUGGY_CLIENT) private readonly pluggy: PluggyClient,
    private readonly syncConnection: SyncConnectionUseCase,
  ) {}

  async execute(input: CompleteConnectionInput): Promise<CompleteConnectionResult> {
    const existing = await this.connections.findByUserAndItem(input.userId, input.pluggyItemId);
    if (existing) throw new DuplicateConnectionError(input.pluggyItemId);

    const item = await this.pluggy.getItem(input.pluggyItemId);
    const connection = BankConnection.create({
      id: randomUUID(),
      userId: input.userId,
      pluggyItemId: input.pluggyItemId,
      institutionId: item.institutionId,
      institutionName: item.institutionName,
    });
    await this.connections.create(connection);

    // Fire-and-forget: the caller doesn't wait on the full account/transaction sync (AGENTS.md rule 8).
    void this.syncConnection
      .execute({ userId: input.userId, bankConnectionId: connection.id })
      .catch(() => undefined);

    return connection.toProps();
  }
}
