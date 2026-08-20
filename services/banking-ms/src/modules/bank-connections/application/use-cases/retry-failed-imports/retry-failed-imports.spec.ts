import { RetryFailedImportsUseCase } from './retry-failed-imports';
import { ImportRetriesExhaustedError } from '../../../domain/errors';
import { BankConnection } from '../../../domain/bank-connection';
import { LinkedAccount } from '../../../domain/linked-account';
import { SyncedTransaction } from '../../../domain/synced-transaction';
import { FakeBankConnectionRepository, FakeTransactionsImporter, USER_A } from '../test-fakes';

function setup() {
  const connections = new FakeBankConnectionRepository();
  const importer = new FakeTransactionsImporter();
  const useCase = new RetryFailedImportsUseCase(connections, importer);
  return { useCase, connections, importer };
}

async function seedConnectionWithAccount(connections: FakeBankConnectionRepository) {
  const connection = BankConnection.create({
    id: 'conn-1',
    userId: USER_A,
    pluggyItemId: 'item-1',
    institutionId: 'inst-1',
    institutionName: 'Banco Teste',
  });
  await connections.create(connection);
  const account = LinkedAccount.create({
    id: 'acc-1',
    bankConnectionId: 'conn-1',
    userId: USER_A,
    pluggyAccountId: 'pluggy-acc-1',
    type: 'CHECKING_ACCOUNT',
    displayName: 'Conta corrente',
    balance: '100.00',
  });
  await connections.upsertLinkedAccount(account);
  return connection;
}

function erroredTransaction(overrides: { retryCount: number; updatedAt: Date }) {
  return SyncedTransaction.restore({
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
    retryCount: overrides.retryCount,
    lastError: 'boom',
    createdAt: new Date('2026-08-01'),
    updatedAt: overrides.updatedAt,
  });
}

describe('RetryFailedImportsUseCase', () => {
  it('skips a row not yet due for retry (exponential backoff)', async () => {
    const { useCase, importer } = setup();
    const now = new Date('2026-08-01T00:05:00Z');
    const synced = erroredTransaction({ retryCount: 1, updatedAt: new Date('2026-08-01T00:00:00Z') });

    await useCase.execute({ synced, now });

    expect(importer.imported).toHaveLength(0);
    expect(synced.syncStatus).toBe('error');
  });

  it('force bypasses the exponential backoff and retries a not-yet-due row', async () => {
    const { useCase, connections, importer } = setup();
    await seedConnectionWithAccount(connections);
    const now = new Date('2026-08-01T00:05:00Z');
    const synced = erroredTransaction({ retryCount: 1, updatedAt: new Date('2026-08-01T00:00:00Z') });

    await useCase.execute({ synced, now, force: true });

    expect(importer.imported).toHaveLength(1);
    expect(synced.syncStatus).toBe('success');
  });

  it('retries a due row and marks it success', async () => {
    const { useCase, connections, importer } = setup();
    await seedConnectionWithAccount(connections);
    const now = new Date('2026-08-01T00:15:00Z');
    const synced = erroredTransaction({ retryCount: 1, updatedAt: new Date('2026-08-01T00:00:00Z') });

    await useCase.execute({ synced, now });

    expect(importer.imported).toHaveLength(1);
    expect(synced.syncStatus).toBe('success');
    const connection = await connections.findById('conn-1', USER_A);
    expect(connection?.status).toBe('active');
  });

  it('stays error and does not flag the connection when still under the retry limit', async () => {
    const { useCase, connections, importer } = setup();
    await seedConnectionWithAccount(connections);
    importer.shouldFail = true;
    const now = new Date('2026-08-01T00:25:00Z');
    const synced = erroredTransaction({ retryCount: 2, updatedAt: new Date('2026-08-01T00:00:00Z') });

    await useCase.execute({ synced, now });

    expect(synced.syncStatus).toBe('error');
    expect(synced.retryCount).toBe(3);
    const connection = await connections.findById('conn-1', USER_A);
    expect(connection?.status).toBe('active');
  });

  it('flags the connection needs_attention and throws once the retry limit is reached', async () => {
    const { useCase, connections, importer } = setup();
    await seedConnectionWithAccount(connections);
    importer.shouldFail = true;
    const now = new Date('2026-08-01T12:00:00Z');
    const synced = erroredTransaction({ retryCount: 4, updatedAt: new Date('2026-08-01T00:00:00Z') });

    await expect(useCase.execute({ synced, now })).rejects.toThrow(ImportRetriesExhaustedError);

    expect(synced.syncStatus).toBe('error');
    expect(synced.retryCount).toBe(5);
    const connection = await connections.findById('conn-1', USER_A);
    expect(connection?.status).toBe('needs_attention');
  });
});
