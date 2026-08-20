import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('transactions')
@Index('idx_transactions_user_id', ['userId'])
@Index('idx_transactions_user_due', ['userId', 'dueDate'])
@Index('idx_transactions_user_status_due', ['userId', 'status', 'dueDate'])
@Index('idx_transactions_group', ['groupId'])
export class TransactionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120 })
  description!: string;

  @Column({ name: 'due_date', type: 'timestamptz' })
  dueDate!: Date;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string;

  @Column({ name: 'effective_amount', type: 'numeric', precision: 18, scale: 2, nullable: true })
  effectiveAmount!: string | null;

  @Column({ type: 'varchar', length: 16 })
  recurrence!: string;

  @Column({ name: 'effective_date', type: 'timestamptz', nullable: true })
  effectiveDate!: Date | null;

  @Column({ type: 'varchar', length: 16 })
  type!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate!: Date | null;

  @Column({ name: 'installment_count', type: 'int', nullable: true })
  installmentCount!: number | null;

  @Column({ name: 'installment_number', type: 'int', nullable: true })
  installmentNumber!: number | null;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId!: string | null;

  @Column({ name: 'credit_card_id', type: 'uuid', nullable: true })
  creditCardId!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source!: string;

  @Column({ name: 'external_id', type: 'uuid', nullable: true })
  externalId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
