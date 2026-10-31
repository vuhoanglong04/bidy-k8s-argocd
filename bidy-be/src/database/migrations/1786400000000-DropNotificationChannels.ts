import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * notifications.channels claimed each notification was delivered in-app, by email
 * and by push. Nothing ever read the column: there is no mail sender and no push
 * transport in this service, so every row carried the same hardcoded literal and
 * the only thing it did was tell the next reader that channels they cannot find
 * exist somewhere.
 *
 * Dropped rather than made truthful. When email or push is actually built, the
 * delivery record it needs will be per-attempt (queued, sent, failed, retried),
 * which is a different shape from this flag set — so keeping it buys nothing.
 *
 * No data is lost that could not be recreated: every row held the same constant.
 */
export class DropNotificationChannels1786400000000 implements MigrationInterface {
  name = 'DropNotificationChannels1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notifications DROP COLUMN IF EXISTS channels`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channels jsonb`);
  }
}
