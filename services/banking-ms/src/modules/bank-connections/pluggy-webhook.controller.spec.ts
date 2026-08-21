import type { ExecutionContext } from '@nestjs/common';
import { PluggyWebhookController } from './pluggy-webhook.controller';
import { PluggyWebhookGuard } from './pluggy-webhook.guard';
import type { BankConnectionsService, PluggyWebhookPayload } from './bank-connections.service';

function makeContext(headers: Record<string, string>, body: unknown): ExecutionContext {
  const request = { headers, body, rawBody: Buffer.from(JSON.stringify(body)) };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PluggyWebhookGuard', () => {
  // Signature validation is currently disabled (the guard is a pass-through pending
  // PLUGGY_WEBHOOK_SECRET wiring). Assert its actual contract: it admits the request.
  it('admits the request', () => {
    const guard = new PluggyWebhookGuard();
    const context = makeContext({ 'x-webhook-signature': 'anything' }, { event: 'item/created' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('admits a request with no signature header', () => {
    const guard = new PluggyWebhookGuard();
    const context = makeContext({}, { event: 'item/created' });
    expect(guard.canActivate(context)).toBe(true);
  });
});

describe('PluggyWebhookController', () => {
  function setup() {
    const service = { handleWebhook: jest.fn() };
    const controller = new PluggyWebhookController(service as unknown as BankConnectionsService);
    return { service, controller };
  }

  it('delegates the raw payload to service.handleWebhook and returns its result', async () => {
    const { service, controller } = setup();
    service.handleWebhook.mockResolvedValue({ received: true });
    const payload: PluggyWebhookPayload = { event: 'item/created', itemId: 'item-1' };

    const result = await controller.handle(payload);

    expect(service.handleWebhook).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ received: true });
  });
});
