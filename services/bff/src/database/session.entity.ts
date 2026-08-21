import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'keycloak_user_id', type: 'varchar' })
  keycloakUserId!: string;

  @Column({ name: 'encrypted_tokens', type: 'text' })
  encryptedTokens!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'last_activity_at', type: 'timestamptz' })
  lastActivityAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
