import type {
  CreateTransactionInput,
  EffectuateInput,
  UpdateTransactionInput,
} from '@finance/contracts';
import { TransactionsService } from './transactions.service';
import type { ApiClient } from '../../common/api-client';

const TOKEN = 'header.payload.sig';

function makeApi() {
  return {
    get: jest.fn(async () => []),
    post: jest.fn(async () => ({ transactions: [] })),
    patch: jest.fn(async () => ({ transactions: [] })),
    delete: jest.fn(async () => undefined),
  } as unknown as jest.Mocked<ApiClient>;
}

describe('BFF TransactionsService (proxy)', () => {
  it('scopes list by session token and forwards the month query', async () => {
    const api = makeApi();
    const service = new TransactionsService(api);
    await service.list(TOKEN, {
      dueFrom: '2026-01-01T00:00:00.000Z',
      dueTo: '2026-02-01T00:00:00.000Z',
      sort: 'dueDate',
      order: 'asc',
    });
    expect(api.get).toHaveBeenCalledWith(
      '/transactions?dueFrom=2026-01-01T00%3A00%3A00.000Z&dueTo=2026-02-01T00%3A00%3A00.000Z&sort=dueDate&order=asc',
      { token: TOKEN },
    );
  });

  it('places overdue before :id so the path resolves', async () => {
    const api = makeApi();
    const service = new TransactionsService(api);
    await service.overdue(TOKEN, { before: '2026-01-01T00:00:00.000Z' });
    expect(api.get).toHaveBeenCalledWith(
      '/transactions/overdue?before=2026-01-01T00%3A00%3A00.000Z',
      { token: TOKEN },
    );
  });

  it('places forecast before :id and forwards from/months', async () => {
    const api = makeApi();
    const service = new TransactionsService(api);
    await service.forecast(TOKEN, { from: '2026-08', months: 3 });
    expect(api.get).toHaveBeenCalledWith('/transactions/forecast?from=2026-08&months=3', {
      token: TOKEN,
    });
  });

  it('forwards the create body and Idempotency-Key header', async () => {
    const api = makeApi();
    const service = new TransactionsService(api);
    const body = { recurrence: 'single', type: 'expense' } as unknown as CreateTransactionInput;
    await service.create(TOKEN, body, 'idem-1');
    expect(api.post).toHaveBeenCalledWith('/transactions', {
      token: TOKEN,
      body,
      idempotencyKey: 'idem-1',
    });
  });

  it('appends scope to update and forwards Idempotency-Key', async () => {
    const api = makeApi();
    const service = new TransactionsService(api);
    const body = { description: 'x' } as UpdateTransactionInput;
    await service.update(TOKEN, 't1', body, 'future', 'idem-2');
    expect(api.patch).toHaveBeenCalledWith('/transactions/t1?scope=future', {
      token: TOKEN,
      body,
      idempotencyKey: 'idem-2',
    });
  });

  it('forwards effectuate to the API-MS', async () => {
    const api = makeApi();
    (api.post as jest.Mock).mockResolvedValueOnce({ transaction: {}, next: null });
    const service = new TransactionsService(api);
    const body: EffectuateInput = { amount: '95.00' };
    await service.effectuate(TOKEN, 't1', body, 'idem-3');
    expect(api.post).toHaveBeenCalledWith('/transactions/t1/effectuate', {
      token: TOKEN,
      body,
      idempotencyKey: 'idem-3',
    });
  });

  it('appends scope to delete', async () => {
    const api = makeApi();
    const service = new TransactionsService(api);
    await service.remove(TOKEN, 't1', 'all', 'idem-4');
    expect(api.delete).toHaveBeenCalledWith('/transactions/t1?scope=all', {
      token: TOKEN,
      idempotencyKey: 'idem-4',
    });
  });
});
