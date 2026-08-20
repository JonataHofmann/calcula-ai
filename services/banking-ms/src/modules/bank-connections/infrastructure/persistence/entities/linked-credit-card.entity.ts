import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('linked_credit_card')
@Index('idx_linked_credit_card_connection_pluggy', ['bankConnectionId', 'pluggyAccountId'], {
  unique: true,
})
@Index('idx_linked_credit_card_user_id', ['userId'])
export class LinkedCreditCardEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'bank_connection_id', type: 'uuid' })
  bankConnectionId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'pluggy_account_id', type: 'text' })
  pluggyAccountId!: string;

  @Column({ type: 'text', nullable: true })
  brand!: string | null;

  @Column({ name: 'last_digits', type: 'varchar', length: 4, nullable: true })
  lastDigits!: string | null;

  @Column({ name: 'credit_limit', type: 'numeric', precision: 14, scale: 2, nullable: true })
  creditLimit!: string | null;

  @Column({ name: 'available_limit', type: 'numeric', precision: 14, scale: 2, nullable: true })
  availableLimit!: string | null;

  @Column({ name: 'current_balance', type: 'numeric', precision: 14, scale: 2 })
  currentBalance!: string;

  @Column({ name: 'closing_date', type: 'date', nullable: true })
  closingDate!: Date | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
