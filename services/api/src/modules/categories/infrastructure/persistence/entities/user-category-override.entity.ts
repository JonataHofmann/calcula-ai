import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A user's copy-on-write override of a system default category's presentation (never its type). */
@Entity('user_category_overrides')
@Index('idx_user_category_overrides_user_id', ['userId'])
export class UserCategoryOverrideEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'varchar', length: 40 })
  icon!: string;

  @Column({ type: 'varchar', length: 24 })
  color!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
