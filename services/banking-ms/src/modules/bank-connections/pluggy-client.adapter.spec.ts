import { PluggyClientAdapter } from './pluggy-client.adapter';
import { ItemAlreadyUpdatingError } from './errors';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('PluggyClientAdapter', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  function setup() {
    const adapter = new PluggyClientAdapter('https://api.pluggy.ai', 'client-id', 'client-secret');
    fetchMock.mockResolvedValueOnce(jsonResponse({ apiKey: 'fake-api-key' }));
    return { adapter };
  }

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps a 409 on forceRefreshItem to ItemAlreadyUpdatingError', async () => {
    const { adapter } = setup();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 409 }));

    await expect(adapter.forceRefreshItem('item-1')).rejects.toBeInstanceOf(ItemAlreadyUpdatingError);
  });

  it('propagates other non-ok statuses as-is', async () => {
    const { adapter } = setup();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(adapter.forceRefreshItem('item-1')).rejects.toThrow(/failed with status 500/);
  });

  it('returns the mapped item on success', async () => {
    const { adapter } = setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'item-1', status: 'UPDATING', connector: { id: 42, name: 'Banco Teste' } }),
    );

    const item = await adapter.forceRefreshItem('item-1');
    expect(item).toEqual({
      id: 'item-1',
      status: 'UPDATING',
      institutionId: '42',
      institutionName: 'Banco Teste',
    });
  });

  describe('listTransactions', () => {
    it('calls the cursor-based /v2/transactions endpoint with dateFrom', async () => {
      const { adapter } = setup();
      fetchMock.mockResolvedValueOnce(jsonResponse({ results: [], next: null }));

      await adapter.listTransactions('acc-1', new Date('2026-08-01T00:00:00.000Z'));

      const [calledUrl] = fetchMock.mock.calls[1] as [string, unknown];
      expect(calledUrl).toBe('https://api.pluggy.ai/v2/transactions?accountId=acc-1&dateFrom=2026-08-01');
    });

    it('follows the next cursor until it is null', async () => {
      const { adapter } = setup();
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({
            results: [
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
            ],
            next: '?accountId=acc-1&after=cursor-1',
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            results: [
              {
                id: 'tx-2',
                accountId: 'acc-1',
                description: 'Farmacia',
                amount: 20,
                date: '2026-08-02',
                type: 'DEBIT',
                status: 'POSTED',
                creditCardMetadata: null,
              },
            ],
            next: null,
          }),
        );

      const transactions = await adapter.listTransactions('acc-1', new Date('2026-08-01T00:00:00.000Z'));

      expect(transactions.map((t) => t.id)).toEqual(['tx-1', 'tx-2']);
      const [secondUrl] = fetchMock.mock.calls[2] as [string, unknown];
      expect(secondUrl).toBe('https://api.pluggy.ai/v2/transactions?accountId=acc-1&after=cursor-1');
    });
  });
});
