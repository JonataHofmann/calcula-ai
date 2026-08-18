import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CreateAccountInput } from '@finance/contracts';
import { Account } from '../../../domain/account';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../../domain/account.repository';

@Injectable()
export class CreateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  async execute(userId: string, input: CreateAccountInput): Promise<Account> {
    const account = Account.create({
      id: randomUUID(),
      userId,
      name: input.name,
      bankId: input.bankId,
      icon: input.icon,
      color: input.color,
    });
    await this.accounts.create(account);
    return account;
  }
}
