import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceExternalId1755700100000 implements MigrationInterface {
  name = 'AddSourceExternalId1755700100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN "source" varchar(16) NOT NULL DEFAULT 'manual',
        ADD COLUMN "external_id" uuid,
        ADD CONSTRAINT "chk_transactions_source" CHECK ("source" IN ('manual', 'synced'))
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_transactions_user_external_id"
        ON "transactions" ("user_id", "external_id")
        WHERE "external_id" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_transactions_user_external_id"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "chk_transactions_source"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "external_id"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "source"`);
  }
}
