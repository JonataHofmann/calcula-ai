import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiLinkage1755700100000 implements MigrationInterface {
  name = 'AddApiLinkage1755700100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "banking"."linked_account" ADD COLUMN "api_account_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "banking"."linked_credit_card" ADD COLUMN "api_credit_card_id" uuid`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "banking"."linked_credit_card" DROP COLUMN "api_credit_card_id"`);
    await queryRunner.query(`ALTER TABLE "banking"."linked_account" DROP COLUMN "api_account_id"`);
  }
}
