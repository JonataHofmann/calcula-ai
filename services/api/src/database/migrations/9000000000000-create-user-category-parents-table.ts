import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserCategoryParentsTable9000000000000 implements MigrationInterface {
  name = 'CreateUserCategoryParentsTable9000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_category_parents" (
        "user_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "parent_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_user_category_parents" PRIMARY KEY ("user_id", "category_id"),
        CONSTRAINT "fk_user_category_parents_category" FOREIGN KEY ("category_id")
          REFERENCES "categories" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_category_parents_user_id" ON "user_category_parents" ("user_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_user_category_parents_user_id"`);
    await queryRunner.query(`DROP TABLE "user_category_parents"`);
  }
}
