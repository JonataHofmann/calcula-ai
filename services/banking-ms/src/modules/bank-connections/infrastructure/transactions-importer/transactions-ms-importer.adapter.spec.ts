import { TransactionsMsImporterAdapter } from './transactions-ms-importer.adapter';

const BASE_URL = 'https://api.example.test';
const TOKEN_URL = 'https://keycloak.example.test/token';

function tokenResponse(accessToken = 'fake-token', expiresIn = 300) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: accessToken, expires_in: expiresIn }),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: true, status, json: async () => body };
}

describe('TransactionsMsImporterAdapter', () => {
  let fetchMock: jest.Mock;
  let adapter: TransactionsMsImporterAdapter;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    adapter = new TransactionsMsImporterAdapter(BASE_URL, TOKEN_URL, 'client-id', 'client-secret');
  });

  it('fetches a Keycloak token before the first request and reuses it on subsequent calls', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ id: 'api-account-1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'api-account-2' }));

    await adapter.createSyncedAccount({
      userId: 'user-a',
      pluggyAccountId: 'acc-1',
      name: 'Conta',
      bankId: 'other',
      icon: 'landmark',
      color: 'slate',
    });
    await adapter.createSyncedAccount({
      userId: 'user-a',
      pluggyAccountId: 'acc-2',
      name: 'Conta 2',
      bankId: 'other',
      icon: 'landmark',
      color: 'slate',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(TOKEN_URL);
  });

  it('createSyncedAccount posts to /accounts/synced-create with an account-scoped idempotency key', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ id: 'api-account-1' }));

    const result = await adapter.createSyncedAccount({
      userId: 'user-a',
      pluggyAccountId: 'acc-1',
      name: 'Conta corrente',
      bankId: 'other',
      icon: 'landmark',
      color: 'slate',
    });

    expect(result).toEqual({ id: 'api-account-1' });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${BASE_URL}/accounts/synced-create`);
    expect(init.method).toBe('POST');
    expect(init.headers['Idempotency-Key']).toBe('banking-ms:account:acc-1');
    expect(init.headers.Authorization).toBe('Bearer fake-token');
    expect(JSON.parse(init.body)).toEqual({
      userId: 'user-a',
      name: 'Conta corrente',
      bankId: 'other',
      icon: 'landmark',
      color: 'slate',
    });
  });

  it('createSyncedCard posts to /cards/synced-create with a card-scoped idempotency key', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ id: 'api-card-1' }));

    const result = await adapter.createSyncedCard({
      userId: 'user-a',
      pluggyAccountId: 'card-1',
      name: 'Cartão de crédito',
      lastDigits: '5678',
      dueDay: 10,
      closingDay: 1,
      limit: '1000.00',
      brandId: 'other',
    });

    expect(result).toEqual({ id: 'api-card-1' });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${BASE_URL}/cards/synced-create`);
    expect(init.method).toBe('POST');
    expect(init.headers['Idempotency-Key']).toBe('banking-ms:card:card-1');
    expect(JSON.parse(init.body)).toEqual({
      userId: 'user-a',
      name: 'Cartão de crédito',
      lastDigits: '5678',
      dueDay: 10,
      closingDay: 1,
      limit: '1000.00',
      brandId: 'other',
    });
  });

  it('importTransaction posts to /transactions/synced-import with accountId/creditCardId', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
      jsonResponse({ id: 'tx-ms-1', source: 'synced', externalId: 'tx-1', pluggyStatus: 'posted' }),
    );

    const result = await adapter.importTransaction({
      userId: 'user-a',
      pluggyTransactionId: 'tx-1',
      description: 'Supermercado',
      amount: '50.00',
      dueDate: new Date('2026-08-01T00:00:00Z'),
      type: 'expense',
      accountId: 'api-account-1',
      creditCardId: null,
      installmentNumber: null,
      installmentCount: null,
      pluggyStatus: 'posted',
    });

    expect(result).toEqual({ transactionsMsId: 'tx-ms-1' });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${BASE_URL}/transactions/synced-import`);
    const body = JSON.parse(init.body);
    expect(body.accountId).toBe('api-account-1');
    expect(body.creditCardId).toBeNull();
    expect(body.dueDate).toBe('2026-08-01');
  });

  it('throws when a request fails with a non-ok status', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    await expect(
      adapter.createSyncedAccount({
        userId: 'user-a',
        pluggyAccountId: 'acc-1',
        name: 'Conta',
        bankId: 'other',
        icon: 'landmark',
        color: 'slate',
      }),
    ).rejects.toThrow('Transactions import POST /accounts/synced-create failed with status 500');
  });
});
