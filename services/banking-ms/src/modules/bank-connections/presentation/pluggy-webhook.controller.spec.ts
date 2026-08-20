import { createHmac } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { BankConnection } from '../domain/bank-connection';
import { PluggyWebhookGuard } from '../infrastructure/pluggy/pluggy-webhook.guard';
import { SyncConnectionUseCase } from '../application/use-cases/sync-connection/sync-connection';
import {
  FakeBankConnectionRepository,
  FakePluggyClient,
  FakeTransactionsImporter,
  USER_A,
} from '../application/use-cases/test-fakes';
import { PluggyWebhookController } from './pluggy-webhook.controller';

const CONNECTION_ID = 'conn-1';
const ITEM_ID = 'item-1';

function makeContext(headers: Record<string, string>, body: unknown): ExecutionContext {
  const request = { headers, body, rawBody: Buffer.from(JSON.stringify(body)) };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PluggyWebhookGuard', () => {
  const secret = 'shh';
  const originalSecret = process.env.PLUGGY_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.PLUGGY_WEBHOOK_SECRET = secret;
  });

  afterAll(() => {
    process.env.PLUGGY_WEBHOOK_SECRET = originalSecret;
  });

  it('accepts a valid signature', () => {
    const guard = new PluggyWebhookGuard();
    const body = { event: 'item/created', itemId: ITEM_ID };
    const signature = createHmac('sha1', secret).update(JSON.stringify(body)).digest('hex');
    const context = makeContext({ 'x-webhook-signature': signature }, body);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects an invalid signature', () => {
    const guard = new PluggyWebhookGuard();
    const context = makeContext({ 'x-webhook-signature': 'not-the-right-signature' }, { event: 'item/created' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a missing signature header', () => {
    const guard = new PluggyWebhookGuard();
    const context = makeContext({}, { event: 'item/created' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});

describe('PluggyWebhookController', () => {
  function setup() {
    const repository = new FakeBankConnectionRepository();
    const pluggy = new FakePluggyClient();
    const importer = new FakeTransactionsImporter();
    const syncConnection = new SyncConnectionUseCase(repository, pluggy, importer);
    const controller = new PluggyWebhookController(repository, syncConnection);
    return { repository, pluggy, importer, controller };
  }

  async function seedConnection(repository: FakeBankConnectionRepository) {
    await repository.create(
      BankConnection.restore({
        id: CONNECTION_ID,
        userId: USER_A,
        pluggyItemId: ITEM_ID,
        institutionId: 'inst-1',
        institutionName: 'Banco Fake',
        status: 'active',
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  it('triggers a sync when item/created arrives for a known connection', async () => {
    const { repository, pluggy, controller } = setup();
    await seedConnection(repository);
    pluggy.addItem(ITEM_ID, { status: 'UPDATED', institutionId: 'inst-1', institutionName: 'Banco Fake' });
    pluggy.addAccounts(ITEM_ID, []);

    const result = await controller.handle({ event: 'item/created', itemId: ITEM_ID });

    expect(result).toEqual({ received: true });
    const saved = await repository.findById(CONNECTION_ID, USER_A);
    expect(saved?.lastSyncedAt).not.toBeNull();
  });

  it('triggers a sync when item/updated arrives for a known connection', async () => {
    const { repository, pluggy, controller } = setup();
    await seedConnection(repository);
    pluggy.addItem(ITEM_ID, { status: 'UPDATED', institutionId: 'inst-1', institutionName: 'Banco Fake' });
    pluggy.addAccounts(ITEM_ID, []);

    const result = await controller.handle({ event: 'item/updated', itemId: ITEM_ID });

    expect(result).toEqual({ received: true });
    const saved = await repository.findById(CONNECTION_ID, USER_A);
    expect(saved?.lastSyncedAt).not.toBeNull();
  });

  it('no-ops when the itemId is unknown (widget-return has not created the connection yet)', async () => {
    const { controller } = setup();
    const result = await controller.handle({ event: 'item/created', itemId: 'unknown-item' });
    expect(result).toEqual({ received: true });
  });

  it('always responds 200 received even when the sync throws', async () => {
    const { repository, controller } = setup();
    await seedConnection(repository);
    // No FakePluggyClient item/accounts seeded — getItem() throws inside sync-connection.

    const result = await controller.handle({ event: 'item/updated', itemId: ITEM_ID });

    expect(result).toEqual({ received: true });
  });

  it('no-ops on events out of scope (unknown event type)', async () => {
    const { controller } = setup();
    const result = await controller.handle({ event: 'something/else', itemId: ITEM_ID });
    expect(result).toEqual({ received: true });
  });

  it('flags the connection needs_attention when item/error arrives for a known connection', async () => {
    const { repository, controller } = setup();
    await seedConnection(repository);

    const result = await controller.handle({ event: 'item/error', itemId: ITEM_ID });

    expect(result).toEqual({ received: true });
    const saved = await repository.findById(CONNECTION_ID, USER_A);
    expect(saved?.status).toBe('needs_attention');
  });

  it('no-ops on item/error when the itemId is unknown', async () => {
    const { controller } = setup();
    const result = await controller.handle({ event: 'item/error', itemId: 'unknown-item' });
    expect(result).toEqual({ received: true });
  });
});
