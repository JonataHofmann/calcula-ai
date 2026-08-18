import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../../domain/account';
import type { AccountRepository } from '../../../domain/account.repository';
import { AccountEntity } from '../entities/account.entity';

@Injectable()
export class TypeOrmAccountRepository implements AccountRepository {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly repo: Repository<AccountEntity>,
  ) {}

  async create(account: Account): Promise<void> {
    await this.repo.insert(toEntity(account));
  }

  async save(account: Account): Promise<void> {
    await this.repo.save(toEntity(account));
  }

  async findById(id: string, userId: string): Promise<Account | null> {
    const row = await this.repo.findOne({ where: { id, userId } });
    return row ? toDomain(row) : null;
  }

  async findAllByUser(userId: string): Promise<Account[]> {
    const rows = await this.repo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.repo.delete({ id, userId });
  }
}

function toEntity(account: Account): AccountEntity {
  const entity = new AccountEntity();
  entity.id = account.id;
  entity.userId = account.userId;
  entity.name = account.name;
  entity.bankId = account.bankId;
  entity.icon = account.icon;
  entity.color = account.color;
  entity.createdAt = account.createdAt;
  entity.updatedAt = account.updatedAt;
  return entity;
}

function toDomain(row: AccountEntity): Account {
  return Account.restore({
    id: row.id,
    userId: row.userId,
    name: row.name,
    bankId: row.bankId,
    icon: row.icon,
    color: row.color,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
