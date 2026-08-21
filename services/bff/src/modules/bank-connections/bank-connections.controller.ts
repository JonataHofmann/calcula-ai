import { Body, Controller, Delete, Get, Headers, HttpCode, Logger, Param, Post, Req } from '@nestjs/common';
import type {
  BankConnectionCreateInput,
  BankConnectionDto,
  ConnectTokenInput,
  ConnectTokenResponse,
} from '@finance/contracts';
import type { Request } from 'express';
import { BankConnectionsService } from './bank-connections.service';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

/** Proxies Pluggy bank-connection flows to banking-ms, scoped by the caller's session token. */
@Controller('bank-connections')
export class BankConnectionsController {
  private readonly logger = new Logger(BankConnectionsController.name);

  constructor(private readonly bankConnections: BankConnectionsService) {}

  @Post('/connect-tokens')
  createConnectToken(
    @Req() req: SessionRequest,
    @Body() body: ConnectTokenInput,
  ): Promise<ConnectTokenResponse> {
    this.logger.log('POST /bank-connections/connect-tokens');
    return this.bankConnections.createConnectToken(tokenOf(req), body);
  }

  @Post()
  create(
    @Req() req: SessionRequest,
    @Body() body: BankConnectionCreateInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<BankConnectionDto> {
    this.logger.log('POST /bank-connections');
    return this.bankConnections.create(tokenOf(req), body, idempotencyKey);
  }

  @Get()
  list(@Req() req: SessionRequest): Promise<BankConnectionDto[]> {
    this.logger.log('GET /bank-connections');
    return this.bankConnections.list(tokenOf(req));
  }

  @Delete(':id')
  @HttpCode(204)
  disconnect(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    this.logger.log(`DELETE /bank-connections/${id}`);
    return this.bankConnections.disconnect(tokenOf(req), id, idempotencyKey);
  }

  @Post(':id/refresh')
  @HttpCode(202)
  refresh(@Req() req: SessionRequest, @Param('id') id: string): Promise<void> {
    this.logger.log(`POST /bank-connections/${id}/refresh`);
    return this.bankConnections.refresh(tokenOf(req), id);
  }
}
