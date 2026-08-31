import {
  Check,
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
// Impede duas linhas do mesmo grupo no mesmo vencimento — a materialização de
// ocorrências fixas roda em paralelo por várias janelas de listagem e, sem esta
// garantia, duas chamadas concorrentes inseriam o mesmo mês em duplicidade.
@Index('uq_transactions_group_due', ['groupId', 'dueDate'], {
  unique: true,
  where: '"group_id" IS NOT NULL',
})
// Espelha as CHECK constraints das migrations para que os testes de integração
// (synchronize:true) reproduzam as mesmas invariantes do banco migrado.
@Check('chk_transactions_amount_positive', `"amount" > 0`)
@Check(
  'chk_transactions_origin',
  `("account_id" IS NOT NULL AND "credit_card_id" IS NULL) OR ("account_id" IS NULL AND "credit_card_id" IS NOT NULL)`,
)
export class TransactionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120 })
  description!: string;

  @Column({ name: 'original_description', type: 'varchar', length: 120, nullable: true })
  originalDescription!: string | null;

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
