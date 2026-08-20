import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expense-side "Outros" catch-all, mirroring income's 0008 (2000000000000 seed). Used as the
 * default category for synced (Pluggy) transactions imported without a categoryId — see
 * CategoryLookup.findDefaultId in the transactions module.
 */
export class SeedDefaultExpenseCatchallCategory5000000000000 implements MigrationInterface {
  name = 'SeedDefaultExpenseCatchallCategory5000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "categories"
         ("id", "owner_id", "parent_id", "name", "type", "icon", "color", "is_system", "created_at", "updated_at")
       VALUES ($1, NULL, NULL, 'Outros', 'expense', 'hand-coins', 'info', true, $2, $2)
       ON CONFLICT ("id") DO NOTHING`,
      [uuid('0009'), ts('009')],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "categories" WHERE "id" = $1`, [uuid('0009')]);
  }
}

function uuid(suffix: string): string {
  return `00000000-0000-4000-a000-00000000${suffix}`;
}

function ts(ms: string): string {
  return `2020-01-01 00:00:00.${ms}+00`;
}
