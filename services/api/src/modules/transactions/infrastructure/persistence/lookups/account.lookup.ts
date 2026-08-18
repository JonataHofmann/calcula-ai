import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountEntity } from '../../../../accounts/infrastructure/persistence/entities/account.entity';
import type { AccountLookup } from '../../../domain/lookups';

/** Read-only ownership check over `accounts` (scoped by userId). */
@Injectable()
export class TypeOrmAccountLookup implements AccountLookup {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly repo: Repository<AccountEntity>,
  ) {}

  async exists(id: string, userId: string): Promise<boolean> {
    return this.repo.exists({ where: { id, userId } });
  }
}
