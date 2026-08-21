import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCreditCardsTable1755600000000 implements MigrationInterface {
  name = 'CreateCreditCardsTable1755600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "credit_cards" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "name" varchar(80) NOT NULL,
        "last_digits" char(4) NOT NULL,
        "due_day" smallint NOT NULL,
        "closing_day" smallint NOT NULL,
        "limit" numeric(18,2) NOT NULL,
        "brand_id" varchar(40) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_credit_cards_user_id" ON "credit_cards" ("user_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_credit_cards_user_id"`);
    await queryRunner.query(`DROP TABLE "credit_cards"`);
  }
}
