import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Relaxa `chk_transactions_origin` para permitir receita vinculada a um cartão de
 * crédito (estorno/crédito de fatura importada). Antes: income exigia account_id e
 * proibia credit_card_id. Agora a regra é a mesma para ambos os tipos — exatamente
 * uma das origens (conta OU cartão) preenchida.
 */
export class AllowIncomeOnCreditCard6000000000003
  implements MigrationInterface
{
  name = 'AllowIncomeOnCreditCard6000000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "chk_transactions_origin"`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "chk_transactions_origin" CHECK (
          ("account_id" IS NOT NULL AND "credit_card_id" IS NULL) OR
          ("account_id" IS NULL AND "credit_card_id" IS NOT NULL)
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "chk_transactions_origin"`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "chk_transactions_origin" CHECK (
          ("type" = 'expense' AND (
            ("account_id" IS NOT NULL AND "credit_card_id" IS NULL) OR
            ("account_id" IS NULL AND "credit_card_id" IS NOT NULL)
          )) OR
          ("type" = 'income' AND "account_id" IS NOT NULL AND "credit_card_id" IS NULL)
        )
    `);
  }
}
