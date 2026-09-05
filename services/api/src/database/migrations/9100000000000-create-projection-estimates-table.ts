import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectionEstimatesTable9100000000000 implements MigrationInterface {
  name = 'CreateProjectionEstimatesTable9100000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "projection_estimates" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "description" varchar(120) NOT NULL,
        "amount" numeric(18,2) NOT NULL,
        "type" varchar(16) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_projection_estimates" PRIMARY KEY ("id"),
        CONSTRAINT "chk_projection_estimates_amount_positive" CHECK ("amount" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_projection_estimates_user_id" ON "projection_estimates" ("user_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_projection_estimates_user_id"`);
    await queryRunner.query(`DROP TABLE "projection_estimates"`);
  }
}
