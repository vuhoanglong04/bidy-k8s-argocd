import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateProductTables1786270000000 implements MigrationInterface {
  name = 'UpdateProductTables1786270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns to existing products table
    await queryRunner.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS slug VARCHAR(300) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'draft'`);
    await queryRunner.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL`);
    
    // Drop default on slug after adding it, assuming it will be populated later
    await queryRunner.query(`ALTER TABLE products ALTER COLUMN slug DROP DEFAULT`);

    // Add check constraint for condition
    await queryRunner.query(`ALTER TABLE products ADD CONSTRAINT chk_products_condition CHECK (condition IN ('new', 'like_new', 'used', 'refurbished'))`);

    // Create indexes for products
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_products_owner_id ON products(owner_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_products_category_status_created ON products(category_id, status, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_products_owner_status_created ON products(owner_id, status, created_at DESC)`);

    // Create product_images table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_images (
          id BIGSERIAL PRIMARY KEY,
          product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          image_url VARCHAR(1024) NOT NULL,
          storage_key VARCHAR(512) NOT NULL,
          is_primary BOOLEAN NOT NULL DEFAULT FALSE,
          display_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_product_primary_image ON product_images(product_id) WHERE is_primary = TRUE;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_product_image_order ON product_images(product_id, display_order);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_product_image_order;`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_product_primary_image;`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_images;`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_owner_status_created;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_category_status_created;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_created_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_category_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_owner_id;`);
    
    await queryRunner.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_condition;`);
    await queryRunner.query(`ALTER TABLE products DROP COLUMN IF EXISTS deleted_at;`);
    await queryRunner.query(`ALTER TABLE products DROP COLUMN IF EXISTS status;`);
    await queryRunner.query(`ALTER TABLE products DROP COLUMN IF EXISTS slug;`);
  }
}
