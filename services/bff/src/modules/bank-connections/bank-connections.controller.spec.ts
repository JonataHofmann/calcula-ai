import type { BankConnectionCreateInput, ConnectTokenInput } from '@finance/contracts';
import { BankConnectionsService } from './bank-connections.service';
import type { BankingApiClient } from '../../common/banking-api-client';

const TOKEN = 'header.payload.sig';

function makeApi() {
  return {
    get: jest.fn(async () => []),
    post: jest.fn(async () => ({})),
    delete: jest.fn(async () => undefined),
  } as unknown as jest.Mocked<BankingApiClient>;
}

describe('BFF BankConnectionsService (proxy)', () => {
  it('forwards connect-token creation with no business logic', async () => {
    const api = makeApi();
    const service = new BankConnectionsService(api);
    const body: ConnectTokenInput = { mode: 'create' };
    await service.createConnectToken(TOKEN, body);
    expect(api.post).toHaveBeenCalledWith('/connect-tokens', { token: TOKEN, body });
  });

  it('forwards bank-connection creation and the Idempotency-Key header', async () => {
    const api = makeApi();
    const service = new BankConnectionsService(api);
    const body: BankConnectionCreateInput = { pluggyItemId: 'item-1' };
    await service.create(TOKEN, body, 'idem-1');
    expect(api.post).toHaveBeenCalledWith('/bank-connections', {
      token: TOKEN,
      body,
      idempotencyKey: 'idem-1',
    });
  });

  it('forwards the list request scoped by session token', async () => {
    const api = makeApi();
    const service = new BankConnectionsService(api);
    await service.list(TOKEN);
    expect(api.get).toHaveBeenCalledWith('/bank-connections', { token: TOKEN });
  });

  it('forwards disconnect and the Idempotency-Key header', async () => {
    const api = makeApi();
    const service = new BankConnectionsService(api);
    await service.disconnect(TOKEN, 'conn-1', 'idem-2');
    expect(api.delete).toHaveBeenCalledWith('/bank-connections/conn-1', {
      token: TOKEN,
      idempotencyKey: 'idem-2',
    });
  });

  it('forwards manual refresh scoped by session token', async () => {
    const api = makeApi();
    const service = new BankConnectionsService(api);
    await service.refresh(TOKEN, 'conn-1');
    expect(api.post).toHaveBeenCalledWith('/bank-connections/conn-1/refresh', { token: TOKEN });
  });
});
