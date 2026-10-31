import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UpdateProductTables1786270000000 declared storage_key inside a
 * `CREATE TABLE IF NOT EXISTS product_images` block, but AddNewTables1785647672029
 * had already created that table without the column — so the create was a no-op and
 * the column never landed. Every query that selects ProductImage has been failing
 * with `column ... storage_key does not exist` ever since.
 */
export class AddProductImageStorageKey1786290000000 implements MigrationInterface {
  name = 'AddProductImageStorageKey1786290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE product_images ADD COLUMN IF NOT EXISTS storage_key VARCHAR(512) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(`ALTER TABLE product_images ALTER COLUMN storage_key DROP DEFAULT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE product_images DROP COLUMN IF EXISTS storage_key`);
  }
}
