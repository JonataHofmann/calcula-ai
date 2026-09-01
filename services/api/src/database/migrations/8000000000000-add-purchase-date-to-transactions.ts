import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona `purchase_date` (data real da compra) às transações. Para linhas de cartão, o
 * `due_date` passa a ser sempre o vencimento da fatura derivado do ciclo do cartão, e a data
 * digitada pelo usuário fica em `purchase_date`. Forward-only: linhas antigas ficam com
 * `purchase_date NULL` (sem backfill — o vencimento delas não é recalculado retroativamente).
 */
export class AddPurchaseDateToTransactions8000000000000 implements MigrationInterface {
  name = 'AddPurchaseDateToTransactions8000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN "purchase_date" timestamptz NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "purchase_date"`);
  }
}
