import { Inject, Injectable } from '@nestjs/common';
import type { UpdateAccountInput } from '@finance/contracts';
import type { Account } from '../../../domain/account';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../../domain/account.repository';
import { AccountNotFoundError } from '../../../domain/errors';

@Injectable()
export class UpdateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  async execute(userId: string, id: string, input: UpdateAccountInput): Promise<Account> {
    const account = await this.accounts.findById(id, userId);
    if (!account) throw new AccountNotFoundError(id);
    account.update(input);
    await this.accounts.save(account);
    return account;
  }
}
