import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountsTable1755500000000 implements MigrationInterface {
  name = 'CreateAccountsTable1755500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "name" varchar(80) NOT NULL,
        "bank_id" varchar(40) NOT NULL,
        "icon" varchar(40) NOT NULL,
        "color" varchar(24) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_accounts_user_id" ON "accounts" ("user_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_accounts_user_id"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
  }
}
