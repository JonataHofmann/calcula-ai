import { BankConnectionsService } from './bank-connections.service';
import { BankConnection } from './bank-connection';
import { LinkedAccount } from './linked-account';
import { LinkedCreditCard } from './linked-credit-card';
import { SyncedTransaction } from './synced-transaction';
import {
  ConnectionNotActiveError,
  ConnectionNotFoundError,
  DuplicateConnectionError,
  ImportRetriesExhaustedError,
} from './errors';
import {
  FakePluggyClient,
  FakeTransactionsImporter,
  makeAccountRepo,
  makeCardRepo,
  makeConnectionRepo,
  makeTransactionRepo,
  USER_A,
} from './__testing__/in-memory-repositories';

const USER_B = 'user-b';

function setup() {
  const pluggy = new FakePluggyClient();
  const importer = new FakeTransactionsImporter();
  const service = new BankConnectionsService(
    makeConnectionRepo(),
    makeAccountRepo(),
    makeCardRepo(),
    makeTransactionRepo(),
    pluggy,
    importer,
  );
  return { service, pluggy, importer };
}

// ---------------------------------------------------------------------------
// createConnectToken
// ---------------------------------------------------------------------------

describe('BankConnectionsService.createConnectToken', () => {
  it('creates a connect token with no itemId for mode "create"', async () => {
    const { service, pluggy } = setup();
    const result = await service.createConnectToken({ userId: USER_A, mode: 'create' });
    expect(result.connectToken).toBe('fake-connect-token');
    expect(pluggy.connectTokenCalls).toEqual([{ itemId: undefined }]);
  });

  it('creates a connect token scoped to the existing itemId for mode "reauth"', async () => {
    const { service, pluggy } = setup();
    await service.create(
      BankConnection.create({
        id: 'conn-1',
        userId: USER_A,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Teste',
      }),
    );

    const result = await service.createConnectToken({
      userId: USER_A,
      mode: 'reauth',
      bankConnectionId: 'conn-1',
    });

    expect(result.connectToken).toBe('fake-connect-token');
    expect(pluggy.connectTokenCalls).toEqual([{ itemId: 'item-1' }]);
  });

  it('throws ConnectionNotFoundError for reauth on an unknown connection', async () => {
    const { service } = setup();
    await expect(
      service.createConnectToken({ userId: USER_A, mode: 'reauth', bankConnectionId: 'unknown' }),
    ).rejects.toBeInstanceOf(ConnectionNotFoundError);
  });

  it("throws ConnectionNotFoundError for reauth on another user's connection", async () => {
    const { service } = setup();
    await service.create(
      BankConnection.create({
        id: 'conn-1',
        userId: USER_B,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Teste',
      }),
    );

    await expect(
      service.createConnectToken({ userId: USER_A, mode: 'reauth', bankConnectionId: 'conn-1' }),
    ).rejects.toBeInstanceOf(ConnectionNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// completeConnection
// ---------------------------------------------------------------------------

describe('BankConnectionsService.completeConnection', () => {
  it('creates an active bank connection using institution data from Pluggy', async () => {
    const { service, pluggy } = setup();
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });

    const result = await service.completeConnection({ userId: USER_A, pluggyItemId: 'item-1' });

    expect(result.status).toBe('active');
    expect(result.institutionName).toBe('Banco Teste');
    const stored = await service.findByUserAndItem(USER_A, 'item-1');
    expect(stored?.status).toBe('active');
    expect(stored?.institutionId).toBe('inst-1');
  });

  it('triggers an async sync after creating the connection', async () => {
    const { service, pluggy } = setup();
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

    const result = await service.completeConnection({ userId: USER_A, pluggyItemId: 'item-1' });
    // sync is fired asynchronously (fire-and-forget) — flush microtasks.
    await new Promise((resolve) => setImmediate(resolve));

    const stored = await service.findById(result.id, USER_A);
    expect(stored?.lastSyncedAt).not.toBeNull();
    const accounts = await service.findLinkedAccountsByConnection(result.id);
    expect(accounts).toHaveLength(1);
  });

  it('throws DuplicateConnectionError when (userId, pluggyItemId) already exists', async () => {
    const { service, pluggy } = setup();
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });

    await service.completeConnection({ userId: USER_A, pluggyItemId: 'item-1' });

    await expect(
      service.completeConnection({ userId: USER_A, pluggyItemId: 'item-1' }),
    ).rejects.toBeInstanceOf(DuplicateConnectionError);
  });

  it('allows the same pluggyItemId for a different user', async () => {
    const { service, pluggy } = setup();
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    await service.completeConnection({ userId: USER_A, pluggyItemId: 'item-1' });

    await expect(
      service.completeConnection({ userId: USER_B, pluggyItemId: 'item-1' }),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// listConnections
// ---------------------------------------------------------------------------

describe('BankConnectionsService.listConnections', () => {
  it('returns connections for the given user with nested accounts and credit cards', async () => {
    const { service } = setup();
    await service.create(
      BankConnection.restore({
        id: 'conn-1',
        userId: USER_A,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Fake',
        status: 'active',
        lastSyncedAt: new Date('2026-08-01T00:00:00Z'),
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
      }),
    );
    await service.upsertLinkedAccount(
      LinkedAccount.create({
        id: 'acc-1',
        bankConnectionId: 'conn-1',
        userId: USER_A,
        pluggyAccountId: 'pacc-1',
        type: 'CHECKING_ACCOUNT',
        displayName: 'Conta Corrente',
        balance: '150.50',
      }),
    );
    await service.upsertLinkedCreditCard(
      LinkedCreditCard.create({
        id: 'card-1',
        bankConnectionId: 'conn-1',
        userId: USER_A,
        pluggyAccountId: 'pacc-2',
        brand: null,
        lastDigits: null,
        creditLimit: null,
        currentBalance: '320.00',
      }),
    );

    const result = await service.listConnections({ userId: USER_A });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'conn-1',
      institutionName: 'Banco Fake',
      status: 'active',
    });
    expect(result[0].accounts).toHaveLength(1);
    expect(result[0].accounts[0]).toMatchObject({ id: 'acc-1', balance: '150.50' });
    expect(result[0].creditCards).toHaveLength(1);
    expect(result[0].creditCards[0]).toMatchObject({
      id: 'card-1',
      brand: null,
      lastDigits: null,
      creditLimit: null,
    });
  });

  it('does not leak connections belonging to other users', async () => {
    const { service } = setup();
    await service.create(
      BankConnection.restore({
        id: 'conn-2',
        userId: USER_B,
        pluggyItemId: 'item-2',
        institutionId: 'inst-2',
        institutionName: 'Outro Banco',
        status: 'active',
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const result = await service.listConnections({ userId: USER_A });

    expect(result).toEqual([]);
  });

  it('returns an empty array when the user has no connections', async () => {
    const { service } = setup();
    const result = await service.listConnections({ userId: USER_A });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// disconnectConnection
// ---------------------------------------------------------------------------

describe('BankConnectionsService.disconnectConnection', () => {
  it('marks an active connection as disconnected', async () => {
    const { service } = setup();
    await service.create(
      BankConnection.restore({
        id: 'conn-1',
        userId: USER_A,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Fake',
        status: 'active',
        lastSyncedAt: new Date('2026-08-01T00:00:00Z'),
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
      }),
    );

    await service.disconnectConnection({ id: 'conn-1', userId: USER_A });

    const stored = await service.findById('conn-1', USER_A);
    expect(stored?.toProps().status).toBe('disconnected');
  });

  it('is idempotent when the connection is already disconnected', async () => {
    const { service } = setup();
    await service.create(
      BankConnection.restore({
        id: 'conn-1',
        userId: USER_A,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Fake',
        status: 'disconnected',
        lastSyncedAt: null,
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-01T00:00:00Z'),
      }),
    );

    await expect(
      service.disconnectConnection({ id: 'conn-1', userId: USER_A }),
    ).resolves.toBeUndefined();
    const stored = await service.findById('conn-1', USER_A);
    expect(stored?.toProps().status).toBe('disconnected');
  });

  it('throws ConnectionNotFoundError when the connection does not belong to the user', async () => {
    const { service } = setup();
    await service.create(
      BankConnection.restore({
        id: 'conn-2',
        userId: USER_B,
        pluggyItemId: 'item-2',
        institutionId: 'inst-2',
        institutionName: 'Outro Banco',
        status: 'active',
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await expect(service.disconnectConnection({ id: 'conn-2', userId: USER_A })).rejects.toThrow(
      ConnectionNotFoundError,
    );
  });

  it('throws ConnectionNotFoundError when the connection does not exist', async () => {
    const { service } = setup();
    await expect(service.disconnectConnection({ id: 'missing', userId: USER_A })).rejects.toThrow(
      ConnectionNotFoundError,
    );
  });
});

// ---------------------------------------------------------------------------
// triggerManualRefresh
// ---------------------------------------------------------------------------

describe('BankConnectionsService.triggerManualRefresh', () => {
  async function createConnection(
    service: BankConnectionsService,
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
    await service.create(connection);
    return connection;
  }

  it('force-refreshes the item and triggers a sync for an active connection', async () => {
    const { service, pluggy } = setup();
    await createConnection(service, 'active');
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });

    await service.triggerManualRefresh({ userId: USER_A, bankConnectionId: 'conn-1' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(pluggy.forceRefreshCalls).toEqual(['item-1']);
    const stored = await service.findById('conn-1', USER_A);
    expect(stored?.lastSyncedAt).not.toBeNull();
  });

  it('throws ConnectionNotActiveError for a disconnected connection', async () => {
    const { service, pluggy } = setup();
    await createConnection(service, 'disconnected');

    await expect(
      service.triggerManualRefresh({ userId: USER_A, bankConnectionId: 'conn-1' }),
    ).rejects.toBeInstanceOf(ConnectionNotActiveError);
    expect(pluggy.forceRefreshCalls).toEqual([]);
  });

  it("throws ConnectionNotFoundError for an unknown or another user's connection", async () => {
    const { service } = setup();
    await expect(
      service.triggerManualRefresh({ userId: USER_A, bankConnectionId: 'unknown' }),
    ).rejects.toBeInstanceOf(ConnectionNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// syncConnection
// ---------------------------------------------------------------------------

describe('BankConnectionsService.syncConnection', () => {
  async function createConnection(service: BankConnectionsService) {
    const connection = BankConnection.create({
      id: 'conn-1',
      userId: USER_A,
      pluggyItemId: 'item-1',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    await service.create(connection);
    return connection;
  }

  it('syncs linked accounts, credit cards, and imports their transactions', async () => {
    const { service, pluggy, importer } = setup();
    await createConnection(service);
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

    const result = await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result.accountsSynced).toBe(1);
    expect(result.creditCardsSynced).toBe(1);
    expect(result.transactionsImported).toBe(2);
    expect(result.transactionsFailed).toBe(0);

    const accounts = await service.findLinkedAccountsByConnection('conn-1');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].type).toBe('CHECKING_ACCOUNT');
    expect(accounts[0].balance).toBe('100.00');

    const cards = await service.findLinkedCreditCardsByConnection('conn-1');
    expect(cards).toHaveLength(1);
    expect(cards[0].brand).toBe('Visa');
    expect(cards[0].lastDigits).toBe('5678');
    expect(cards[0].creditLimit).toBe('1000.00');

    expect(importer.imported).toHaveLength(2);
    expect(importer.imported.map((i) => i.type).sort()).toEqual(['expense', 'expense']);

    const stored = await service.findById('conn-1', USER_A);
    expect(stored?.status).toBe('active');
    expect(stored?.lastSyncedAt).not.toBeNull();
  });

  it('marks the connection as needing attention when Pluggy reports a login error', async () => {
    const { service, pluggy } = setup();
    await createConnection(service);
    pluggy.addItem('item-1', {
      status: 'LOGIN_ERROR',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });

    await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });

    const stored = await service.findById('conn-1', USER_A);
    expect(stored?.status).toBe('needs_attention');
  });

  it('transitions a needs_attention connection back to active on a successful reauth sync', async () => {
    const { service, pluggy } = setup();
    await service.create(
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

    await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });

    const stored = await service.findById('conn-1', USER_A);
    expect(stored?.status).toBe('active');
  });

  it('does not create a duplicate linked account on a second sync', async () => {
    const { service, pluggy } = setup();
    await createConnection(service);
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

    await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });
    const firstId = (await service.findLinkedAccountsByConnection('conn-1'))[0].id;

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
    await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });

    const accounts = await service.findLinkedAccountsByConnection('conn-1');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe(firstId);
    expect(accounts[0].balance).toBe('150.00');
  });

  it('records an import failure without throwing and without blocking other transactions', async () => {
    const { service, pluggy, importer } = setup();
    await createConnection(service);
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

    const result = await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result.transactionsFailed).toBe(1);
    const synced = await service.findSyncedTransactionByPluggyId(USER_A, 'tx-1');
    expect(synced?.syncStatus).toBe('error');
    expect(synced?.retryCount).toBe(1);
  });

  it('reconciles an updated transaction in place instead of duplicating it (FR-011)', async () => {
    const { service, pluggy, importer } = setup();
    await createConnection(service);
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
    await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });

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
    const result = await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result.transactionsImported).toBe(0);
    expect(importer.imported).toHaveLength(1);
    expect(importer.updated).toHaveLength(1);
    expect(importer.updated[0]).toMatchObject({
      pluggyTransactionId: 'tx-1',
      description: 'Supermercado Central',
      amount: '55.00',
      pluggyStatus: 'posted',
    });

    const synced = await service.findSyncedTransactionByPluggyId(USER_A, 'tx-1');
    expect(synced?.syncStatus).toBe('success');
    expect(synced?.description).toBe('Supermercado Central');
    expect(synced?.amount).toBe('55.00');
    expect(synced?.pluggyStatus).toBe('posted');
  });

  it('deletes a synced transaction that no longer appears at the source (FR-011)', async () => {
    const { service, pluggy, importer } = setup();
    await createConnection(service);
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
    await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });

    pluggy.addTransactions('acc-1', []);
    await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(importer.deleted).toEqual([{ userId: USER_A, pluggyTransactionId: 'tx-1' }]);
    const synced = await service.findSyncedTransactionByPluggyId(USER_A, 'tx-1');
    expect(synced).toBeNull();
  });

  it('materializes a real Account/CreditCard and links imported transactions to them', async () => {
    const { service, pluggy, importer } = setup();
    await createConnection(service);
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

    await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(importer.createdAccounts).toHaveLength(1);
    expect(importer.createdAccounts[0]).toMatchObject({
      name: 'Conta corrente',
      bankId: 'other',
      icon: 'landmark',
      color: 'slate',
    });
    expect(importer.createdCards).toHaveLength(1);
    expect(importer.createdCards[0]).toMatchObject({
      name: 'Cartão de crédito',
      lastDigits: '5678',
      brandId: 'visa',
      limit: '1000.00',
    });

    const account = (await service.findLinkedAccountsByConnection('conn-1'))[0];
    const card = (await service.findLinkedCreditCardsByConnection('conn-1'))[0];
    expect(account.apiAccountId).toBe('api-account-1');
    expect(card.apiCreditCardId).toBe('api-card-1');

    expect(importer.imported).toHaveLength(2);
    const accountTx = importer.imported.find((i) => i.pluggyTransactionId === 'tx-1');
    const cardTx = importer.imported.find((i) => i.pluggyTransactionId === 'tx-2');
    expect(accountTx?.accountId).toBe('api-account-1');
    expect(accountTx?.creditCardId).toBeNull();
    expect(cardTx?.creditCardId).toBe('api-card-1');
    expect(cardTx?.accountId).toBeNull();

    await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });
    expect(importer.createdAccounts).toHaveLength(1);
    expect(importer.createdCards).toHaveLength(1);
  });

  it('forceFullSync ignores lastSyncedAt and re-pulls the full lookback window', async () => {
    const { service, pluggy } = setup();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    await service.create(
      BankConnection.restore({
        id: 'conn-1',
        userId: USER_A,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Teste',
        status: 'active',
        lastSyncedAt: fiveDaysAgo,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
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

    await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1', forceFullSync: true });

    const call = pluggy.listTransactionsCalls.at(-1);
    expect(call?.accountId).toBe('acc-1');
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    expect(call!.from.getTime()).toBeLessThan(fiveDaysAgo.getTime());
    expect(Math.abs(call!.from.getTime() - ninetyDaysAgo.getTime())).toBeLessThan(60_000);
  });

  it('normalizes a 0 or incomplete installment pair from Pluggy to null (avoids domain rejection)', async () => {
    const { service, pluggy, importer } = setup();
    await createConnection(service);
    pluggy.addItem('item-1', {
      status: 'UPDATED',
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
    });
    pluggy.addAccounts('item-1', [
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
    pluggy.addTransactions('card-1', [
      {
        id: 'tx-zero',
        accountId: 'card-1',
        description: 'Compra à vista',
        amount: 30,
        date: '2026-08-02',
        type: 'DEBIT',
        status: 'POSTED',
        creditCardMetadata: { installmentNumber: 0, totalInstallments: 0 },
      },
      {
        id: 'tx-partial',
        accountId: 'card-1',
        description: 'Pagamento fatura',
        amount: 200,
        date: '2026-08-03',
        type: 'CREDIT',
        status: 'POSTED',
        creditCardMetadata: { installmentNumber: 1, totalInstallments: null },
      },
      {
        id: 'tx-out-of-range',
        accountId: 'card-1',
        description: 'Compra parcelada renegociada',
        amount: 90,
        date: '2026-08-04',
        type: 'DEBIT',
        status: 'POSTED',
        creditCardMetadata: { installmentNumber: 13, totalInstallments: 12 },
      },
    ]);

    const result = await service.syncConnection({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result.transactionsFailed).toBe(0);
    expect(importer.imported).toHaveLength(3);
    const zeroTx = importer.imported.find((i) => i.pluggyTransactionId === 'tx-zero');
    const partialTx = importer.imported.find((i) => i.pluggyTransactionId === 'tx-partial');
    const outOfRangeTx = importer.imported.find((i) => i.pluggyTransactionId === 'tx-out-of-range');
    expect(zeroTx).toMatchObject({ installmentNumber: null, installmentCount: null });
    expect(partialTx).toMatchObject({ installmentNumber: null, installmentCount: null });
    expect(outOfRangeTx).toMatchObject({ installmentNumber: null, installmentCount: null });
  });

  it("throws ConnectionNotFoundError for an unknown or another user's connection", async () => {
    const { service } = setup();
    await expect(
      service.syncConnection({ userId: USER_A, bankConnectionId: 'unknown' }),
    ).rejects.toBeInstanceOf(ConnectionNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// retryFailedImports
// ---------------------------------------------------------------------------

describe('BankConnectionsService.retryFailedImports', () => {
  async function seedConnectionWithAccount(service: BankConnectionsService) {
    await service.create(
      BankConnection.create({
        id: 'conn-1',
        userId: USER_A,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Teste',
      }),
    );
    await service.upsertLinkedAccount(
      LinkedAccount.create({
        id: 'acc-1',
        bankConnectionId: 'conn-1',
        userId: USER_A,
        pluggyAccountId: 'pluggy-acc-1',
        type: 'CHECKING_ACCOUNT',
        displayName: 'Conta corrente',
        balance: '100.00',
      }),
    );
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

  it('skips a row not yet due for retry (exponential backoff)', async () => {
    const { service, importer } = setup();
    const now = new Date('2026-08-01T00:05:00Z');
    const synced = erroredTransaction({ retryCount: 1, updatedAt: new Date('2026-08-01T00:00:00Z') });

    await service.retryFailedImports({ synced, now });

    expect(importer.imported).toHaveLength(0);
    expect(synced.syncStatus).toBe('error');
  });

  it('force bypasses the exponential backoff and retries a not-yet-due row', async () => {
    const { service, importer } = setup();
    await seedConnectionWithAccount(service);
    const now = new Date('2026-08-01T00:05:00Z');
    const synced = erroredTransaction({ retryCount: 1, updatedAt: new Date('2026-08-01T00:00:00Z') });

    await service.retryFailedImports({ synced, now, force: true });

    expect(importer.imported).toHaveLength(1);
    expect(synced.syncStatus).toBe('success');
  });

  it('retries a due row and marks it success', async () => {
    const { service, importer } = setup();
    await seedConnectionWithAccount(service);
    const now = new Date('2026-08-01T00:15:00Z');
    const synced = erroredTransaction({ retryCount: 1, updatedAt: new Date('2026-08-01T00:00:00Z') });

    await service.retryFailedImports({ synced, now });

    expect(importer.imported).toHaveLength(1);
    expect(synced.syncStatus).toBe('success');
    const connection = await service.findById('conn-1', USER_A);
    expect(connection?.status).toBe('active');
  });

  it('stays error and does not flag the connection when still under the retry limit', async () => {
    const { service, importer } = setup();
    await seedConnectionWithAccount(service);
    importer.shouldFail = true;
    const now = new Date('2026-08-01T00:25:00Z');
    const synced = erroredTransaction({ retryCount: 2, updatedAt: new Date('2026-08-01T00:00:00Z') });

    await service.retryFailedImports({ synced, now });

    expect(synced.syncStatus).toBe('error');
    expect(synced.retryCount).toBe(3);
    const connection = await service.findById('conn-1', USER_A);
    expect(connection?.status).toBe('active');
  });

  it('flags the connection needs_attention and throws once the retry limit is reached', async () => {
    const { service, importer } = setup();
    await seedConnectionWithAccount(service);
    importer.shouldFail = true;
    const now = new Date('2026-08-01T12:00:00Z');
    const synced = erroredTransaction({ retryCount: 4, updatedAt: new Date('2026-08-01T00:00:00Z') });

    await expect(service.retryFailedImports({ synced, now })).rejects.toThrow(
      ImportRetriesExhaustedError,
    );

    expect(synced.syncStatus).toBe('error');
    expect(synced.retryCount).toBe(5);
    const connection = await service.findById('conn-1', USER_A);
    expect(connection?.status).toBe('needs_attention');
  });
});

// ---------------------------------------------------------------------------
// retryConnectionImports
// ---------------------------------------------------------------------------

describe('BankConnectionsService.retryConnectionImports', () => {
  async function seedConnectionWithAccountAndCard(service: BankConnectionsService) {
    await service.create(
      BankConnection.create({
        id: 'conn-1',
        userId: USER_A,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Teste',
      }),
    );
    await service.upsertLinkedAccount(
      LinkedAccount.create({
        id: 'acc-1',
        bankConnectionId: 'conn-1',
        userId: USER_A,
        pluggyAccountId: 'pluggy-acc-1',
        type: 'CHECKING_ACCOUNT',
        displayName: 'Conta corrente',
        balance: '100.00',
      }),
    );
    await service.upsertLinkedCreditCard(
      LinkedCreditCard.create({
        id: 'card-1',
        bankConnectionId: 'conn-1',
        userId: USER_A,
        pluggyAccountId: 'pluggy-card-1',
        currentBalance: '-200.00',
      }),
    );
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

  it('retries every errored transaction across both linked accounts and credit cards', async () => {
    const { service, importer } = setup();
    await seedConnectionWithAccountAndCard(service);
    await service.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-1',
        pluggyTransactionId: 'tx-1',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        retryCount: 1,
      }),
    );
    await service.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-2',
        pluggyTransactionId: 'tx-2',
        linkedAccountId: null,
        linkedCreditCardId: 'card-1',
        retryCount: 1,
      }),
    );

    const result = await service.retryConnectionImports({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result).toEqual({ retried: 2, succeeded: 2, stillFailing: 0 });
    expect(importer.imported).toHaveLength(2);
    const tx1 = await service.findSyncedTransactionByPluggyId(USER_A, 'tx-1');
    const tx2 = await service.findSyncedTransactionByPluggyId(USER_A, 'tx-2');
    expect(tx1?.syncStatus).toBe('success');
    expect(tx2?.syncStatus).toBe('success');
  });

  it('bypasses the exponential backoff gate (calls retryFailedImports with force: true)', async () => {
    const { service, importer } = setup();
    await seedConnectionWithAccountAndCard(service);
    await service.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-1',
        pluggyTransactionId: 'tx-1',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        retryCount: 1,
      }),
    );

    const result = await service.retryConnectionImports({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result.retried).toBe(1);
    expect(importer.imported).toHaveLength(1);
  });

  it('counts a still-failing row as stillFailing without throwing, once the retry limit is reached', async () => {
    const { service, importer } = setup();
    await seedConnectionWithAccountAndCard(service);
    importer.shouldFail = true;
    await service.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-1',
        pluggyTransactionId: 'tx-1',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        retryCount: 4,
      }),
    );

    const result = await service.retryConnectionImports({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result).toEqual({ retried: 1, succeeded: 0, stillFailing: 1 });
    const connection = await service.findById('conn-1', USER_A);
    expect(connection?.status).toBe('needs_attention');
  });

  it('re-throws an error that is not ImportRetriesExhaustedError', async () => {
    const { service } = setup();
    await seedConnectionWithAccountAndCard(service);
    await service.upsertSyncedTransaction(
      erroredTransaction({
        id: 'synced-1',
        pluggyTransactionId: 'tx-1',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        retryCount: 1,
      }),
    );
    const boom = new Error('unexpected boom');
    jest.spyOn(service, 'retryFailedImports').mockRejectedValue(boom);

    await expect(
      service.retryConnectionImports({ userId: USER_A, bankConnectionId: 'conn-1' }),
    ).rejects.toThrow(boom);
  });

  it('does nothing when there are no errored transactions', async () => {
    const { service, importer } = setup();
    await seedConnectionWithAccountAndCard(service);

    const result = await service.retryConnectionImports({ userId: USER_A, bankConnectionId: 'conn-1' });

    expect(result).toEqual({ retried: 0, succeeded: 0, stillFailing: 0 });
    expect(importer.imported).toHaveLength(0);
  });

  it("throws ConnectionNotFoundError for an unknown or another user's connection", async () => {
    const { service } = setup();
    await expect(
      service.retryConnectionImports({ userId: USER_A, bankConnectionId: 'unknown' }),
    ).rejects.toBeInstanceOf(ConnectionNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// countSyncedTransactions (folded from the former TypeOrmBankConnectionRepository spec)
// ---------------------------------------------------------------------------

describe('BankConnectionsService.countSyncedTransactions', () => {
  function syncedTransaction(overrides: {
    id: string;
    pluggyTransactionId: string;
    linkedAccountId: string | null;
    linkedCreditCardId: string | null;
    syncStatus: 'success' | 'error' | 'pending';
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
      syncStatus: overrides.syncStatus,
      transactionsMsId: overrides.syncStatus === 'success' ? 'tx-ms-1' : null,
      retryCount: overrides.syncStatus === 'error' ? 1 : 0,
      lastError: overrides.syncStatus === 'error' ? 'boom' : null,
      createdAt: new Date('2026-08-01'),
      updatedAt: new Date('2026-08-01'),
    });
  }

  it('counts synced transactions across both linked accounts and credit cards, filtering errored', async () => {
    const { service } = setup();
    await service.create(
      BankConnection.create({
        id: 'conn-1',
        userId: USER_A,
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Teste',
      }),
    );
    await service.upsertLinkedAccount(
      LinkedAccount.create({
        id: 'acc-1',
        bankConnectionId: 'conn-1',
        userId: USER_A,
        pluggyAccountId: 'pluggy-acc-1',
        type: 'CHECKING_ACCOUNT',
        displayName: 'Conta corrente',
        balance: '100.00',
      }),
    );
    await service.upsertLinkedCreditCard(
      LinkedCreditCard.create({
        id: 'card-1',
        bankConnectionId: 'conn-1',
        userId: USER_A,
        pluggyAccountId: 'pluggy-card-1',
        currentBalance: '-200.00',
      }),
    );

    await service.upsertSyncedTransaction(
      syncedTransaction({
        id: 'synced-1',
        pluggyTransactionId: 'tx-1',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        syncStatus: 'success',
      }),
    );
    await service.upsertSyncedTransaction(
      syncedTransaction({
        id: 'synced-2',
        pluggyTransactionId: 'tx-2',
        linkedAccountId: null,
        linkedCreditCardId: 'card-1',
        syncStatus: 'error',
      }),
    );
    await service.upsertSyncedTransaction(
      syncedTransaction({
        id: 'synced-3',
        pluggyTransactionId: 'tx-3',
        linkedAccountId: 'acc-1',
        linkedCreditCardId: null,
        syncStatus: 'error',
      }),
    );

    const counts = await service.countSyncedTransactions('conn-1');

    expect(counts).toEqual({ total: 3, errored: 2 });
  });

  it('excludes transactions belonging to a different connection', async () => {
    const { service } = setup();
    await service.create(
      BankConnection.create({
        id: 'conn-a',
        userId: USER_A,
        pluggyItemId: 'item-a',
        institutionId: 'inst-a',
        institutionName: 'Banco A',
      }),
    );
    await service.create(
      BankConnection.create({
        id: 'conn-b',
        userId: USER_A,
        pluggyItemId: 'item-b',
        institutionId: 'inst-b',
        institutionName: 'Banco B',
      }),
    );
    await service.upsertLinkedAccount(
      LinkedAccount.create({
        id: 'acc-a',
        bankConnectionId: 'conn-a',
        userId: USER_A,
        pluggyAccountId: 'pluggy-acc-a',
        type: 'CHECKING_ACCOUNT',
        displayName: 'Conta A',
        balance: '100.00',
      }),
    );
    await service.upsertLinkedAccount(
      LinkedAccount.create({
        id: 'acc-b',
        bankConnectionId: 'conn-b',
        userId: USER_A,
        pluggyAccountId: 'pluggy-acc-b',
        type: 'CHECKING_ACCOUNT',
        displayName: 'Conta B',
        balance: '100.00',
      }),
    );

    await service.upsertSyncedTransaction(
      syncedTransaction({
        id: 'synced-a',
        pluggyTransactionId: 'tx-a',
        linkedAccountId: 'acc-a',
        linkedCreditCardId: null,
        syncStatus: 'error',
      }),
    );
    await service.upsertSyncedTransaction(
      syncedTransaction({
        id: 'synced-b',
        pluggyTransactionId: 'tx-b',
        linkedAccountId: 'acc-b',
        linkedCreditCardId: null,
        syncStatus: 'error',
      }),
    );

    const counts = await service.countSyncedTransactions('conn-a');

    expect(counts).toEqual({ total: 1, errored: 1 });
  });

  it('returns zero counts for a connection with no synced transactions', async () => {
    const { service } = setup();
    await service.create(
      BankConnection.create({
        id: 'conn-empty',
        userId: USER_A,
        pluggyItemId: 'item-empty',
        institutionId: 'inst-empty',
        institutionName: 'Banco Vazio',
      }),
    );

    const counts = await service.countSyncedTransactions('conn-empty');

    expect(counts).toEqual({ total: 0, errored: 0 });
  });
});

// ---------------------------------------------------------------------------
// syncStaleConnections (folded from the former DailySyncJob integration spec)
// ---------------------------------------------------------------------------

describe('BankConnectionsService.syncStaleConnections', () => {
  function makeConnection(overrides: {
    id: string;
    pluggyItemId: string;
    status?: 'active' | 'needs_attention' | 'disconnected';
    lastSyncedAt: Date | null;
  }) {
    return BankConnection.restore({
      id: overrides.id,
      userId: USER_A,
      pluggyItemId: overrides.pluggyItemId,
      institutionId: 'inst-1',
      institutionName: 'Banco Teste',
      status: overrides.status ?? 'active',
      lastSyncedAt: overrides.lastSyncedAt,
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    });
  }

  it('only force-refreshes active connections never synced or stale beyond the threshold', async () => {
    const { service, pluggy } = setup();
    const now = Date.now();
    await service.save(makeConnection({ id: 'conn-never', pluggyItemId: 'item-never', lastSyncedAt: null }));
    await service.save(
      makeConnection({
        id: 'conn-stale',
        pluggyItemId: 'item-stale',
        lastSyncedAt: new Date(now - 21 * 60 * 60 * 1000),
      }),
    );
    await service.save(
      makeConnection({
        id: 'conn-fresh',
        pluggyItemId: 'item-fresh',
        lastSyncedAt: new Date(now - 1 * 60 * 60 * 1000),
      }),
    );
    await service.save(
      makeConnection({
        id: 'conn-attention',
        pluggyItemId: 'item-attention',
        status: 'needs_attention',
        lastSyncedAt: null,
      }),
    );

    for (const item of ['item-never', 'item-stale', 'item-fresh', 'item-attention']) {
      pluggy.addItem(item, { status: 'UPDATED', institutionId: 'inst-1', institutionName: 'Banco Teste' });
    }

    await service.syncStaleConnections();

    expect(pluggy.forceRefreshCalls.sort()).toEqual(['item-never', 'item-stale']);
  });
});
