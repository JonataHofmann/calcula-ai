import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { BackupSnapshot, ImportMode, ImportResult, ResetResult } from '@finance/contracts';
import { importModeSchema } from '@finance/contracts';
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

  @Get('export')
  export(@Req() req: SessionRequest): Promise<BackupSnapshot> {
    this.logger.log('GET /account/export');
    return this.account.export(tokenOf(req));
  }

  @Post('import')
  @HttpCode(200)
  import(
    @Req() req: SessionRequest,
    @Body() snapshot: unknown,
    @Query('mode') mode?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ImportResult> {
    const importMode: ImportMode = importModeSchema.catch('merge').parse(mode);
    this.logger.warn(`POST /account/import mode=${importMode}`);
    return this.account.import(tokenOf(req), snapshot, importMode, idempotencyKey);
  }
}
