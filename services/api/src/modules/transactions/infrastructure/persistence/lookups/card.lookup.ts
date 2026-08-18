import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditCardEntity } from '../../../../cards/infrastructure/persistence/entities/credit-card.entity';
import type { CardLookup } from '../../../domain/lookups';

/** Read-only ownership check over `credit_cards` (scoped by userId). */
@Injectable()
export class TypeOrmCardLookup implements CardLookup {
  constructor(
    @InjectRepository(CreditCardEntity)
    private readonly repo: Repository<CreditCardEntity>,
  ) {}

  async exists(id: string, userId: string): Promise<boolean> {
    return this.repo.exists({ where: { id, userId } });
  }
}
