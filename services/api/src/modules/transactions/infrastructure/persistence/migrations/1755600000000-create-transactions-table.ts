import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransactionsTable1755600000000 implements MigrationInterface {
  name = 'CreateTransactionsTable1755600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "description" varchar(120) NOT NULL,
        "due_date" timestamptz NOT NULL,
        "amount" numeric(18,2) NOT NULL,
        "effective_amount" numeric(18,2),
        "recurrence" varchar(16) NOT NULL,
        "effective_date" timestamptz,
        "type" varchar(16) NOT NULL,
        "notes" text,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "end_date" timestamptz,
        "installment_count" int,
        "installment_number" int,
        "group_id" uuid,
        "category_id" uuid NOT NULL,
        "account_id" uuid,
        "credit_card_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_transactions_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "chk_transactions_effective_amount_positive"
          CHECK ("effective_amount" IS NULL OR "effective_amount" > 0),
        CONSTRAINT "chk_transactions_recurrence"
          CHECK ("recurrence" IN ('single', 'fixed', 'installment')),
        CONSTRAINT "chk_transactions_type" CHECK ("type" IN ('expense', 'income')),
        CONSTRAINT "chk_transactions_status" CHECK ("status" IN ('pending', 'paid')),
        CONSTRAINT "chk_transactions_origin" CHECK (
          ("type" = 'expense' AND (
            ("account_id" IS NOT NULL AND "credit_card_id" IS NULL) OR
            ("account_id" IS NULL AND "credit_card_id" IS NOT NULL)
          )) OR
          ("type" = 'income' AND "account_id" IS NOT NULL AND "credit_card_id" IS NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_user_id" ON "transactions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_user_due" ON "transactions" ("user_id", "due_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_user_status_due" ON "transactions" ("user_id", "status", "due_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_group" ON "transactions" ("group_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_transactions_group"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_user_status_due"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_user_due"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_user_id"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
  }
}
