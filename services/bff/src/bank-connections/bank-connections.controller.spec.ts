import type { Request } from 'express';
import type { BankConnectionCreateInput, ConnectTokenInput } from '@finance/contracts';
import { BankConnectionsController } from './bank-connections.controller';
import type { BankingApiClient } from '../shared/banking-api-client';
import type { Session } from '../auth/session/session.store';

const TOKEN = 'header.payload.sig';

function makeReq(): Request {
  return {
    session: { tokens: { accessToken: TOKEN } } as Session,
  } as unknown as Request;
}

function makeApi() {
  return {
    get: jest.fn(async () => []),
    post: jest.fn(async () => ({})),
    delete: jest.fn(async () => undefined),
  } as unknown as jest.Mocked<BankingApiClient>;
}

describe('BFF BankConnectionsController (proxy)', () => {
  it('forwards connect-token creation with no business logic', async () => {
    const api = makeApi();
    const controller = new BankConnectionsController(api);
    const body: ConnectTokenInput = { mode: 'create' };
    await controller.createConnectToken(makeReq(), body);
    expect(api.post).toHaveBeenCalledWith('/connect-tokens', { token: TOKEN, body });
  });

  it('forwards bank-connection creation and the Idempotency-Key header', async () => {
    const api = makeApi();
    const controller = new BankConnectionsController(api);
    const body: BankConnectionCreateInput = { pluggyItemId: 'item-1' };
    await controller.create(makeReq(), body, 'idem-1');
    expect(api.post).toHaveBeenCalledWith('/bank-connections', {
      token: TOKEN,
      body,
      idempotencyKey: 'idem-1',
    });
  });

  it('forwards the list request scoped by session token', async () => {
    const api = makeApi();
    const controller = new BankConnectionsController(api);
    await controller.list(makeReq());
    expect(api.get).toHaveBeenCalledWith('/bank-connections', { token: TOKEN });
  });

  it('forwards disconnect and the Idempotency-Key header', async () => {
    const api = makeApi();
    const controller = new BankConnectionsController(api);
    await controller.disconnect(makeReq(), 'conn-1', 'idem-2');
    expect(api.delete).toHaveBeenCalledWith('/bank-connections/conn-1', {
      token: TOKEN,
      idempotencyKey: 'idem-2',
    });
  });

  it('forwards manual refresh scoped by session token', async () => {
    const api = makeApi();
    const controller = new BankConnectionsController(api);
    await controller.refresh(makeReq(), 'conn-1');
    expect(api.post).toHaveBeenCalledWith('/bank-connections/conn-1/refresh', { token: TOKEN });
  });
});
