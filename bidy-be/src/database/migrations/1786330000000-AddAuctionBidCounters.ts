import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The landing page needs to rank live auctions by how contested they are, and to
 * list the newest ones. Neither was possible: auctions carried no bid counters, so
 * "most active" meant COUNT(DISTINCT user_id) over bid_history per auction — one
 * query per row — and ordering by created_at had no index to walk.
 *
 * bid_history stays the source of truth; these columns are a denormalized cache
 * recomputed inside the bidding transaction, under the same pessimistic row lock
 * that already guards current_price.
 */
export class AddAuctionBidCounters1786330000000 implements MigrationInterface {
  name = 'AddAuctionBidCounters1786330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bidder_count integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE auctions ADD COLUMN IF NOT EXISTS total_bids integer NOT NULL DEFAULT 0`);

    // Backfill from the source of truth so existing auctions rank correctly.
    await queryRunner.query(`
      UPDATE auctions a
      SET bidder_count = c.bidder_count,
          total_bids = c.total_bids
      FROM (
        SELECT auction_id,
               COUNT(DISTINCT user_id)::int AS bidder_count,
               COUNT(*)::int AS total_bids
        FROM bid_history
        GROUP BY auction_id
      ) c
      WHERE a.id = c.auction_id
    `);

    // "Most contested live auctions" and "newest listings" both read status first.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_auctions_status_bidder_count ON auctions (status, bidder_count DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_auctions_status_created_at ON auctions (status, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_auctions_status_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_auctions_status_bidder_count`);
    await queryRunner.query(`ALTER TABLE auctions DROP COLUMN IF EXISTS total_bids`);
    await queryRunner.query(`ALTER TABLE auctions DROP COLUMN IF EXISTS bidder_count`);
  }
}
