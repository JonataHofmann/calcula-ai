import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImportedSourceToTransactions6000000000000
  implements MigrationInterface
{
  name = 'AddImportedSourceToTransactions6000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "chk_transactions_source"`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "chk_transactions_source"
        CHECK ("source" IN ('manual', 'synced', 'imported'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "chk_transactions_source"`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "chk_transactions_source"
        CHECK ("source" IN ('manual', 'synced'))
    `);
  }
}
