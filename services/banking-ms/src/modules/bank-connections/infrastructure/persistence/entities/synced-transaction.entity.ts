import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('synced_transaction')
@Index('idx_synced_transaction_user_pluggy', ['userId', 'pluggyTransactionId'], { unique: true })
@Index('idx_synced_transaction_sync_status', ['syncStatus'])
@Index('idx_synced_transaction_linked_account', ['linkedAccountId'])
@Index('idx_synced_transaction_linked_credit_card', ['linkedCreditCardId'])
export class SyncedTransactionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'linked_account_id', type: 'uuid', nullable: true })
  linkedAccountId!: string | null;

  @Column({ name: 'linked_credit_card_id', type: 'uuid', nullable: true })
  linkedCreditCardId!: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'pluggy_transaction_id', type: 'text' })
  pluggyTransactionId!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: 'date' })
  date!: Date;

  @Column({ type: 'varchar', length: 8 })
  direction!: string;

  @Column({ name: 'pluggy_status', type: 'varchar', length: 16 })
  pluggyStatus!: string;

  @Column({ name: 'installment_number', type: 'smallint', nullable: true })
  installmentNumber!: number | null;

  @Column({ name: 'installment_total', type: 'smallint', nullable: true })
  installmentTotal!: number | null;

  @Column({ name: 'sync_status', type: 'varchar', length: 16 })
  syncStatus!: string;

  @Column({ name: 'transactions_ms_id', type: 'uuid', nullable: true })
  transactionsMsId!: string | null;

  @Column({ name: 'retry_count', type: 'smallint', default: 0 })
  retryCount!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
