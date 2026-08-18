import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type AccountDto,
  createAccountInput,
  type CreateAccountInput,
  updateAccountInput,
  type UpdateAccountInput,
} from '@finance/contracts';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '@finance/contracts';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import type { Account } from '../domain/account';
import { CreateAccountUseCase } from '../application/use-cases/create-account/create-account.use-case';
import { ListAccountsUseCase } from '../application/use-cases/list-accounts/list-accounts.use-case';
import { UpdateAccountUseCase } from '../application/use-cases/update-account/update-account.use-case';
import { DeleteAccountUseCase } from '../application/use-cases/delete-account/delete-account.use-case';

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly createAccount: CreateAccountUseCase,
    private readonly listAccounts: ListAccountsUseCase,
    private readonly updateAccount: UpdateAccountUseCase,
    private readonly deleteAccount: DeleteAccountUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<AccountDto[]> {
    const accounts = await this.listAccounts.execute(user.id);
    return accounts.map(toDto);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createAccountInput)) input: CreateAccountInput,
  ): Promise<AccountDto> {
    const account = await this.createAccount.execute(user.id, input);
    return toDto(account);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAccountInput)) input: UpdateAccountInput,
  ): Promise<AccountDto> {
    const account = await this.updateAccount.execute(user.id, id, input);
    return toDto(account);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteAccount.execute(user.id, id);
  }
}

/** Domain -> HTTP contract. Only fields the client needs (no userId — FR-023). */
function toDto(account: Account): AccountDto {
  return {
    id: account.id,
    name: account.name,
    bankId: account.bankId,
    icon: account.icon,
    color: account.color,
  } as AccountDto;
}
