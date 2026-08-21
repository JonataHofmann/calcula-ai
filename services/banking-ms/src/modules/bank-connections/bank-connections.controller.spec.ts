import type { AuthenticatedUser, BankConnectionDto } from '@finance/contracts';
import { BankConnectionsController } from './bank-connections.controller';
import type { BankConnectionsService } from './bank-connections.service';

/**
 * Controller unit tests — the controller is a thin delegator (flat NestJS convention).
 * The service is stubbed; each test asserts the endpoint maps HTTP inputs to the right
 * service call and shapes the response DTO (via BankConnectionConverter for `create`).
 * All business behavior is covered in bank-connections.service.spec.ts.
 */

const USER: AuthenticatedUser = { id: 'user-a' } as AuthenticatedUser;

type ServiceStub = {
  [K in keyof BankConnectionsService]?: jest.Mock;
};

function setup() {
  const service: ServiceStub = {
    createConnectToken: jest.fn(),
    completeConnection: jest.fn(),
    listConnections: jest.fn(),
    disconnectConnection: jest.fn(),
    triggerManualRefresh: jest.fn(),
    retryConnectionImports: jest.fn(),
  };
  const controller = new BankConnectionsController(service as unknown as BankConnectionsService);
  return { controller, service };
}

describe('BankConnectionsController', () => {
  describe('createToken', () => {
    it('delegates a create-mode request and serializes expiresAt to ISO', async () => {
      const { controller, service } = setup();
      const expiresAt = new Date('2026-08-20T12:00:00.000Z');
      service.createConnectToken!.mockResolvedValue({ connectToken: 'tok-1', expiresAt });

      const result = await controller.createToken(USER, { mode: 'create' } as never);

      expect(service.createConnectToken).toHaveBeenCalledWith({ userId: 'user-a', mode: 'create' });
      expect(result).toEqual({ connectToken: 'tok-1', expiresAt: expiresAt.toISOString() });
    });

    it('delegates a reauth-mode request with the target bankConnectionId', async () => {
      const { controller, service } = setup();
      service.createConnectToken!.mockResolvedValue({
        connectToken: 'tok-2',
        expiresAt: new Date('2026-08-20T12:00:00.000Z'),
      });

      await controller.createToken(USER, { mode: 'reauth', bankConnectionId: 'conn-1' } as never);

      expect(service.createConnectToken).toHaveBeenCalledWith({
        userId: 'user-a',
        mode: 'reauth',
        bankConnectionId: 'conn-1',
      });
    });
  });

  describe('create', () => {
    it('completes the connection and returns a DTO with empty accounts/cards and zeroed counters', async () => {
      const { controller, service } = setup();
      service.completeConnection!.mockResolvedValue({
        id: 'conn-1',
        userId: 'user-a',
        pluggyItemId: 'item-1',
        institutionId: 'inst-1',
        institutionName: 'Banco Teste',
        status: 'active',
        lastSyncedAt: null,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      });

      const result = await controller.create(USER, { pluggyItemId: 'item-1' } as never);

      expect(service.completeConnection).toHaveBeenCalledWith({
        userId: 'user-a',
        pluggyItemId: 'item-1',
      });
      expect(result).toEqual<BankConnectionDto>({
        id: 'conn-1',
        institutionName: 'Banco Teste',
        status: 'active',
        lastSyncedAt: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        accounts: [],
        creditCards: [],
        transactionsTotal: 0,
        transactionsErrored: 0,
      });
    });
  });

  describe('list', () => {
    it('maps every listed connection through the converter', async () => {
      const { controller, service } = setup();
      service.listConnections!.mockResolvedValue([
        {
          id: 'conn-1',
          userId: 'user-a',
          pluggyItemId: 'item-1',
          institutionId: 'inst-1',
          institutionName: 'Banco Teste',
          status: 'active',
          lastSyncedAt: new Date('2026-08-02T00:00:00.000Z'),
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          updatedAt: new Date('2026-08-02T00:00:00.000Z'),
          accounts: [
            {
              id: 'acc-1',
              bankConnectionId: 'conn-1',
              userId: 'user-a',
              pluggyAccountId: 'pacc-1',
              type: 'CHECKING_ACCOUNT',
              displayName: 'Conta',
              balance: '100.00',
              currency: 'BRL',
              apiAccountId: null,
              createdAt: new Date('2026-08-01T00:00:00.000Z'),
              updatedAt: new Date('2026-08-01T00:00:00.000Z'),
            },
          ],
          creditCards: [],
          transactionsTotal: 3,
          transactionsErrored: 1,
        },
      ]);

      const result = await controller.list(USER);

      expect(service.listConnections).toHaveBeenCalledWith({ userId: 'user-a' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'conn-1',
        lastSyncedAt: '2026-08-02T00:00:00.000Z',
        transactionsTotal: 3,
        transactionsErrored: 1,
      });
      expect(result[0].accounts).toEqual([
        { id: 'acc-1', displayName: 'Conta', type: 'CHECKING_ACCOUNT', balance: '100.00', currency: 'BRL' },
      ]);
    });
  });

  describe('disconnect', () => {
    it('delegates to disconnectConnection and resolves void', async () => {
      const { controller, service } = setup();
      service.disconnectConnection!.mockResolvedValue(undefined);

      const result = await controller.disconnect(USER, 'conn-1');

      expect(result).toBeUndefined();
      expect(service.disconnectConnection).toHaveBeenCalledWith({ id: 'conn-1', userId: 'user-a' });
    });
  });

  describe('refresh', () => {
    it('passes the id, user, and forceFullSync flag through to triggerManualRefresh', async () => {
      const { controller, service } = setup();
      service.triggerManualRefresh!.mockResolvedValue(undefined);

      await controller.refresh(USER, 'conn-1', { forceFullSync: true } as never);

      expect(service.triggerManualRefresh).toHaveBeenCalledWith({
        bankConnectionId: 'conn-1',
        userId: 'user-a',
        forceFullSync: true,
      });
    });

    it('forwards an omitted forceFullSync flag as undefined', async () => {
      const { controller, service } = setup();
      service.triggerManualRefresh!.mockResolvedValue(undefined);

      await controller.refresh(USER, 'conn-1', {} as never);

      expect(service.triggerManualRefresh).toHaveBeenCalledWith({
        bankConnectionId: 'conn-1',
        userId: 'user-a',
        forceFullSync: undefined,
      });
    });
  });

  describe('retryImports', () => {
    it('delegates to retryConnectionImports and returns its aggregated result', async () => {
      const { controller, service } = setup();
      const aggregated = { retried: 2, succeeded: 1, stillFailing: 1 };
      service.retryConnectionImports!.mockResolvedValue(aggregated);

      const result = await controller.retryImports(USER, 'conn-1');

      expect(service.retryConnectionImports).toHaveBeenCalledWith({
        bankConnectionId: 'conn-1',
        userId: 'user-a',
      });
      expect(result).toEqual(aggregated);
    });
  });
});
