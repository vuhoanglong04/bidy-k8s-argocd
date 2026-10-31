import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * support_messages.message_type already allows non-text messages (e.g. 'product_grid'),
 * but there was nowhere to store the payload those messages carry. Product-grid messages
 * need the product snapshots (title/image/price as of send time) plus the grid layout
 * config, so they render identically when the chat is re-opened months later.
 *
 * Follows the bid_history.metadata pattern: one nullable jsonb column keyed by
 * message_type, so a new rich message type never needs another migration.
 */
export class AddSupportMessageMetadata1786300000000 implements MigrationInterface {
  name = 'AddSupportMessageMetadata1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS metadata JSONB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE support_messages DROP COLUMN IF EXISTS metadata`);
  }
}
