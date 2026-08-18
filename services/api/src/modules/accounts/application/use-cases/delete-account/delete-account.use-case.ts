import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../../domain/account.repository';
import { AccountNotFoundError } from '../../../domain/errors';

@Injectable()
export class DeleteAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const account = await this.accounts.findById(id, userId);
    if (!account) throw new AccountNotFoundError(id);
    await this.accounts.delete(id, userId);
  }
}
