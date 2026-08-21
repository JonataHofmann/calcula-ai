import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('linked_account')
@Index('idx_linked_account_connection_pluggy', ['bankConnectionId', 'pluggyAccountId'], {
  unique: true,
})
@Index('idx_linked_account_user_id', ['userId'])
export class LinkedAccountEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'bank_connection_id', type: 'uuid' })
  bankConnectionId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'pluggy_account_id', type: 'text' })
  pluggyAccountId!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: string;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  balance!: string;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @Column({ name: 'api_account_id', type: 'uuid', nullable: true })
  apiAccountId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
