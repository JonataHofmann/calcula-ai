import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Logger,
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
import { AccountsService } from './accounts.service';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

/** Proxies account CRUD to the API-MS, scoped by the caller's session token. */
@Controller('accounts')
export class AccountsController {
  private readonly logger = new Logger(AccountsController.name);

  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@Req() req: SessionRequest): Promise<AccountDto[]> {
    this.logger.log('GET /accounts');
    return this.accounts.list(tokenOf(req));
  }

  @Post()
  create(
    @Req() req: SessionRequest,
    @Body() body: CreateAccountInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<AccountDto> {
    this.logger.log('POST /accounts');
    return this.accounts.create(tokenOf(req), body, idempotencyKey);
  }

  @Patch(':id')
  update(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: UpdateAccountInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<AccountDto> {
    this.logger.log(`PATCH /accounts/${id}`);
    return this.accounts.update(tokenOf(req), id, body, idempotencyKey);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Req() req: SessionRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    this.logger.log(`DELETE /accounts/${id}`);
    return this.accounts.remove(tokenOf(req), id, idempotencyKey);
  }
}
