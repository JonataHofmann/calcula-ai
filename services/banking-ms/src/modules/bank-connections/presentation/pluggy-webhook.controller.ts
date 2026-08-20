import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../../common/auth/public.decorator';
import {
  BANK_CONNECTION_REPOSITORY,
  type BankConnectionRepository,
} from '../domain/bank-connection.repository';
import { PluggyWebhookGuard } from '../infrastructure/pluggy/pluggy-webhook.guard';
import { SyncConnectionUseCase } from '../application/use-cases/sync-connection/sync-connection';

interface PluggyWebhookPayload {
  event: string;
  itemId?: string;
}

/** Events that warrant a full re-sync of the connection (accounts, cards, and transaction reconciliation). */
const SYNCABLE_EVENTS = new Set([
  'item/created',
  'item/updated',
  'transactions/created',
  'transactions/updated',
  'transactions/deleted',
]);

/**
 * Public from Keycloak's perspective — Pluggy sends no user JWT, only a signed
 * payload validated by PluggyWebhookGuard.
 *
 * item/created and item/updated cannot invoke complete-connection: Pluggy's webhook
 * payload carries only itemId, never the userId that use case requires. The actual
 * connection row is always created by the widget-return POST /bank-connections
 * (which does have the user's JWT). So here we just resolve the owner via
 * findByItemId and (re)trigger sync-connection when the connection already exists;
 * if it doesn't yet (webhook raced ahead of the widget return), we no-op.
 */
@Public()
@UseGuards(PluggyWebhookGuard)
@Controller('webhooks/pluggy')
export class PluggyWebhookController {
  constructor(
    @Inject(BANK_CONNECTION_REPOSITORY) private readonly connections: BankConnectionRepository,
    private readonly syncConnection: SyncConnectionUseCase,
  ) {}

  @Post()
  async handle(@Body() payload: PluggyWebhookPayload): Promise<{ received: true }> {
    if (SYNCABLE_EVENTS.has(payload.event) && payload.itemId) {
      const connection = await this.connections.findByItemId(payload.itemId);
      if (connection) {
        await this.syncConnection
          .execute({ userId: connection.userId, bankConnectionId: connection.id })
          .catch(() => undefined);
      }
    } else if (payload.event === 'item/error' && payload.itemId) {
      const connection = await this.connections.findByItemId(payload.itemId);
      if (connection) {
        connection.markNeedsAttention();
        await this.connections.save(connection);
      }
    }

    return { received: true };
  }
}
