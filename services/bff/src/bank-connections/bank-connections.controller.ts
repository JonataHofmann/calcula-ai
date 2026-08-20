import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import type {
  BankConnectionCreateInput,
  BankConnectionDto,
  ConnectTokenInput,
  ConnectTokenResponse,
} from '@finance/contracts';
import type { Request } from 'express';
import { BankingApiClient } from '../shared/banking-api-client';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

/** Proxies Pluggy bank-connection flows to banking-ms, scoped by the caller's session token. */
@Controller('bank-connections')
export class BankConnectionsController {
  constructor(private readonly api: BankingApiClient) {}

  @Post('/connect-tokens')
  createConnectToken(
    @Req() req: SessionRequest,
    @Body() body: ConnectTokenInput,
  ): Promise<ConnectTokenResponse> {
    return this.api.post<ConnectTokenResponse>('/connect-tokens', {
      token: tokenOf(req),
      body,
    });
  }

  @Post()
  create(
    @Req() req: SessionRequest,
    @Body() body: BankConnectionCreateInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<BankConnectionDto> {
    return this.api.post<BankConnectionDto>('/bank-connections', {
      token: tokenOf(req),
      body,
      idempotencyKey,
    });
  }

  @Get()
  list(@Req() req: SessionRequest): Promise<BankConnectionDto[]> {
    return this.api.get<BankConnectionDto[]>('/bank-connections', { token: tokenOf(req) });
  }

  @Delete(':id')
  @HttpCode(204)
  disconnect(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    return this.api.delete<void>(`/bank-connections/${id}`, {
      token: tokenOf(req),
      idempotencyKey,
    });
  }

  @Post(':id/refresh')
  @HttpCode(202)
  refresh(@Req() req: SessionRequest, @Param('id') id: string): Promise<void> {
    return this.api.post<void>(`/bank-connections/${id}/refresh`, { token: tokenOf(req) });
  }
}
