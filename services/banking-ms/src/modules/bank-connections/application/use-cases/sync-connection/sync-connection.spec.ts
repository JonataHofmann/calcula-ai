import { SyncConnectionUseCase } from './sync-connection';
import { ConnectionNotFoundError } from '../../../domain/errors';
import { BankConnection } from '../../../domain/bank-connection';
import {
  FakeBankConnectionRepository,
  FakePluggyClient,
  FakeTransactionsImporter,
  USER_A,
} from '../test-fakes';

function setup() {
  const connections = new FakeBankConnectionRepository();
  const pluggy = new FakePluggyClient();
  const importer = new FakeTransactionsImporter();
  const useCase = new SyncConnectionUseCase(connections, pluggy, importer);
  return { useCase, connections, pluggy, importer };
}

async function createConnection(connections: FakeBankConnectionRepository) {
  const connection = BankConnection.create({
    id: 'conn-1',
    userId: USER_A,
    pluggyItemId: 'item-1',
    institutionId: 'inst-1',
    institutionName: 'Banco Teste',
  });
  await connections.create(connection);
  return connection;
}

describe('SyncConnectionUseCase', () => {
  it('syncs linked accounts, credit cards, and imports their transactions', async () => {
    const { useCase, connections, pluggy, importer } = setup();
    await createConnection(connections);
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    pluggy.addAccounts('item-1', [
      {
        id: 'acc-1',
        itemId: 'item-1',
        type: 'BANK',
        name: 'Conta corrente',
        number: '1234',
        balance: 100,
        currencyCode: 'BRL',
        creditData: null,
      },
      {
        id: 'card-1',
        itemId: 'item-1',
        type: 'CREDIT',
        name: 'Cartão de crédito',
        number: '**** 5678',
        balance: -200,
        currencyCode: 'BRL',
        creditData: {
          brand: 'Visa',
          creditLimit: 1000,
          availableCreditLimit: 800,
          balanceCloseDate: '2026-08-01',
          balanceDueDate: '2026-08-10',
        },
      },
    ]);
    pluggy.addTransactions('acc-1', [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        description: 'Supermercado',
        amount: 50,
        date: '2026-08-01',
        type: 'DEBIT',
        status: 'POSTED',
        creditCardMetadata: null,
      },
    ]);
    pluggy.addTransactions('card-1', [
      {
        id: 'tx-2',
        accountId: 'card-1',
        description: 'Parcela 1/3',
        amount: 30,
        date: '2026-08-02',
        type: 'DEBIT',
        status: 'PENDING',
        creditCardMetadata: { installmentNumber: 1, totalInstallments: 3 },
      },
    ]);

    const result = await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result.accountsSynced).toBe(1);
    expect(result.creditCardsSynced).toBe(1);
    expect(result.transactionsImported).toBe(2);
    expect(result.transactionsFailed).toBe(0);

    const accounts = await connections.findLinkedAccountsByConnection('conn-1');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].type).toBe('CHECKING_ACCOUNT');
    expect(accounts[0].balance).toBe('100.00');

    const cards = await connections.findLinkedCreditCardsByConnection('conn-1');
    expect(cards).toHaveLength(1);
    expect(cards[0].brand).toBe('Visa');
    expect(cards[0].lastDigits).toBe('5678');
    expect(cards[0].creditLimit).toBe('1000.00');

    expect(importer.imported).toHaveLength(2);
    expect(importer.imported.map((i) => i.type).sort()).toEqual(['expense', 'expense']);

    const stored = await connections.findById('conn-1', USER_A);
    expect(stored?.status).toBe('active');
    expect(stored?.lastSyncedAt).not.toBeNull();
  });

  it('marks the connection as needing attention when Pluggy reports a login error', async () => {
    const { useCase, connections, pluggy } = setup();
    await createConnection(connections);
    pluggy.addItem('item-1', {
      status: 'LOGIN_ERROR',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });

    await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    const stored = await connections.findById('conn-1', USER_A);
    expect(stored?.status).toBe('needs_attention');
  });

  it('transitions a needs_attention connection back to active on a successful reauth sync', async () => {
    const { useCase, connections, pluggy } = setup();
    await connections.create(
      BankConnection.restore({
        id: 'conn-1',
        userId: USER_A,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Teste',
        status: 'needs_attention',
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    pluggy.addAccounts('item-1', []);

    await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    const stored = await connections.findById('conn-1', USER_A);
    expect(stored?.status).toBe('active');
  });

  it('does not create a duplicate linked account on a second sync', async () => {
    const { useCase, connections, pluggy } = setup();
    await createConnection(connections);
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    pluggy.addAccounts('item-1', [
      {
        id: 'acc-1',
        itemId: 'item-1',
        type: 'BANK',
        name: 'Conta corrente',
        number: '1234',
        balance: 100,
        currencyCode: 'BRL',
        creditData: null,
      },
    ]);

    await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });
    const firstId = (await connections.findLinkedAccountsByConnection('conn-1'))[0].id;

    pluggy.addAccounts('item-1', [
      {
        id: 'acc-1',
        itemId: 'item-1',
        type: 'BANK',
        name: 'Conta corrente',
        number: '1234',
        balance: 150,
        currencyCode: 'BRL',
        creditData: null,
      },
    ]);
    await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    const accounts = await connections.findLinkedAccountsByConnection('conn-1');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe(firstId);
    expect(accounts[0].balance).toBe('150.00');
  });

  it('records an import failure without throwing and without blocking other transactions', async () => {
    const { useCase, connections, pluggy, importer } = setup();
    await createConnection(connections);
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    pluggy.addAccounts('item-1', [
      {
        id: 'acc-1',
        itemId: 'item-1',
        type: 'BANK',
        name: 'Conta corrente',
        number: '1234',
        balance: 100,
        currencyCode: 'BRL',
        creditData: null,
      },
    ]);
    pluggy.addTransactions('acc-1', [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        description: 'Supermercado',
        amount: 50,
        date: '2026-08-01',
        type: 'DEBIT',
        status: 'POSTED',
        creditCardMetadata: null,
      },
    ]);
    importer.shouldFail = true;

    const result = await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result.transactionsFailed).toBe(1);
    const synced = await connections.findSyncedTransactionByPluggyId(USER_A, 'tx-1');
    expect(synced?.syncStatus).toBe('error');
    expect(synced?.retryCount).toBe(1);
  });

  it('reconciles an updated transaction in place instead of duplicating it (FR-011)', async () => {
    const { useCase, connections, pluggy, importer } = setup();
    await createConnection(connections);
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    pluggy.addAccounts('item-1', [
      {
        id: 'acc-1',
        itemId: 'item-1',
        type: 'BANK',
        name: 'Conta corrente',
        number: '1234',
        balance: 100,
        currencyCode: 'BRL',
        creditData: null,
      },
    ]);
    pluggy.addTransactions('acc-1', [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        description: 'Supermercado',
        amount: 50,
        date: '2026-08-01',
        type: 'DEBIT',
        status: 'PENDING',
        creditCardMetadata: null,
      },
    ]);
    await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    pluggy.addTransactions('acc-1', [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        description: 'Supermercado Central',
        amount: 55,
        date: '2026-08-01',
        type: 'DEBIT',
        status: 'POSTED',
        creditCardMetadata: null,
      },
    ]);
    const result = await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result.transactionsImported).toBe(0);
    expect(importer.imported).toHaveLength(1);
    expect(importer.updated).toHaveLength(1);
    expect(importer.updated[0]).toMatchObject({
      pluggyTransactionId: 'tx-1',
      description: 'Supermercado Central',
      amount: '55.00',
      pluggyStatus: 'posted',
    });

    const synced = await connections.findSyncedTransactionByPluggyId(USER_A, 'tx-1');
    expect(synced?.syncStatus).toBe('success');
    expect(synced?.description).toBe('Supermercado Central');
    expect(synced?.amount).toBe('55.00');
    expect(synced?.pluggyStatus).toBe('posted');
  });

  it('deletes a synced transaction that no longer appears at the source (FR-011)', async () => {
    const { useCase, connections, pluggy, importer } = setup();
    await createConnection(connections);
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    pluggy.addAccounts('item-1', [
      {
        id: 'acc-1',
        itemId: 'item-1',
        type: 'BANK',
        name: 'Conta corrente',
        number: '1234',
        balance: 100,
        currencyCode: 'BRL',
        creditData: null,
      },
    ]);
    pluggy.addTransactions('acc-1', [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        description: 'Supermercado',
        amount: 50,
        date: '2026-08-01',
        type: 'DEBIT',
        status: 'POSTED',
        creditCardMetadata: null,
      },
    ]);
    await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    pluggy.addTransactions('acc-1', []);
    await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(importer.deleted).toEqual([{ userId: USER_A, pluggyTransactionId: 'tx-1' }]);
    const synced = await connections.findSyncedTransactionByPluggyId(USER_A, 'tx-1');
    expect(synced).toBeNull();
  });

  it('materializes a real Account/CreditCard and links imported transactions to them', async () => {
    const { useCase, connections, pluggy, importer } = setup();
    await createConnection(connections);
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    pluggy.addAccounts('item-1', [
      {
        id: 'acc-1',
        itemId: 'item-1',
        type: 'BANK',
        name: 'Conta corrente',
        number: '1234',
        balance: 100,
        currencyCode: 'BRL',
        creditData: null,
      },
      {
        id: 'card-1',
        itemId: 'item-1',
        type: 'CREDIT',
        name: 'Cartão de crédito',
        number: '**** 5678',
        balance: -200,
        currencyCode: 'BRL',
        creditData: {
          brand: 'Visa',
          creditLimit: 1000,
          availableCreditLimit: 800,
          balanceCloseDate: '2026-08-01',
          balanceDueDate: '2026-08-10',
        },
      },
    ]);
    pluggy.addTransactions('acc-1', [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        description: 'Supermercado',
        amount: 50,
        date: '2026-08-01',
        type: 'DEBIT',
        status: 'POSTED',
        creditCardMetadata: null,
      },
    ]);
    pluggy.addTransactions('card-1', [
      {
        id: 'tx-2',
        accountId: 'card-1',
        description: 'Parcela 1/3',
        amount: 30,
        date: '2026-08-02',
        type: 'DEBIT',
        status: 'PENDING',
        creditCardMetadata: { installmentNumber: 1, totalInstallments: 3 },
      },
    ]);

    await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(importer.createdAccounts).toHaveLength(1);
    expect(importer.createdAccounts[0]).toMatchObject({ name: 'Conta corrente', bankId: 'other', icon: 'landmark', color: 'slate' });
    expect(importer.createdCards).toHaveLength(1);
    expect(importer.createdCards[0]).toMatchObject({ name: 'Cartão de crédito', lastDigits: '5678', brandId: 'visa', limit: '1000.00' });

    const account = (await connections.findLinkedAccountsByConnection('conn-1'))[0];
    const card = (await connections.findLinkedCreditCardsByConnection('conn-1'))[0];
    expect(account.apiAccountId).toBe('api-account-1');
    expect(card.apiCreditCardId).toBe('api-card-1');

    expect(importer.imported).toHaveLength(2);
    const accountTx = importer.imported.find((i) => i.pluggyTransactionId === 'tx-1');
    const cardTx = importer.imported.find((i) => i.pluggyTransactionId === 'tx-2');
    expect(accountTx?.accountId).toBe('api-account-1');
    expect(accountTx?.creditCardId).toBeNull();
    expect(cardTx?.creditCardId).toBe('api-card-1');
    expect(cardTx?.accountId).toBeNull();

    await useCase.execute({ userId: USER_A, bankConnectionId: 'conn-1' });
    expect(importer.createdAccounts).toHaveLength(1);
    expect(importer.createdCards).toHaveLength(1);
  });

  it('throws ConnectionNotFoundError for an unknown or another user\'s connection', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ userId: USER_A, bankConnectionId: 'unknown' }),
    ).rejects.toBeInstanceOf(ConnectionNotFoundError);
  });
});
