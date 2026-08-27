import { Body, Controller, Get, HttpCode, Logger, Post, Query } from '@nestjs/common';
import {
  type AuthenticatedUser,
  type BackupSnapshot,
  backupSnapshotSchema,
  type ImportMode,
  importModeSchema,
  type ImportResult,
  type ResetResult,
} from '@finance/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
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

  /** Portable JSON snapshot of everything the caller owns. */
  @Get('export')
  export(@CurrentUser() user: AuthenticatedUser): Promise<BackupSnapshot> {
    this.logger.log(`GET /account/export user=${user.id}`);
    return this.account.exportData(user.id);
  }

  /**
   * Import a snapshot — every row gets a fresh id (never overwrites). `?mode=merge`
   * (default) appends; `?mode=replace` wipes the caller's data first, atomically.
   */
  @Post('import')
  @HttpCode(200)
  import(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(backupSnapshotSchema)) snapshot: BackupSnapshot,
    @Query('mode') mode?: string,
  ): Promise<ImportResult> {
    const importMode: ImportMode = importModeSchema.catch('merge').parse(mode);
    this.logger.warn(`POST /account/import user=${user.id} mode=${importMode}`);
    return this.account.importData(user.id, snapshot, importMode);
  }
}
