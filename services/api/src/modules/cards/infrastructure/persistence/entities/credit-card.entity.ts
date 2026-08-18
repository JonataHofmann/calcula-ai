import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('credit_cards')
@Index('idx_credit_cards_user_id', ['userId'])
export class CreditCardEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ name: 'last_digits', type: 'char', length: 4 })
  lastDigits!: string;

  @Column({ name: 'due_day', type: 'smallint' })
  dueDay!: number;

  @Column({ name: 'closing_day', type: 'smallint' })
  closingDay!: number;

  @Column({ name: 'limit', type: 'numeric', precision: 18, scale: 2 })
  limit!: string;

  @Column({ name: 'brand_id', type: 'varchar', length: 40 })
  brandId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
