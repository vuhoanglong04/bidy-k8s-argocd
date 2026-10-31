import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * users.avatar_url stored an absolute bucket URL with no record of the object key,
 * so a replaced avatar left its predecessor orphaned in the bucket forever and the
 * R2 migration had no key to re-point rows at. Mirrors product_images.storage_key.
 *
 * Nullable, unlike the product_images column: users predating this change have no
 * recoverable key, and most users have no avatar at all.
 */
export class AddUserAvatarStorageKey1786320000000 implements MigrationInterface {
  name = 'AddUserAvatarStorageKey1786320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_storage_key VARCHAR(512)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS avatar_storage_key`);
  }
}
