import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { BankConnectionStatus, LinkedAccountType, SyncStatus } from '@finance/contracts';
import { BankConnection } from '../../../domain/bank-connection';
import type { BankConnectionRepository } from '../../../domain/bank-connection.repository';
import { LinkedAccount } from '../../../domain/linked-account';
import { LinkedCreditCard } from '../../../domain/linked-credit-card';
import { SyncedTransaction } from '../../../domain/synced-transaction';
import { BankConnectionEntity } from '../entities/bank-connection.entity';
import { LinkedAccountEntity } from '../entities/linked-account.entity';
import { LinkedCreditCardEntity } from '../entities/linked-credit-card.entity';
import { SyncedTransactionEntity } from '../entities/synced-transaction.entity';

@Injectable()
export class TypeOrmBankConnectionRepository implements BankConnectionRepository {
  constructor(
    @InjectRepository(BankConnectionEntity)
    private readonly connectionRepo: Repository<BankConnectionEntity>,
    @InjectRepository(LinkedAccountEntity)
    private readonly accountRepo: Repository<LinkedAccountEntity>,
    @InjectRepository(LinkedCreditCardEntity)
    private readonly cardRepo: Repository<LinkedCreditCardEntity>,
    @InjectRepository(SyncedTransactionEntity)
    private readonly transactionRepo: Repository<SyncedTransactionEntity>,
  ) {}

  async create(connection: BankConnection): Promise<void> {
    await this.connectionRepo.insert(toConnectionEntity(connection));
  }

  async save(connection: BankConnection): Promise<void> {
    await this.connectionRepo.save(toConnectionEntity(connection));
  }

  async findById(id: string, userId: string): Promise<BankConnection | null> {
    const row = await this.connectionRepo.findOne({ where: { id, userId } });
    return row ? toConnectionDomain(row) : null;
  }

  async findByUserAndItem(userId: string, pluggyItemId: string): Promise<BankConnection | null> {
    const row = await this.connectionRepo.findOne({ where: { userId, pluggyItemId } });
    return row ? toConnectionDomain(row) : null;
  }

  async findByItemId(pluggyItemId: string): Promise<BankConnection | null> {
    const row = await this.connectionRepo.findOne({ where: { pluggyItemId } });
    return row ? toConnectionDomain(row) : null;
  }

  async findAllByUser(userId: string): Promise<BankConnection[]> {
    const rows = await this.connectionRepo.find({ where: { userId }, order: { createdAt: 'ASC' } });
    return rows.map(toConnectionDomain);
  }

  async findStaleActiveConnections(threshold: Date): Promise<BankConnection[]> {
    const rows = await this.connectionRepo
      .createQueryBuilder('c')
      .where('c.status = :status', { status: 'active' })
      .andWhere('(c.last_synced_at IS NULL OR c.last_synced_at < :threshold)', { threshold })
      .getMany();
    return rows.map(toConnectionDomain);
  }

  async countSyncedTransactions(
    bankConnectionId: string,
  ): Promise<{ total: number; errored: number }> {
    const row = await this.transactionRepo
      .createQueryBuilder('t')
      .leftJoin(LinkedAccountEntity, 'la', 'la.id = t.linked_account_id')
      .leftJoin(LinkedCreditCardEntity, 'lc', 'lc.id = t.linked_credit_card_id')
      .where('la.bank_connection_id = :id OR lc.bank_connection_id = :id', { id: bankConnectionId })
      .select('COUNT(*)', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE t.sync_status = 'error')`, 'errored')
      .getRawOne<{ total: string; errored: string }>();
    return { total: Number(row?.total ?? 0), errored: Number(row?.errored ?? 0) };
  }

  async upsertLinkedAccount(account: LinkedAccount): Promise<void> {
    await this.accountRepo.upsert(toAccountEntity(account), ['bankConnectionId', 'pluggyAccountId']);
  }

  async upsertLinkedCreditCard(card: LinkedCreditCard): Promise<void> {
    await this.cardRepo.upsert(toCardEntity(card), ['bankConnectionId', 'pluggyAccountId']);
  }

  async findLinkedAccountsByConnection(bankConnectionId: string): Promise<LinkedAccount[]> {
    const rows = await this.accountRepo.find({ where: { bankConnectionId } });
    return rows.map(toAccountDomain);
  }

  async findLinkedCreditCardsByConnection(bankConnectionId: string): Promise<LinkedCreditCard[]> {
    const rows = await this.cardRepo.find({ where: { bankConnectionId } });
    return rows.map(toCardDomain);
  }

  async findBankConnectionIdForOrigin(
    linkedAccountId: string | null,
    linkedCreditCardId: string | null,
  ): Promise<string | null> {
    if (linkedAccountId) {
      const row = await this.accountRepo.findOne({ where: { id: linkedAccountId } });
      return row?.bankConnectionId ?? null;
    }
    if (linkedCreditCardId) {
      const row = await this.cardRepo.findOne({ where: { id: linkedCreditCardId } });
      return row?.bankConnectionId ?? null;
    }
    return null;
  }

  async upsertSyncedTransaction(transaction: SyncedTransaction): Promise<void> {
    await this.transactionRepo.upsert(toTransactionEntity(transaction), ['userId', 'pluggyTransactionId']);
  }

  async findSyncedTransactionByPluggyId(
    userId: string,
    pluggyTransactionId: string,
  ): Promise<SyncedTransaction | null> {
    const row = await this.transactionRepo.findOne({ where: { userId, pluggyTransactionId } });
    return row ? toTransactionDomain(row) : null;
  }

  async findErroredSyncedTransactions(retryLimit: number): Promise<SyncedTransaction[]> {
    const rows = await this.transactionRepo
      .createQueryBuilder('t')
      .where('t.sync_status = :status', { status: 'error' })
      .andWhere('t.retry_count < :retryLimit', { retryLimit })
      .getMany();
    return rows.map(toTransactionDomain);
  }

  async deleteSyncedTransaction(id: string): Promise<void> {
    await this.transactionRepo.delete({ id });
  }

  async findSyncedTransactionsByOrigin(
    linkedAccountId: string | null,
    linkedCreditCardId: string | null,
  ): Promise<SyncedTransaction[]> {
    const rows = await this.transactionRepo.find({
      where: {
        linkedAccountId: linkedAccountId ?? IsNull(),
        linkedCreditCardId: linkedCreditCardId ?? IsNull(),
      },
    });
    return rows.map(toTransactionDomain);
  }
}

function toConnectionEntity(connection: BankConnection): BankConnectionEntity {
  const props = connection.toProps();
  const entity = new BankConnectionEntity();
  entity.id = props.id;
  entity.userId = props.userId;
  entity.pluggyItemId = props.pluggyItemId;
  entity.institutionId = props.institutionId;
  entity.institutionName = props.institutionName;
  entity.status = props.status;
  entity.lastSyncedAt = props.lastSyncedAt;
  entity.createdAt = props.createdAt;
  entity.updatedAt = props.updatedAt;
  return entity;
}

function toConnectionDomain(row: BankConnectionEntity): BankConnection {
  return BankConnection.restore({
    id: row.id,
    userId: row.userId,
    pluggyItemId: row.pluggyItemId,
    institutionId: row.institutionId,
    institutionName: row.institutionName,
    status: row.status as BankConnectionStatus,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toAccountEntity(account: LinkedAccount): LinkedAccountEntity {
  const props = account.toProps();
  const entity = new LinkedAccountEntity();
  entity.id = props.id;
  entity.bankConnectionId = props.bankConnectionId;
  entity.userId = props.userId;
  entity.pluggyAccountId = props.pluggyAccountId;
  entity.type = props.type;
  entity.displayName = props.displayName;
  entity.balance = props.balance;
  entity.currency = props.currency;
  entity.apiAccountId = props.apiAccountId;
  entity.createdAt = props.createdAt;
  entity.updatedAt = props.updatedAt;
  return entity;
}

function toAccountDomain(row: LinkedAccountEntity): LinkedAccount {
  return LinkedAccount.restore({
    id: row.id,
    bankConnectionId: row.bankConnectionId,
    userId: row.userId,
    pluggyAccountId: row.pluggyAccountId,
    type: row.type as LinkedAccountType,
    displayName: row.displayName,
    balance: row.balance,
    currency: row.currency as 'BRL',
    apiAccountId: row.apiAccountId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toCardEntity(card: LinkedCreditCard): LinkedCreditCardEntity {
  const props = card.toProps();
  const entity = new LinkedCreditCardEntity();
  entity.id = props.id;
  entity.bankConnectionId = props.bankConnectionId;
  entity.userId = props.userId;
  entity.pluggyAccountId = props.pluggyAccountId;
  entity.brand = props.brand;
  entity.lastDigits = props.lastDigits;
  entity.creditLimit = props.creditLimit;
  entity.availableLimit = props.availableLimit;
  entity.currentBalance = props.currentBalance;
  entity.closingDate = props.closingDate;
  entity.dueDate = props.dueDate;
  entity.apiCreditCardId = props.apiCreditCardId;
  entity.createdAt = props.createdAt;
  entity.updatedAt = props.updatedAt;
  return entity;
}

function toCardDomain(row: LinkedCreditCardEntity): LinkedCreditCard {
  return LinkedCreditCard.restore({
    id: row.id,
    bankConnectionId: row.bankConnectionId,
    userId: row.userId,
    pluggyAccountId: row.pluggyAccountId,
    brand: row.brand,
    lastDigits: row.lastDigits,
    creditLimit: row.creditLimit,
    availableLimit: row.availableLimit,
    currentBalance: row.currentBalance,
    closingDate: row.closingDate ? new Date(row.closingDate) : null,
    dueDate: row.dueDate ? new Date(row.dueDate) : null,
    apiCreditCardId: row.apiCreditCardId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toTransactionEntity(transaction: SyncedTransaction): SyncedTransactionEntity {
  const props = transaction.toProps();
  const entity = new SyncedTransactionEntity();
  entity.id = props.id;
  entity.linkedAccountId = props.linkedAccountId;
  entity.linkedCreditCardId = props.linkedCreditCardId;
  entity.userId = props.userId;
  entity.pluggyTransactionId = props.pluggyTransactionId;
  entity.description = props.description;
  entity.amount = props.amount;
  entity.date = props.date;
  entity.direction = props.direction;
  entity.pluggyStatus = props.pluggyStatus;
  entity.installmentNumber = props.installmentNumber;
  entity.installmentTotal = props.installmentTotal;
  entity.syncStatus = props.syncStatus;
  entity.transactionsMsId = props.transactionsMsId;
  entity.retryCount = props.retryCount;
  entity.lastError = props.lastError;
  entity.createdAt = props.createdAt;
  entity.updatedAt = props.updatedAt;
  return entity;
}

function toTransactionDomain(row: SyncedTransactionEntity): SyncedTransaction {
  return SyncedTransaction.restore({
    id: row.id,
    linkedAccountId: row.linkedAccountId,
    linkedCreditCardId: row.linkedCreditCardId,
    userId: row.userId,
    pluggyTransactionId: row.pluggyTransactionId,
    description: row.description,
    amount: row.amount,
    date: new Date(row.date),
    direction: row.direction as SyncedTransaction['direction'],
    pluggyStatus: row.pluggyStatus as SyncedTransaction['pluggyStatus'],
    installmentNumber: row.installmentNumber,
    installmentTotal: row.installmentTotal,
    syncStatus: row.syncStatus as SyncStatus,
    transactionsMsId: row.transactionsMsId,
    retryCount: row.retryCount,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
