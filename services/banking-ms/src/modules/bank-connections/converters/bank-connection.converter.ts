import type { BankConnectionDto } from '@finance/contracts';
import type { ListConnectionsResult } from '../bank-connections.service';

/**
 * Domain aggregate -> HTTP contract. Sync runs async (AGENTS.md rule 8), so a freshly
 * created connection is converted with empty accounts/cards and zeroed counters.
 */
export class BankConnectionConverter {
  static toResponse(connection: ListConnectionsResult): BankConnectionDto {
    return {
      id: connection.id,
      institutionName: connection.institutionName,
      status: connection.status,
      lastSyncedAt: connection.lastSyncedAt ? connection.lastSyncedAt.toISOString() : null,
      createdAt: connection.createdAt.toISOString(),
      accounts: connection.accounts.map((a) => ({
        id: a.id,
        displayName: a.displayName,
        type: a.type,
        balance: a.balance,
        currency: a.currency,
      })),
      creditCards: connection.creditCards.map((c) => ({
        id: c.id,
        brand: c.brand,
        lastDigits: c.lastDigits,
        currentBalance: c.currentBalance,
        creditLimit: c.creditLimit,
      })),
      transactionsTotal: connection.transactionsTotal,
      transactionsErrored: connection.transactionsErrored,
    };
  }
}
