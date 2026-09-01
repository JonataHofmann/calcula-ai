import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  isCardBrandId,
  type CreateCreditCardInput,
  type UpdateCreditCardInput,
} from '@finance/contracts';
import { CreditCardEntity } from './entities/credit-card.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { CardResponseDto } from './dto/card-response.dto';
import { CardConverter } from './converters/card.converter';
import { CreditCardNotFoundError, InvalidCreditCardError } from './cards.types';

/**
 * All business logic for the cards module. Persistence is accessed exclusively
 * via the injected TypeORM repository (FR-008, FR-009); every query is scoped by
 * userId so cross-user rows are invisible (surfaced as 404 upstream).
 */
@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    @InjectRepository(CreditCardEntity)
    private readonly repo: Repository<CreditCardEntity>,
    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,
  ) {}

  async list(userId: string): Promise<CardResponseDto[]> {
    this.logger.log(`Listing cards for user ${userId}`);
    const rows = await this.repo.find({ where: { userId }, order: { createdAt: 'ASC' } });
    this.logger.log(`Listed ${rows.length} card(s) for user ${userId}`);
    return rows.map(CardConverter.toResponse);
  }

  async create(userId: string, input: CreateCreditCardInput): Promise<CardResponseDto> {
    this.logger.log(`Creating card "${input.name}" for user ${userId}`);
    const name = this.assertName(input.name);
    const lastDigits = this.assertLastDigits(input.lastDigits);
    const dueDay = this.assertDay(input.dueDay, 'dueDay');
    const closingDay = this.assertDay(input.closingDay, 'closingDay');
    const limit = this.assertLimit(input.limit);
    const brandId = this.assertBrand(input.brandId);

    const now = new Date();
    const entity = this.repo.create({
      id: randomUUID(),
      userId,
      name,
      lastDigits,
      dueDay,
      closingDay,
      limit,
      brandId,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.insert(entity);
    this.logger.log(`Created card ${entity.id} for user ${userId}`);
    return CardConverter.toResponse(entity);
  }

  async update(userId: string, id: string, input: UpdateCreditCardInput): Promise<CardResponseDto> {
    this.logger.log(`Updating card ${id} for user ${userId}`);
    const entity = await this.repo.findOne({ where: { id, userId } });
    if (!entity) {
      this.logger.warn(`Card ${id} not found for user ${userId}`);
      throw new CreditCardNotFoundError(id);
    }

    if (input.name !== undefined) entity.name = this.assertName(input.name);
    if (input.lastDigits !== undefined) entity.lastDigits = this.assertLastDigits(input.lastDigits);
    if (input.dueDay !== undefined) entity.dueDay = this.assertDay(input.dueDay, 'dueDay');
    if (input.closingDay !== undefined) {
      entity.closingDay = this.assertDay(input.closingDay, 'closingDay');
    }
    if (input.limit !== undefined) entity.limit = this.assertLimit(input.limit);
    if (input.brandId !== undefined) entity.brandId = this.assertBrand(input.brandId);
    entity.updatedAt = new Date();

    await this.repo.save(entity);
    this.logger.log(`Updated card ${id} for user ${userId}`);
    return CardConverter.toResponse(entity);
  }

  /** Number of transactions linked to this card (for the delete confirmation). */
  async countTransactions(userId: string, id: string): Promise<number> {
    return this.txRepo.count({ where: { creditCardId: id, userId } });
  }

  async delete(userId: string, id: string, deleteTransactions = false): Promise<void> {
    this.logger.log(`Deleting card ${id} for user ${userId}`);
    const entity = await this.repo.findOne({ where: { id, userId } });
    if (!entity) {
      this.logger.warn(`Card ${id} not found for user ${userId}`);
      throw new CreditCardNotFoundError(id);
    }
    // Optionally cascade the card's transactions; otherwise they are kept (unlinked).
    if (deleteTransactions) {
      const { affected } = await this.txRepo.delete({ creditCardId: id, userId });
      this.logger.log(`Deleted ${affected ?? 0} transaction(s) of card ${id} for user ${userId}`);
    }
    await this.repo.delete({ id, userId });
    this.logger.log(`Deleted card ${id} for user ${userId}`);
  }

  private assertName(value: string): string {
    const name = value.trim();
    if (name.length === 0) throw new InvalidCreditCardError('Card name must not be empty');
    return name;
  }

  private assertLastDigits(value: string): string {
    if (!/^\d{4}$/.test(value)) {
      throw new InvalidCreditCardError('lastDigits must be exactly 4 digits');
    }
    return value;
  }

  private assertDay(value: number, field: string): number {
    if (!Number.isInteger(value) || value < 1 || value > 31) {
      throw new InvalidCreditCardError(`${field} must be an integer between 1 and 31`);
    }
    return value;
  }

  private assertLimit(value: string): string {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new InvalidCreditCardError('limit must be a non-negative decimal');
    }
    return value;
  }

  private assertBrand(brandId: string): string {
    if (!isCardBrandId(brandId)) throw new InvalidCreditCardError(`Unknown card brand: ${brandId}`);
    return brandId;
  }
}
