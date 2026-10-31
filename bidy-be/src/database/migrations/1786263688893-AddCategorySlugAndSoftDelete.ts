import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategorySlugAndSoftDelete1786263688893 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add slug column with temporary default to allow NOT NULL on existing rows
    await queryRunner.query(
      `ALTER TABLE "categories" ADD COLUMN "slug" character varying(120) NOT NULL DEFAULT ''`
    );

    // 2. Add deleted_at column for soft delete
    await queryRunner.query(
      `ALTER TABLE "categories" ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE`
    );

    // 3. Backfill slugs from existing names (lowercase, spaces → hyphens)
    await queryRunner.query(
      String.raw`UPDATE "categories" SET "slug" = LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', '-', 'g'))`
    );

    // 4. Drop old global unique constraint on name
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "UQ_8b0be371d28245da6e4f4b61878"`
    );

    // 5. Add unique constraint on slug
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "UQ_categories_slug" UNIQUE ("slug")`
    );

    // 6. Remove default on slug (was only needed for backfill)
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "slug" DROP DEFAULT`
    );

    // 7. Partial unique indexes for (parent_id, LOWER(name)) uniqueness
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_categories_root_name" ON "categories" (LOWER("name")) WHERE "parent_id" IS NULL AND "deleted_at" IS NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_categories_parent_name" ON "categories" ("parent_id", LOWER("name")) WHERE "parent_id" IS NOT NULL AND "deleted_at" IS NULL`
    );

    // 8. Performance indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_categories_is_active" ON "categories" ("is_active")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_categories_parent_active" ON "categories" ("parent_id", "is_active")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_categories_created_at" ON "categories" ("created_at" DESC)`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_categories_not_deleted" ON "categories" ("id") WHERE "deleted_at" IS NULL`
    );

    // 9. Change parent_id FK from SET NULL to RESTRICT
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "FK_88cea2dc9c31951d06437879b40"`
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_parent_id" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse FK change
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "FK_categories_parent_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );

    // Drop performance indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_not_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_parent_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_categories_is_active"`);

    // Drop partial unique indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_categories_parent_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_categories_root_name"`);

    // Drop slug unique constraint
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "UQ_categories_slug"`
    );

    // Restore global unique constraint on name
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name")`
    );

    // Drop new columns
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "slug"`);
  }
}
