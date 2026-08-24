import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessions1755400000000 implements MigrationInterface {
  name = 'CreateSessions1755400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "bff"`);
    await queryRunner.query(`
      CREATE TABLE "bff"."sessions" (
        "id" uuid PRIMARY KEY,
        "keycloak_user_id" varchar NOT NULL,
        "encrypted_tokens" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_activity_at" timestamptz NOT NULL,
        "expires_at" timestamptz NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_sessions_expires_at" ON "bff"."sessions" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bff"."sessions"`);
  }
}
