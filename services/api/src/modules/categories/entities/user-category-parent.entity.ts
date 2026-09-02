import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A user's per-user reparent of a category (drag-and-drop). Only ever written for
 * shared system defaults — custom categories mutate their own `parentId`. `parentId`
 * null means the user promoted the default to a root; a uuid nests it under that root.
 * Composite key keeps it per-user and idempotent.
 */
@Entity('user_category_parents')
@Index('idx_user_category_parents_user_id', ['userId'])
export class UserCategoryParentEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
