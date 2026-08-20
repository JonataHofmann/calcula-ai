import { BankConnection } from '../domain/bank-connection';
import { LinkedAccount } from '../domain/linked-account';
import { SyncedTransaction } from '../domain/synced-transaction';
import { CreateConnectTokenUseCase } from '../application/use-cases/create-connect-token/create-connect-token';
import { CompleteConnectionUseCase } from '../application/use-cases/complete-connection/complete-connection';
import { ListConnectionsUseCase } from '../application/use-cases/list-connections/list-connections';
import { DisconnectConnectionUseCase } from '../application/use-cases/disconnect-connection/disconnect-connection';
import { TriggerManualRefreshUseCase } from '../application/use-cases/trigger-manual-refresh/trigger-manual-refresh';
import { RetryConnectionImportsUseCase } from '../application/use-cases/retry-connection-imports/retry-connection-imports';
import { SyncConnectionUseCase } from '../application/use-cases/sync-connection/sync-connection';
import { RetryFailedImportsUseCase } from '../application/use-cases/retry-failed-imports/retry-failed-imports';
import { FakeBankConnectionRepository, FakePluggyClient, FakeTransactionsImporter, USER_A } from '../application/use-cases/test-fakes';
import { BankConnectionsController } from './bank-connections.controller';

const CONNECTION_ID = 'conn-1';
const ITEM_ID = 'item-1';

function setup() {
  const connections = new FakeBankConnectionRepository();
  const pluggy = new FakePluggyClient();
  const importer = new FakeTransactionsImporter();
  const syncConnection = new SyncConnectionUseCase(connections, pluggy, importer);
  const retryFailedImports = new RetryFailedImportsUseCase(connections, importer);

  const createConnectToken = new CreateConnectTokenUseCase(connections, pluggy);
  const completeConnection = new CompleteConnectionUseCase(connections, pluggy, syncConnection);
  const listConnections = new ListConnectionsUseCase(connections);
  const disconnectConnection = new DisconnectConnectionUseCase(connections);
  const triggerManualRefresh = new TriggerManualRefreshUseCase(connections, pluggy, syncConnection);
  const retryConnectionImports = new RetryConnectionImportsUseCase(connections, retryFailedImports);

  const controller = new BankConnectionsController(
    createConnectToken,
    completeConnection,
    listConnections,
    disconnectConnection,
    triggerManualRefresh,
    retryConnectionImports,
  );

  return { controller, connections, pluggy, importer };
}

async function seedActiveConnection(connections: FakeBankConnectionRepository) {
  await connections.create(
    BankConnection.restore({
      id: CONNECTION_ID,
      userId: USER_A,
      pluggyItemId: ITEM_ID,
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
      status: 'active',
      lastSyncedAt: new Date('2026-08-01'),
      createdAt: new Date('2026-08-01'),
      updatedAt: new Date('2026-08-01'),
    }),
  );
}

describe('BankConnectionsController', () => {
  describe('refresh', () => {
    it('triggers a refresh without forceFullSync when the flag is omitted', async () => {
      const { controller, connections, pluggy } = setup();
      await seedActiveConnection(connections);
      pluggy.addItem(ITEM_ID, { status: 'UPDATED', institutionId: 'inst-1', institutionName: 'Banco Teste' });
      pluggy.addAccounts(ITEM_ID, []);

      const result = await controller.refresh({ id: USER_A } as never, CONNECTION_ID, {});

      expect(result).toBeUndefined();
      expect(pluggy.forceRefreshCalls).toEqual([ITEM_ID]);
      await new Promise((resolve) => setImmediate(resolve));
      const call = pluggy.listTransactionsCalls.at(-1);
      expect(call).toBeUndefined();
    });

    it('passes forceFullSync through to the underlying sync when true', async () => {
      const { controller, connections, pluggy } = setup();
      await seedActiveConnection(connections);
      pluggy.addItem(ITEM_ID, { status: 'UPDATED', institutionId: 'inst-1', institutionName: 'Banco Teste' });
      pluggy.addAccounts(ITEM_ID, [
        {
          id: 'acc-1',
          itemId: ITEM_ID,
          type: 'BANK',
          name: 'Conta corrente',
          number: '1234',
          balance: 100,
          currencyCode: 'BRL',
          creditData: null,
        },
      ]);

      await controller.refresh({ id: USER_A } as never, CONNECTION_ID, { forceFullSync: true });
      await new Promise((resolve) => setImmediate(resolve));

      const call = pluggy.listTransactionsCalls.at(-1);
      expect(call?.accountId).toBe('acc-1');
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      expect(Math.abs(call!.from.getTime() - ninetyDaysAgo.getTime())).toBeLessThan(60_000);
    });
  });

  describe('retryImports', () => {
    it('calls retryConnectionImports.execute and returns the aggregated result', async () => {
      const { controller, connections, importer } = setup();
      await seedActiveConnection(connections);
      const account = LinkedAccount.create({
        id: 'acc-1',
        bankConnectionId: CONNECTION_ID,
        userId: USER_A,
        pluggyAccountId: 'pluggy-acc-1',
        type: 'CHECKING_ACCOUNT',
        displayName: 'Conta corrente',
        balance: '100.00',
      });
      await connections.upsertLinkedAccount(account);
      await connections.upsertSyncedTransaction(
        SyncedTransaction.restore({
          id: 'synced-1',
          linkedAccountId: 'acc-1',
          linkedCreditCardId: null,
          userId: USER_A,
          pluggyTransactionId: 'tx-1',
          description: 'Compra teste',
          amount: '50.00',
          date: new Date('2026-08-01'),
          direction: 'debit',
          pluggyStatus: 'posted',
          installmentNumber: null,
          installmentTotal: null,
          syncStatus: 'error',
          transactionsMsId: null,
          retryCount: 1,
          lastError: 'boom',
          createdAt: new Date('2026-08-01'),
          updatedAt: new Date('2000-01-01T00:00:00Z'),
        }),
      );

      const result = await controller.retryImports({ id: USER_A } as never, CONNECTION_ID);

      expect(result).toEqual({ retried: 1, succeeded: 1, stillFailing: 0 });
      expect(importer.imported).toHaveLength(1);
    });
  });
});
