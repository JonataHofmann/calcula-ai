import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * System "Sem Categoria" expense placeholder. Invoice import assigns it to any line the
 * AI and the user's history both failed to categorize (see InvoiceImportService in the
 * BFF), so nothing is ever imported uncategorized and the user can filter/fix them later.
 * Distinct from the "Outros" catch-all (0009): this one means "not categorized yet", and
 * is excluded from the list offered to the AI so the model never picks it as a cop-out.
 */
export class SeedSemCategoriaCategory6000000000002 implements MigrationInterface {
  name = 'SeedSemCategoriaCategory6000000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "categories"
         ("id", "owner_id", "parent_id", "name", "type", "icon", "color", "is_system", "created_at", "updated_at")
       VALUES ($1, NULL, NULL, 'Sem Categoria', 'expense', 'tag', 'slate', true, $2, $2)
       ON CONFLICT ("id") DO NOTHING`,
      [SEM_CATEGORIA_ID, '2020-01-01 00:00:00.010+00'],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "categories" WHERE "id" = $1`, [
      SEM_CATEGORIA_ID,
    ]);
  }
}

const SEM_CATEGORIA_ID = '00000000-0000-4000-a000-000000000010';
