import { RetryConnectionImportsUseCase } from './retry-connection-imports';
import { RetryFailedImportsUseCase } from '../retry-failed-imports/retry-failed-imports';
import { ConnectionNotFoundError } from '../../../domain/errors';
import { BankConnection } from '../../../domain/bank-connection';
import { LinkedAccount } from '../../../domain/linked-account';
import { LinkedCreditCard } from '../../../domain/linked-credit-card';
import { SyncedTransaction } from '../../../domain/synced-transaction';
import { FakeBankConnectionRepository, FakeTransactionsImporter, USER_A } from '../test-fakes';

function setup() {
  const connections = new FakeBankConnectionRepository();
  const importer = new FakeTransactionsImporter();
  const retryFailedImports = new RetryFailedImportsUseCase(connections, importer);
  const useCase = new RetryConnectionImportsUseCase(connections, retryFailedImports);
  return { useCase, connections, importer };
}

async function seedConnectionWithAccountAndCard(connections: FakeBankConnectionRepository) {
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
  const card = LinkedCreditCard.create({
    id: 'card-1',
    bankConnectionId: 'conn-1',
    userId: USER_A,
    pluggyAccountId: 'pluggy-card-1',
    currentBalance: '-200.00',
  });
  await connections.upsertLinkedCreditCard(card);
  return connection;
}

function erroredTransaction(overrides: {
  id: string;
  pluggyTransactionId: string;
  linkedAccountId: string | null;
  linkedCreditCardId: string | null;
  retryCount: number;
}) {
  return SyncedTransaction.restore({
    id: overrides.id,
    linkedAccountId: overrides.linkedAccountId,
    linkedCreditCardId: overrides.linkedCreditCardId,
    userId: USER_A,
    pluggyTransactionId: overrides.pluggyTransactionId,
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
    updatedAt: new Date('2000-01-01T00:00:00Z'),
  });
}

describe('RetryConnectionImportsUseCase', () => {
  it('retries every errored transaction across both linked accounts and credit cards', async () => {
    const { useCase, connections, importer } = setup();
    await seedConnectionWithAccountAndCard(connections);
    await connections.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-1',
        pluggyTransactionId: 'tx-1',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        retryCount: 1,
      }),
    );
    await connections.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-2',
        pluggyTransactionId: 'tx-2',
        linkedAccountId: null,
        linkedCreditCardId: 'card-1',
        retryCount: 1,
      }),
    );

    const result = await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result).toEqual({ retried: 2, succeeded: 2, stillFailing: 0 });
    expect(importer.imported).toHaveLength(2);
    const tx1 = await connections.findSyncedTransactionByPluggyId(USER_A, 'tx-1');
    const tx2 = await connections.findSyncedTransactionByPluggyId(USER_A, 'tx-2');
    expect(tx1?.syncStatus).toBe('success');
    expect(tx2?.syncStatus).toBe('success');
  });

  it('bypasses the exponential backoff gate (calls retryFailedImports with force: true)', async () => {
    const { useCase, connections, importer } = setup();
    await seedConnectionWithAccountAndCard(connections);
    await connections.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-1',
        pluggyTransactionId: 'tx-1',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        retryCount: 1,
      }),
    );

    const result = await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result.retried).toBe(1);
    expect(importer.imported).toHaveLength(1);
  });

  it('counts a still-failing row as stillFailing without throwing, once the retry limit is reached', async () => {
    const { useCase, connections, importer } = setup();
    await seedConnectionWithAccountAndCard(connections);
    importer.shouldFail = true;
    await connections.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-1',
        pluggyTransactionId: 'tx-1',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        retryCount: 4,
      }),
    );

    const result = await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result).toEqual({ retried: 1, succeeded: 0, stillFailing: 1 });
    const connection = await connections.findById('conn-1', USER_A);
    expect(connection?.status).toBe('needs_attention');
  });

  it('re-throws an error that is not ImportRetriesExhaustedError', async () => {
    const { connections } = setup();
    await seedConnectionWithAccountAndCard(connections);
    await connections.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-1',
        pluggyTransactionId: 'tx-1',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        retryCount: 1,
      }),
    );
    const boom = new Error('unexpected boom');
    const retryFailedImports = { execute: jest.fn().mockRejectedValue(boom) } as unknown as RetryFailedImportsUseCase;
    const useCase = new RetryConnectionImportsUseCase(connections, retryFailedImports);

    await expect(useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' })).rejects.toThrow(boom);
  });

  it('does nothing when there are no errored transactions', async () => {
    const { useCase, connections, importer } = setup();
    await seedConnectionWithAccountAndCard(connections);

    const result = await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result).toEqual({ retried: 0, succeeded: 0, stillFailing: 0 });
    expect(importer.imported).toHaveLength(0);
  });

  it('throws ConnectionNotFoundError for an unknown or another user\'s connection', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ userId: USER_A, bankConnectionId: 'unknown' }),
    ).rejects.toBeInstanceOf(ConnectionNotFoundError);
  });
});
