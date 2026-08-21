import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategoriesTable1000000000000 implements MigrationInterface {
  name = 'CreateCategoriesTable1000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid PRIMARY KEY,
        "owner_id" uuid,
        "parent_id" uuid,
        "name" varchar(60) NOT NULL,
        "type" varchar(16) NOT NULL,
        "icon" varchar(40) NOT NULL,
        "color" varchar(24) NOT NULL,
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_categories_parent" FOREIGN KEY ("parent_id")
          REFERENCES "categories" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_categories_owner_id" ON "categories" ("owner_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_categories_parent_id" ON "categories" ("parent_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_categories_parent_id"`);
    await queryRunner.query(`DROP INDEX "idx_categories_owner_id"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
