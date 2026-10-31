import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The header search box queries products with `ILIKE '%keyword%'` on every
 * keystroke. A leading wildcard makes a btree index useless, so each suggestion
 * lookup was a sequential scan over the whole products table.
 *
 * pg_trgm indexes trigrams rather than prefixes, which is the one thing that makes
 * a double-sided ILIKE index-scannable. Both searched columns get an index because
 * the query matches name OR description.
 */
export class AddProductSearchTrigramIndex1786340000000 implements MigrationInterface {
  name = 'AddProductSearchTrigramIndex1786340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING gin (description gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_description_trgm`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_name_trgm`);
    // The extension is left installed: other objects may come to depend on it, and
    // dropping it is not what rolling back this index is asking for.
  }
}
