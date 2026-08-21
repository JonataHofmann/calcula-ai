import { SyncedTransactionsService } from './synced-transactions.service';
import type { BankingApiClient } from '../../common/banking-api-client';

const TOKEN = 'header.payload.sig';

function makeApi() {
  return {
    get: jest.fn(async () => []),
    post: jest.fn(async () => ({})),
    delete: jest.fn(async () => undefined),
  } as unknown as jest.Mocked<BankingApiClient>;
}

describe('BFF SyncedTransactionsService (proxy)', () => {
  it('forwards the list request scoped by session token, no status', async () => {
    const api = makeApi();
    const service = new SyncedTransactionsService(api);
    await service.list(TOKEN);
    expect(api.get).toHaveBeenCalledWith('/synced-transactions', { token: TOKEN });
  });

  it('appends the status filter as a query param', async () => {
    const api = makeApi();
    const service = new SyncedTransactionsService(api);
    await service.list(TOKEN, 'error');
    expect(api.get).toHaveBeenCalledWith('/synced-transactions?status=error', { token: TOKEN });
  });
});
