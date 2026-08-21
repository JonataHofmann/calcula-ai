import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { BankConnectionsService, type PluggyWebhookPayload } from './bank-connections.service';
import { PluggyWebhookGuard } from './pluggy-webhook.guard';

/**
 * Public from Keycloak's perspective — Pluggy sends no user JWT, only a signed
 * payload validated by PluggyWebhookGuard. All resolution/sync logic lives in the
 * service (handleWebhook); the controller only routes and delegates.
 */
@Public()
@UseGuards(PluggyWebhookGuard)
@Controller('webhooks/pluggy')
export class PluggyWebhookController {
  private readonly logger = new Logger(PluggyWebhookController.name);

  constructor(private readonly service: BankConnectionsService) {}

  @Post()
  async handle(@Body() payload: PluggyWebhookPayload): Promise<{ received: true }> {
    this.logger.log(`POST /webhooks/pluggy (event=${payload.event})`);
    return this.service.handleWebhook(payload);
  }
}
