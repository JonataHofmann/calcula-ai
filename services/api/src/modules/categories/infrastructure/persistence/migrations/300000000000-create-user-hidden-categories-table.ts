import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserHiddenCategoriesTable300000000000 implements MigrationInterface {
  name = 'CreateUserHiddenCategoriesTable300000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_hidden_categories" (
        "user_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_user_hidden_categories" PRIMARY KEY ("user_id", "category_id"),
        CONSTRAINT "fk_user_hidden_categories_category" FOREIGN KEY ("category_id")
          REFERENCES "categories" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_hidden_categories_user_id" ON "user_hidden_categories" ("user_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_user_hidden_categories_user_id"`);
    await queryRunner.query(`DROP TABLE "user_hidden_categories"`);
  }
}
