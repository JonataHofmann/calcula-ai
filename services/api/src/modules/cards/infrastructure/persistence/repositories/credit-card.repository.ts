import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditCard } from '../../../domain/credit-card';
import type { CreditCardRepository } from '../../../domain/credit-card.repository';
import { CreditCardEntity } from '../entities/credit-card.entity';

@Injectable()
export class TypeOrmCreditCardRepository implements CreditCardRepository {
  constructor(
    @InjectRepository(CreditCardEntity)
    private readonly repo: Repository<CreditCardEntity>,
  ) {}

  async create(card: CreditCard): Promise<void> {
    await this.repo.insert(toEntity(card));
  }

  async save(card: CreditCard): Promise<void> {
    await this.repo.save(toEntity(card));
  }

  async findById(id: string, userId: string): Promise<CreditCard | null> {
    const row = await this.repo.findOne({ where: { id, userId } });
    return row ? toDomain(row) : null;
  }

  async findAllByUser(userId: string): Promise<CreditCard[]> {
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

function toEntity(card: CreditCard): CreditCardEntity {
  const entity = new CreditCardEntity();
  entity.id = card.id;
  entity.userId = card.userId;
  entity.name = card.name;
  entity.lastDigits = card.lastDigits;
  entity.dueDay = card.dueDay;
  entity.closingDay = card.closingDay;
  entity.limit = card.limit;
  entity.brandId = card.brandId;
  entity.createdAt = card.createdAt;
  entity.updatedAt = card.updatedAt;
  return entity;
}

function toDomain(row: CreditCardEntity): CreditCard {
  return CreditCard.restore({
    id: row.id,
    userId: row.userId,
    name: row.name,
    lastDigits: row.lastDigits,
    dueDay: row.dueDay,
    closingDay: row.closingDay,
    limit: row.limit,
    brandId: row.brandId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
