import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('categories')
@Index('idx_categories_owner_id', ['ownerId'])
@Index('idx_categories_parent_id', ['parentId'])
export class CategoryEntity {
  @PrimaryColumn('uuid')
  id!: string;

  /** Null for system default categories shared by all users. */
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId!: string | null;

  /** Null for root categories. */
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: string;

  @Column({ type: 'varchar', length: 40 })
  icon!: string;

  @Column({ type: 'varchar', length: 24 })
  color!: string;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
