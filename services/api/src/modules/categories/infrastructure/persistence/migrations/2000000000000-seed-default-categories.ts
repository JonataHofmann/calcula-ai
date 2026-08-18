import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * System default categories (PT-BR), shared by every user. Fixed UUIDs and fixed
 * created_at timestamps make the seed deterministic and idempotent; users hide or
 * override them per-user rather than mutating these rows.
 */
export class SeedDefaultCategories2000000000000 implements MigrationInterface {
  name = 'SeedDefaultCategories2000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Roots. (id, parent, name, type, icon, color, created_at ms)
    const roots: [string, string, string, string, string, string][] = [
      ['0001', 'Alimentação', 'expense', 'utensils', 'danger', '001'],
      ['0002', 'Moradia', 'expense', 'house', 'warning', '002'],
      ['0003', 'Transporte', 'expense', 'car', 'info', '003'],
      ['0004', 'Lazer', 'expense', 'film', 'accent', '004'],
      ['0005', 'Saúde', 'expense', 'heart-pulse', 'primary', '005'],
      ['0006', 'Salário', 'income', 'banknote', 'success', '006'],
      ['0007', 'Investimentos', 'income', 'trending-up', 'primary', '007'],
      ['0008', 'Outros', 'income', 'hand-coins', 'info', '008'],
    ];
    // Subcategories. (id, parentId, name, type, icon, color, created_at ms)
    const subs: [string, string, string, string, string, string, string][] = [
      ['0101', '0001', 'Restaurante', 'expense', 'utensils', 'danger', '101'],
      ['0102', '0001', 'Mercado', 'expense', 'shopping-cart', 'danger', '102'],
      ['0201', '0002', 'Aluguel', 'expense', 'house', 'warning', '201'],
      ['0202', '0002', 'Contas', 'expense', 'receipt', 'warning', '202'],
      ['0301', '0003', 'Combustível', 'expense', 'fuel', 'info', '301'],
      ['0302', '0003', 'Transporte público', 'expense', 'bus', 'info', '302'],
      ['0401', '0004', 'Streaming', 'expense', 'tv', 'accent', '401'],
      ['0402', '0004', 'Jogos', 'expense', 'gamepad-2', 'accent', '402'],
      ['0501', '0005', 'Farmácia', 'expense', 'pill', 'primary', '501'],
      ['0502', '0005', 'Consultas', 'expense', 'stethoscope', 'primary', '502'],
    ];

    for (const [id, name, type, icon, color, ms] of roots) {
      await queryRunner.query(
        `INSERT INTO "categories"
           ("id", "owner_id", "parent_id", "name", "type", "icon", "color", "is_system", "created_at", "updated_at")
         VALUES ($1, NULL, NULL, $2, $3, $4, $5, true, $6, $6)
         ON CONFLICT ("id") DO NOTHING`,
        [uuid(id), name, type, icon, color, ts(ms)],
      );
    }
    for (const [id, parentId, name, type, icon, color, ms] of subs) {
      await queryRunner.query(
        `INSERT INTO "categories"
           ("id", "owner_id", "parent_id", "name", "type", "icon", "color", "is_system", "created_at", "updated_at")
         VALUES ($1, NULL, $2, $3, $4, $5, $6, true, $7, $7)
         ON CONFLICT ("id") DO NOTHING`,
        [uuid(id), uuid(parentId), name, type, icon, color, ts(ms)],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "categories" WHERE "is_system" = true`);
  }
}

/** Stable UUID from a 4-char suffix, e.g. "0001" -> 00000000-0000-4000-a000-000000000001. */
function uuid(suffix: string): string {
  return `00000000-0000-4000-a000-00000000${suffix}`;
}

/** Deterministic seed timestamp so effective-list ordering (created_at ASC) is stable. */
function ts(ms: string): string {
  return `2020-01-01 00:00:00.${ms}+00`;
}
