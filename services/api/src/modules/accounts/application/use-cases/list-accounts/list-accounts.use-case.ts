import { Inject, Injectable } from '@nestjs/common';
import type { Account } from '../../../domain/account';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../../domain/account.repository';

@Injectable()
export class ListAccountsUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  execute(userId: string): Promise<Account[]> {
    return this.accounts.findAllByUser(userId);
  }
}
