import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A projection-only estimate: a recurring monthly average shown in the forecast (and counted in
 * its Total) that is NEVER a real transaction. Lives in its own table so the transactions listing
 * never sees it. `amount` is a positive magnitude; `type` (expense|income) carries the direction.
 */
@Entity('projection_estimates')
@Index('idx_projection_estimates_user_id', ['userId'])
@Check('chk_projection_estimates_amount_positive', `"amount" > 0`)
export class ProjectionEstimateEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120 })
  description!: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: 'expense' | 'income';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
