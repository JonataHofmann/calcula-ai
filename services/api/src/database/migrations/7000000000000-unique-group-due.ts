import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Garante unicidade de `(group_id, due_date)` para linhas agrupadas (recorrência fixa e
 * parcelada). A materialização de ocorrências fixas roda em paralelo a partir de várias
 * janelas de listagem (dashboard + transações); sem esta garantia, duas chamadas concorrentes
 * liam o mesmo mês como ausente e inseriam a mesma ocorrência em duplicidade.
 *
 * Primeiro deduplica linhas já existentes (mantendo a paga, senão a mais antiga), depois cria
 * o índice único parcial. `group_id` nulo (transações avulsas) fica de fora — NULLs não colidem.
 */
export class UniqueGroupDue7000000000000 implements MigrationInterface {
  name = 'UniqueGroupDue7000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "transactions" t
      USING (
        SELECT "id",
          row_number() OVER (
            PARTITION BY "group_id", "due_date"
            ORDER BY ("status" = 'paid') DESC, "created_at" ASC, "id" ASC
          ) AS rn
        FROM "transactions"
        WHERE "group_id" IS NOT NULL
      ) d
      WHERE t."id" = d."id" AND d.rn > 1
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_transactions_group_due" ON "transactions" ("group_id", "due_date") WHERE "group_id" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_transactions_group_due"`);
  }
}
