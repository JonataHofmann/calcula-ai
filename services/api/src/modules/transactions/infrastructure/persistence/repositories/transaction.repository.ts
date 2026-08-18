import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TransactionSort } from '@finance/contracts';
import { Transaction } from '../../../domain/transaction';
import type {
  FindTransactionsFilter,
  TransactionRepository,
} from '../../../domain/transaction.repository';
import { TransactionEntity } from '../entities/transaction.entity';

const SORT_COLUMN: Record<TransactionSort, string> = {
  dueDate: 't.due_date',
  amount: 't.amount',
  description: 't.description',
  status: 't.status',
  type: 't.type',
  recurrence: 't.recurrence',
};

@Injectable()
export class TypeOrmTransactionRepository implements TransactionRepository {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly repo: Repository<TransactionEntity>,
  ) {}

  async create(transaction: Transaction): Promise<void> {
    await this.repo.insert(toEntity(transaction));
  }

  async createMany(transactions: Transaction[]): Promise<void> {
    if (transactions.length === 0) return;
    await this.repo.manager.transaction(async (manager) => {
      await manager.insert(TransactionEntity, transactions.map(toEntity));
    });
  }

  async save(transaction: Transaction): Promise<void> {
    await this.repo.save(toEntity(transaction));
  }

  async saveMany(transactions: Transaction[]): Promise<void> {
    if (transactions.length === 0) return;
    await this.repo.manager.transaction(async (manager) => {
      await manager.save(transactions.map(toEntity));
    });
  }

  async findById(id: string, userId: string): Promise<Transaction | null> {
    const row = await this.repo.findOne({ where: { id, userId } });
    return row ? toDomain(row) : null;
  }

  async find(userId: string, filter: FindTransactionsFilter): Promise<Transaction[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.due_date >= :dueFrom', { dueFrom: filter.dueFrom })
      .andWhere('t.due_date <= :dueTo', { dueTo: filter.dueTo });

    if (filter.search) {
      qb.andWhere(
        '(t.description ILIKE :search OR t.notes ILIKE :search OR t.amount::text ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }
    if (filter.amount) {
      qb.andWhere('t.amount::text ILIKE :amount', { amount: `%${filter.amount}%` });
    }
    if (filter.recurrence) qb.andWhere('t.recurrence = :recurrence', { recurrence: filter.recurrence });
    if (filter.type) qb.andWhere('t.type = :type', { type: filter.type });
    if (filter.categoryId) qb.andWhere('t.category_id = :categoryId', { categoryId: filter.categoryId });
    if (filter.accountId) qb.andWhere('t.account_id = :accountId', { accountId: filter.accountId });
    if (filter.creditCardId)
      qb.andWhere('t.credit_card_id = :creditCardId', { creditCardId: filter.creditCardId });

    qb.orderBy(SORT_COLUMN[filter.sort], filter.order === 'desc' ? 'DESC' : 'ASC');
    qb.addOrderBy('t.id', 'ASC');

    const rows = await qb.getMany();
    return rows.map(toDomain);
  }

  async findOverdue(userId: string, before: Date): Promise<Transaction[]> {
    const rows = await this.repo
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere("t.status = 'pending'")
      .andWhere('t.due_date < :before', { before })
      .orderBy('t.due_date', 'ASC')
      .addOrderBy('t.id', 'ASC')
      .getMany();
    return rows.map(toDomain);
  }

  async findGroup(groupId: string, userId: string): Promise<Transaction[]> {
    const rows = await this.repo.find({
      where: { groupId, userId },
      order: { dueDate: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.repo.delete({ id, userId });
  }

  async deleteGroup(groupId: string, userId: string): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      await manager.delete(TransactionEntity, { groupId, userId });
    });
  }
}

function toEntity(transaction: Transaction): TransactionEntity {
  const props = transaction.toProps();
  const entity = new TransactionEntity();
  entity.id = props.id;
  entity.userId = props.userId;
  entity.description = props.description;
  entity.dueDate = props.dueDate;
  entity.amount = props.amount;
  entity.effectiveAmount = props.effectiveAmount;
  entity.recurrence = props.recurrence;
  entity.effectiveDate = props.effectiveDate;
  entity.type = props.type;
  entity.notes = props.notes;
  entity.status = props.status;
  entity.endDate = props.endDate;
  entity.installmentCount = props.installmentCount;
  entity.installmentNumber = props.installmentNumber;
  entity.groupId = props.groupId;
  entity.categoryId = props.categoryId;
  entity.accountId = props.accountId;
  entity.creditCardId = props.creditCardId;
  entity.createdAt = props.createdAt;
  entity.updatedAt = props.updatedAt;
  return entity;
}

function toDomain(row: TransactionEntity): Transaction {
  return Transaction.restore({
    id: row.id,
    userId: row.userId,
    description: row.description,
    dueDate: row.dueDate,
    amount: row.amount,
    effectiveAmount: row.effectiveAmount,
    recurrence: row.recurrence as Transaction['recurrence'],
    effectiveDate: row.effectiveDate,
    type: row.type as Transaction['type'],
    notes: row.notes,
    status: row.status as Transaction['status'],
    endDate: row.endDate,
    installmentCount: row.installmentCount,
    installmentNumber: row.installmentNumber,
    groupId: row.groupId,
    categoryId: row.categoryId,
    accountId: row.accountId,
    creditCardId: row.creditCardId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
