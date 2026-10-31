import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The lifecycle cron runs every 10 seconds, so an "ending soon" sweep with no
 * memory would re-notify every participant on every tick — roughly 90 times over a
 * 15-minute window. This flag is what makes the sweep fire once per auction.
 *
 * A column rather than an in-memory set: the sweep must stay correct across a
 * restart, and a restart mid-window is exactly when a duplicate storm would land.
 */
export class AddAuctionEndingSoonNotified1786390000000 implements MigrationInterface {
  name = 'AddAuctionEndingSoonNotified1786390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE auctions ADD COLUMN IF NOT EXISTS ending_soon_notified BOOLEAN NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE auctions DROP COLUMN IF EXISTS ending_soon_notified`);
  }
}
