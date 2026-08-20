import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBankingSchema1755700000000 implements MigrationInterface {
  name = 'CreateBankingSchema1755700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "banking"`);

    await queryRunner.query(`
      CREATE TABLE "banking"."bank_connection" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "pluggy_item_id" text NOT NULL,
        "institution_id" text NOT NULL,
        "institution_name" text NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "last_synced_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_bank_connection_status"
          CHECK ("status" IN ('active', 'needs_attention', 'disconnected'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_bank_connection_user_item" ON "banking"."bank_connection" ("user_id", "pluggy_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_bank_connection_user_id" ON "banking"."bank_connection" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "banking"."linked_account" (
        "id" uuid PRIMARY KEY,
        "bank_connection_id" uuid NOT NULL REFERENCES "banking"."bank_connection" ("id"),
        "user_id" uuid NOT NULL,
        "pluggy_account_id" text NOT NULL,
        "type" varchar(32) NOT NULL,
        "display_name" text NOT NULL,
        "balance" numeric(14,2) NOT NULL,
        "currency" char(3) NOT NULL DEFAULT 'BRL',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_linked_account_connection_pluggy" ON "banking"."linked_account" ("bank_connection_id", "pluggy_account_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_linked_account_user_id" ON "banking"."linked_account" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "banking"."linked_credit_card" (
        "id" uuid PRIMARY KEY,
        "bank_connection_id" uuid NOT NULL REFERENCES "banking"."bank_connection" ("id"),
        "user_id" uuid NOT NULL,
        "pluggy_account_id" text NOT NULL,
        "brand" text,
        "last_digits" varchar(4),
        "credit_limit" numeric(14,2),
        "available_limit" numeric(14,2),
        "current_balance" numeric(14,2) NOT NULL,
        "closing_date" date,
        "due_date" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_linked_credit_card_last_digits"
          CHECK ("last_digits" IS NULL OR "last_digits" ~ '^\\d{4}$')
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_linked_credit_card_connection_pluggy" ON "banking"."linked_credit_card" ("bank_connection_id", "pluggy_account_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_linked_credit_card_user_id" ON "banking"."linked_credit_card" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "banking"."synced_transaction" (
        "id" uuid PRIMARY KEY,
        "linked_account_id" uuid REFERENCES "banking"."linked_account" ("id"),
        "linked_credit_card_id" uuid REFERENCES "banking"."linked_credit_card" ("id"),
        "user_id" uuid NOT NULL,
        "pluggy_transaction_id" text NOT NULL,
        "description" text NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "date" date NOT NULL,
        "direction" varchar(8) NOT NULL,
        "pluggy_status" varchar(16) NOT NULL,
        "installment_number" smallint,
        "installment_total" smallint,
        "sync_status" varchar(16) NOT NULL DEFAULT 'pending',
        "transactions_ms_id" uuid,
        "retry_count" smallint NOT NULL DEFAULT 0,
        "last_error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_synced_transaction_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "chk_synced_transaction_direction" CHECK ("direction" IN ('credit', 'debit')),
        CONSTRAINT "chk_synced_transaction_pluggy_status" CHECK ("pluggy_status" IN ('pending', 'posted')),
        CONSTRAINT "chk_synced_transaction_sync_status"
          CHECK ("sync_status" IN ('pending', 'processing', 'success', 'error')),
        CONSTRAINT "chk_synced_transaction_origin" CHECK (
          ("linked_account_id" IS NOT NULL AND "linked_credit_card_id" IS NULL) OR
          ("linked_account_id" IS NULL AND "linked_credit_card_id" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_synced_transaction_user_pluggy" ON "banking"."synced_transaction" ("user_id", "pluggy_transaction_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_synced_transaction_sync_status" ON "banking"."synced_transaction" ("sync_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_synced_transaction_linked_account" ON "banking"."synced_transaction" ("linked_account_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_synced_transaction_linked_credit_card" ON "banking"."synced_transaction" ("linked_credit_card_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "banking"."synced_transaction"`);
    await queryRunner.query(`DROP TABLE "banking"."linked_credit_card"`);
    await queryRunner.query(`DROP TABLE "banking"."linked_account"`);
    await queryRunner.query(`DROP TABLE "banking"."bank_connection"`);
    await queryRunner.query(`DROP SCHEMA "banking"`);
  }
}
