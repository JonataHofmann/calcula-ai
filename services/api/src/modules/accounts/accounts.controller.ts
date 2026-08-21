import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createAccountInput,
  type CreateAccountInput,
  updateAccountInput,
  type UpdateAccountInput,
  type AuthenticatedUser,
} from '@finance/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ServiceAccountGuard } from '../../common/guards/service-account.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AccountsService } from './accounts.service';
import { AccountResponseDto } from './dto/account-response.dto';
import {
  createSyncedAccountInput,
  type CreateSyncedAccountInput,
} from './dto/create-synced-account.schema';

@Controller('accounts')
export class AccountsController {
  private readonly logger = new Logger(AccountsController.name);

  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<AccountResponseDto[]> {
    this.logger.log(`GET /accounts user=${user.id}`);
    return this.accounts.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createAccountInput)) input: CreateAccountInput,
  ): Promise<AccountResponseDto> {
    this.logger.log(`POST /accounts user=${user.id}`);
    return this.accounts.create(user.id, input);
  }

  /** Cross-service creation from banking-ms's Pluggy sync — never in the public BFF/web API. */
  @Post('synced-create')
  @UseGuards(ServiceAccountGuard)
  createSynced(
    @Body(new ZodValidationPipe(createSyncedAccountInput)) input: CreateSyncedAccountInput,
  ): Promise<AccountResponseDto> {
    const { userId, ...rest } = input;
    this.logger.log(`POST /accounts/synced-create user=${userId}`);
    return this.accounts.create(userId, rest);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAccountInput)) input: UpdateAccountInput,
  ): Promise<AccountResponseDto> {
    this.logger.log(`PATCH /accounts/${id} user=${user.id}`);
    return this.accounts.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.logger.log(`DELETE /accounts/${id} user=${user.id}`);
    await this.accounts.delete(user.id, id);
  }
}
