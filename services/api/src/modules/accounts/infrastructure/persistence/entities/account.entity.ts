import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('accounts')
@Index('idx_accounts_user_id', ['userId'])
export class AccountEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ name: 'bank_id', type: 'varchar', length: 40 })
  bankId!: string;

  @Column({ type: 'varchar', length: 40 })
  icon!: string;

  @Column({ type: 'varchar', length: 24 })
  color!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
