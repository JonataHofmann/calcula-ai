import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  isBankId,
  isColorToken,
  isIconKey,
  type CreateAccountInput,
  type UpdateAccountInput,
} from '@finance/contracts';
import { AccountEntity } from './entities/account.entity';
import { AccountResponseDto } from './dto/account-response.dto';
import { AccountConverter } from './converters/account.converter';
import { AccountNotFoundError, InvalidAccountError } from './accounts.types';

/**
 * All business logic for the accounts module. Persistence is accessed exclusively
 * via the injected TypeORM repository (FR-008, FR-009); every query is scoped by
 * userId so cross-user rows are invisible (surfaced as 404 upstream).
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(AccountEntity)
    private readonly repo: Repository<AccountEntity>,
  ) {}

  async list(userId: string): Promise<AccountResponseDto[]> {
    this.logger.log(`Listing accounts for user ${userId}`);
    const rows = await this.repo.find({ where: { userId }, order: { createdAt: 'ASC' } });
    this.logger.log(`Listed ${rows.length} account(s) for user ${userId}`);
    return rows.map(AccountConverter.toResponse);
  }

  async create(userId: string, input: CreateAccountInput): Promise<AccountResponseDto> {
    this.logger.log(`Creating account "${input.name}" for user ${userId}`);
    const name = this.assertName(input.name);
    this.assertCatalog(input.bankId, input.icon, input.color);

    const now = new Date();
    const entity = this.repo.create({
      id: randomUUID(),
      userId,
      name,
      bankId: input.bankId,
      icon: input.icon,
      color: input.color,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.insert(entity);
    this.logger.log(`Created account ${entity.id} for user ${userId}`);
    return AccountConverter.toResponse(entity);
  }

  async update(userId: string, id: string, input: UpdateAccountInput): Promise<AccountResponseDto> {
    this.logger.log(`Updating account ${id} for user ${userId}`);
    const entity = await this.repo.findOne({ where: { id, userId } });
    if (!entity) {
      this.logger.warn(`Account ${id} not found for user ${userId}`);
      throw new AccountNotFoundError(id);
    }

    if (input.name !== undefined) entity.name = this.assertName(input.name);
    if (input.bankId !== undefined) {
      if (!isBankId(input.bankId)) throw new InvalidAccountError(`Unknown bank: ${input.bankId}`);
      entity.bankId = input.bankId;
    }
    if (input.icon !== undefined) {
      if (!isIconKey(input.icon)) throw new InvalidAccountError(`Unknown icon: ${input.icon}`);
      entity.icon = input.icon;
    }
    if (input.color !== undefined) {
      if (!isColorToken(input.color)) throw new InvalidAccountError(`Unknown color: ${input.color}`);
      entity.color = input.color;
    }
    entity.updatedAt = new Date();

    await this.repo.save(entity);
    this.logger.log(`Updated account ${id} for user ${userId}`);
    return AccountConverter.toResponse(entity);
  }

  async delete(userId: string, id: string): Promise<void> {
    this.logger.log(`Deleting account ${id} for user ${userId}`);
    const entity = await this.repo.findOne({ where: { id, userId } });
    if (!entity) {
      this.logger.warn(`Account ${id} not found for user ${userId}`);
      throw new AccountNotFoundError(id);
    }
    await this.repo.delete({ id, userId });
    this.logger.log(`Deleted account ${id} for user ${userId}`);
  }

  private assertName(value: string): string {
    const name = value.trim();
    if (name.length === 0) throw new InvalidAccountError('Account name must not be empty');
    return name;
  }

  private assertCatalog(bankId: string, icon: string, color: string): void {
    if (!isBankId(bankId)) throw new InvalidAccountError(`Unknown bank: ${bankId}`);
    if (!isIconKey(icon)) throw new InvalidAccountError(`Unknown icon: ${icon}`);
    if (!isColorToken(color)) throw new InvalidAccountError(`Unknown color: ${color}`);
  }
}
