import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `original_description` to transactions: the raw imported description before any
 * user edit in the invoice-import review. Nullable — manual and unedited rows leave it
 * null. Category suggestions match on COALESCE(original_description, description) so the
 * merchant string keeps anchoring "find similar transactions" even after a rename.
 */
export class AddOriginalDescriptionToTransactions6000000000001
  implements MigrationInterface
{
  name = 'AddOriginalDescriptionToTransactions6000000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "original_description" character varying(120)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "original_description"`,
    );
  }
}
