import { Inject, Injectable } from '@nestjs/common';
import {
  BANK_CONNECTION_REPOSITORY,
  type BankConnectionRepository,
} from '../../../domain/bank-connection.repository';
import type { BankConnectionProps } from '../../../domain/bank-connection';
import type { LinkedAccountProps } from '../../../domain/linked-account';
import type { LinkedCreditCardProps } from '../../../domain/linked-credit-card';

export interface ListConnectionsInput {
  userId: string;
}

export type ListConnectionsResult = BankConnectionProps & {
  accounts: LinkedAccountProps[];
  creditCards: LinkedCreditCardProps[];
};

@Injectable()
export class ListConnectionsUseCase {
  constructor(
    @Inject(BANK_CONNECTION_REPOSITORY) private readonly connections: BankConnectionRepository,
  ) {}

  async execute(input: ListConnectionsInput): Promise<ListConnectionsResult[]> {
    const connections = await this.connections.findAllByUser(input.userId);
    return Promise.all(
      connections.map(async (connection) => {
        const props = connection.toProps();
        const [accounts, creditCards] = await Promise.all([
          this.connections.findLinkedAccountsByConnection(props.id),
          this.connections.findLinkedCreditCardsByConnection(props.id),
        ]);
        return {
          ...props,
          accounts: accounts.map((a) => a.toProps()),
          creditCards: creditCards.map((c) => c.toProps()),
        };
      }),
    );
  }
}
