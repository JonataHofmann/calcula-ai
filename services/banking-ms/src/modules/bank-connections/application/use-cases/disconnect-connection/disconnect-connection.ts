import { Inject, Injectable } from '@nestjs/common';
import {
  BANK_CONNECTION_REPOSITORY,
  type BankConnectionRepository,
} from '../../../domain/bank-connection.repository';
import { ConnectionNotFoundError } from '../../../domain/errors';

export interface DisconnectConnectionInput {
  id: string;
  userId: string;
}

@Injectable()
export class DisconnectConnectionUseCase {
  constructor(
    @Inject(BANK_CONNECTION_REPOSITORY) private readonly connections: BankConnectionRepository,
  ) {}

  async execute(input: DisconnectConnectionInput): Promise<void> {
    const connection = await this.connections.findById(input.id, input.userId);
    if (!connection) {
      throw new ConnectionNotFoundError(input.id);
    }
    connection.disconnect();
    await this.connections.save(connection);
  }
}
