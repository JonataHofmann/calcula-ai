import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** A system default category hidden by one user (composite key keeps it per-user and idempotent). */
@Entity('user_hidden_categories')
@Index('idx_user_hidden_categories_user_id', ['userId'])
export class UserHiddenCategoryEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
