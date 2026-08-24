import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { ResetResult } from '@finance/contracts';
import type { Request } from 'express';
import { AccountService } from './account.service';
import type { Session } from '../auth/session/session.store';

type SessionRequest = Request & { session?: Session };

function tokenOf(req: SessionRequest): string {
  return (req.session as Session).tokens.accessToken;
}

/** Proxies user-account maintenance to the API-MS, scoped by the caller's session token. */
@Controller('account')
export class AccountController {
  private readonly logger = new Logger(AccountController.name);

  constructor(private readonly account: AccountService) {}

  @Post('reset')
  @HttpCode(200)
  reset(
    @Req() req: SessionRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ResetResult> {
    this.logger.warn('POST /account/reset');
    return this.account.reset(tokenOf(req), idempotencyKey);
  }
}
