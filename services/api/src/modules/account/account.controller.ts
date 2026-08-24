import { Controller, HttpCode, Logger, Post } from '@nestjs/common';
import type { AuthenticatedUser, ResetResult } from '@finance/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccountService } from './account.service';

/** User-account maintenance scoped to the caller's JWT. */
@Controller('account')
export class AccountController {
  private readonly logger = new Logger(AccountController.name);

  constructor(private readonly account: AccountService) {}

  /** Wipes all of the caller's data (transactions, accounts, cards, custom categories). Irreversible. */
  @Post('reset')
  @HttpCode(200)
  reset(@CurrentUser() user: AuthenticatedUser): Promise<ResetResult> {
    this.logger.warn(`POST /account/reset user=${user.id}`);
    return this.account.resetData(user.id);
  }
}
