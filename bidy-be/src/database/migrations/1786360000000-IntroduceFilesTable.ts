import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consolidates every stored image behind one `files` table keyed by its R2 object key.
 *
 * Four tables each carried their own flavour of "where is the picture": product_images
 * had both image_url and storage_key (two sources of truth that had already drifted —
 * the auction listing path wrote the key into image_url), users mirrored that pair,
 * and categories/review_media held bare external URLs with no object behind them at
 * all. A URL is also the wrong thing to persist now that the bucket is private:
 * presigned URLs expire, so the only durable value is the key.
 *
 * product_images rows are deleted rather than backfilled: every existing row is seed
 * data pointing at picsum.photos with a `seed/*.jpg` key that was never uploaded, so
 * a backfill would only preserve broken links. The remaining three columns are empty
 * in every environment (0 avatars, 0 category images, 0 review media).
 */
export class IntroduceFilesTable1786360000000 implements MigrationInterface {
  name = 'IntroduceFilesTable1786360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS files (
        id BIGSERIAL PRIMARY KEY,
        s3_key VARCHAR(512) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(127) NOT NULL,
        size_bytes INTEGER NOT NULL,
        uploaded_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    // The bucket key is the identity of the row; registering one object twice would
    // let two owners believe they each control its lifetime and delete it out from
    // under the other.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_files_s3_key ON files (s3_key)`,
    );

    // --- product_images -------------------------------------------------------
    // Seed-only rows whose objects do not exist in R2; see the class comment.
    await queryRunner.query(`DELETE FROM product_images`);
    await queryRunner.query(
      `ALTER TABLE product_images ADD COLUMN IF NOT EXISTS file_id BIGINT NOT NULL
         REFERENCES files(id) ON DELETE RESTRICT`,
    );
    await queryRunner.query(`ALTER TABLE product_images DROP COLUMN IF EXISTS image_url`);
    await queryRunner.query(`ALTER TABLE product_images DROP COLUMN IF EXISTS storage_key`);
    // One product image per file: reusing a file across rows would make deleting
    // either row delete an object the other still needs.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_file ON product_images (file_id)`,
    );

    // --- users ---------------------------------------------------------------
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_file_id BIGINT NULL
         REFERENCES files(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS avatar_url`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS avatar_storage_key`);

    // --- categories ----------------------------------------------------------
    await queryRunner.query(
      `ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_file_id BIGINT NULL
         REFERENCES files(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(`ALTER TABLE categories DROP COLUMN IF EXISTS image_url`);

    // --- review_media --------------------------------------------------------
    await queryRunner.query(`DELETE FROM review_media`);
    await queryRunner.query(
      `ALTER TABLE review_media ADD COLUMN IF NOT EXISTS file_id BIGINT NOT NULL
         REFERENCES files(id) ON DELETE RESTRICT`,
    );
    await queryRunner.query(`ALTER TABLE review_media DROP COLUMN IF EXISTS media_url`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The URLs these columns held cannot be reconstructed — the bucket is private and
    // the external links were never stored anywhere else. Reverting restores the shape,
    // not the data.
    await queryRunner.query(`ALTER TABLE review_media DROP COLUMN IF EXISTS file_id`);
    await queryRunner.query(
      `ALTER TABLE review_media ADD COLUMN IF NOT EXISTS media_url VARCHAR(1024) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(`ALTER TABLE review_media ALTER COLUMN media_url DROP DEFAULT`);

    await queryRunner.query(`ALTER TABLE categories DROP COLUMN IF EXISTS image_file_id`);
    await queryRunner.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url VARCHAR(1024)`);

    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS avatar_file_id`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1024)`);
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_storage_key VARCHAR(512)`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS uq_product_images_file`);
    await queryRunner.query(`ALTER TABLE product_images DROP COLUMN IF EXISTS file_id`);
    await queryRunner.query(
      `ALTER TABLE product_images ADD COLUMN IF NOT EXISTS image_url VARCHAR(1024) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(`ALTER TABLE product_images ALTER COLUMN image_url DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE product_images ADD COLUMN IF NOT EXISTS storage_key VARCHAR(512) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(`ALTER TABLE product_images ALTER COLUMN storage_key DROP DEFAULT`);

    await queryRunner.query(`DROP INDEX IF EXISTS uq_files_s3_key`);
    await queryRunner.query(`DROP TABLE IF EXISTS files`);
  }
}
