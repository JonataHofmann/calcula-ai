import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('bank_connection')
@Index('idx_bank_connection_user_item', ['userId', 'pluggyItemId'], { unique: true })
@Index('idx_bank_connection_user_id', ['userId'])
export class BankConnectionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'pluggy_item_id', type: 'text' })
  pluggyItemId!: string;

  @Column({ name: 'institution_id', type: 'text' })
  institutionId!: string;

  @Column({ name: 'institution_name', type: 'text' })
  institutionName!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
