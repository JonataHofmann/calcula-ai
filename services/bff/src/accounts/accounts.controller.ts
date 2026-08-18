import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type {
  AccountDto,
  CreateAccountInput,
  UpdateAccountInput,
} from '@finance/contracts';
import type { Request } from 'express';
import { ApiClient } from '../shared/api-client';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

/** Proxies account CRUD to the API-MS, scoped by the caller's session token. */
@Controller('accounts')
export class AccountsController {
  constructor(private readonly api: ApiClient) {}

  @Get()
  list(@Req() req: SessionRequest): Promise<AccountDto[]> {
    return this.api.get<AccountDto[]>('/accounts', { token: tokenOf(req) });
  }

  @Post()
  create(
    @Req() req: SessionRequest,
    @Body() body: CreateAccountInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<AccountDto> {
    return this.api.post<AccountDto>('/accounts', {
      token: tokenOf(req),
      body,
      idempotencyKey,
    });
  }

  @Patch(':id')
  update(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: UpdateAccountInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<AccountDto> {
    return this.api.patch<AccountDto>(`/accounts/${id}`, {
      token: tokenOf(req),
      body,
      idempotencyKey,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    return this.api.delete<void>(`/accounts/${id}`, {
      token: tokenOf(req),
      idempotencyKey,
    });
  }
}
