import { TriggerManualRefreshUseCase } from './trigger-manual-refresh';
import { BankConnection } from '../../../domain/bank-connection';
import { ConnectionNotActiveError, ConnectionNotFoundError } from '../../../domain/errors';
import {
  FakeBankConnectionRepository,
  FakePluggyClient,
  FakeTransactionsImporter,
  USER_A,
} from '../test-fakes';
import { SyncConnectionUseCase } from '../sync-connection/sync-connection';

function setup() {
  const connections = new FakeBankConnectionRepository();
  const pluggy = new FakePluggyClient();
  const importer = new FakeTransactionsImporter();
  const syncConnection = new SyncConnectionUseCase(connections, pluggy, importer);
  const useCase = new TriggerManualRefreshUseCase(connections, pluggy, syncConnection);
  return { useCase, connections, pluggy, importer, syncConnection };
}

async function createConnection(
  connections: FakeBankConnectionRepository,
  status: 'active' | 'needs_attention' | 'disconnected' = 'active',
) {
  const connection = BankConnection.create({
    id: 'conn-1',
    userId: USER_A,
    pluggyItemId: 'item-1',
    institutionId: 'inst-1',
    institutionName: 'Banco Teste',
  });
  if (status === 'disconnected') connection.disconnect();
  if (status === 'needs_attention') connection.markNeedsAttention();
  await connections.create(connection);
  return connection;
}

describe('TriggerManualRefreshUseCase', () => {
  it('force-refreshes the item and triggers a sync for an active connection', async () => {
    const { useCase, connections, pluggy } = setup();
    await createConnection(connections, 'active');
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });

    await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(pluggy.forceRefreshCalls).toEqual(['item-1']);
    const stored = await connections.findById('conn-1', USER_A);
    expect(stored?.lastSyncedAt).not.toBeNull();
  });

  it('throws ConnectionNotActiveError for a disconnected connection', async () => {
    const { useCase, connections, pluggy } = setup();
    await createConnection(connections, 'disconnected');

    await expect(
      useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' }),
    ).rejects.toBeInstanceOf(ConnectionNotActiveError);
    expect(pluggy.forceRefreshCalls).toEqual([]);
  });

  it('throws ConnectionNotFoundError for an unknown or another user\'s connection', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ userId: USER_A, bankConnectionId: 'unknown' }),
    ).rejects.toBeInstanceOf(ConnectionNotFoundError);
  });
});
