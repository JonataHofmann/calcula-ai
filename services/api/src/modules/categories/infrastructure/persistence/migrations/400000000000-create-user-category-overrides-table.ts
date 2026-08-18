import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserCategoryOverridesTable400000000000 implements MigrationInterface {
  name = 'CreateUserCategoryOverridesTable400000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_category_overrides" (
        "user_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "name" varchar(60) NOT NULL,
        "icon" varchar(40) NOT NULL,
        "color" varchar(24) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_user_category_overrides" PRIMARY KEY ("user_id", "category_id"),
        CONSTRAINT "fk_user_category_overrides_category" FOREIGN KEY ("category_id")
          REFERENCES "categories" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_category_overrides_user_id" ON "user_category_overrides" ("user_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_user_category_overrides_user_id"`);
    await queryRunner.query(`DROP TABLE "user_category_overrides"`);
  }
}
