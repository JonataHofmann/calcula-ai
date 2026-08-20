import { CompleteConnectionUseCase } from './complete-connection';
import { DuplicateConnectionError } from '../../../domain/errors';
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
  const useCase = new CompleteConnectionUseCase(connections, pluggy, syncConnection);
  return { useCase, connections, pluggy, importer, syncConnection };
}

describe('CompleteConnectionUseCase', () => {
  it('creates an active bank connection using institution data from Pluggy', async () => {
    const { useCase, connections, pluggy } = setup();
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });

    const result = await useCase.execute({ userId: USER_A, pluggyItemId: 'item-1' });

    expect(result.status).toBe('active');
    expect(result.institutionName).toBe('Banco Teste');
    const stored = await connections.findByUserAndItem(USER_A, 'item-1');
    expect(stored?.status).toBe('active');
    expect(stored?.institutionId).toBe('inst-1');
  });

  it('triggers an async sync after creating the connection', async () => {
    const { useCase, connections, pluggy } = setup();
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    pluggy.addAccounts('item-1', [
      {
        id: 'acc-pluggy-1',
        itemId: 'item-1',
        type: 'BANK',
        name: 'Conta corrente',
        number: '1234',
        balance: 100,
        currencyCode: 'BRL',
        creditData: null,
      },
    ]);

    const result = await useCase.execute({ userId: USER_A, pluggyItemId: 'item-1' });
    // sync is fired asynchronously (fire-and-forget) — flush microtasks.
    await new Promise((resolve) => setImmediate(resolve));

    const stored = await connections.findById(result.id, USER_A);
    expect(stored?.lastSyncedAt).not.toBeNull();
    const accounts = await connections.findLinkedAccountsByConnection(result.id);
    expect(accounts).toHaveLength(1);
  });

  it('throws DuplicateConnectionError when (userId, pluggyItemId) already exists', async () => {
    const { useCase, pluggy } = setup();
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });

    await useCase.execute({ userId: USER_A, pluggyItemId: 'item-1' });

    await expect(
      useCase.execute({ userId: USER_A, pluggyItemId: 'item-1' }),
    ).rejects.toBeInstanceOf(DuplicateConnectionError);
  });

  it('allows the same pluggyItemId for a different user', async () => {
    const { useCase, pluggy } = setup();
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    await useCase.execute({ userId: USER_A, pluggyItemId: 'item-1' });

    await expect(
      useCase.execute({ userId: 'user-b', pluggyItemId: 'item-1' }),
    ).resolves.not.toThrow();
  });
});
