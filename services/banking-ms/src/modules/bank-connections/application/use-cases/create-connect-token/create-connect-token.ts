import { Inject, Injectable } from '@nestjs/common';
import {
  BANK_CONNECTION_REPOSITORY,
  type BankConnectionRepository,
} from '../../../domain/bank-connection.repository';
import { ConnectionNotFoundError } from '../../../domain/errors';
import { PLUGGY_CLIENT, type PluggyClient } from '../../../domain/pluggy-client.port';

export interface CreateConnectTokenInput {
  userId: string;
  mode: 'create' | 'reauth';
  bankConnectionId?: string;
}

export interface CreateConnectTokenResult {
  connectToken: string;
  expiresAt: Date;
}

@Injectable()
export class CreateConnectTokenUseCase {
  constructor(
    @Inject(BANK_CONNECTION_REPOSITORY) private readonly connections: BankConnectionRepository,
    @Inject(PLUGGY_CLIENT) private readonly pluggy: PluggyClient,
  ) {}

  async execute(input: CreateConnectTokenInput): Promise<CreateConnectTokenResult> {
    const itemId = await this.resolveItemId(input);
    const token = await this.pluggy.createConnectToken({ itemId });
    return { connectToken: token.connectToken, expiresAt: token.expiresAt };
  }

  private async resolveItemId(input: CreateConnectTokenInput): Promise<string | undefined> {
    if (input.mode === 'create') return undefined;

    const connection = await this.connections.findById(input.bankConnectionId!, input.userId);
    if (!connection) throw new ConnectionNotFoundError(input.bankConnectionId!);
    return connection.pluggyItemId;
  }
}
