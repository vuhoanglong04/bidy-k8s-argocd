import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `auction_requests` — the queue a seller's listing goes through before it
 * becomes an auction.
 *
 * It is a separate table rather than an extra status on `auctions` because auction
 * statuses are driven by the lifecycle cron: a `pending_approval` auction sitting in
 * that table would be flipped to `happening` by the job the moment its start date
 * passed, and every public query would have to remember to filter it out. A request
 * that is never an auction until approved cannot leak that way.
 */
export class CreateAuctionRequests1786480000000 implements MigrationInterface {
  name = 'CreateAuctionRequests1786480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auction_requests" (
        "id" bigserial PRIMARY KEY,
        "product_id" bigint NOT NULL,
        "seller_id" bigint NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "quantity" integer NOT NULL DEFAULT 1,
        "starting_price" numeric(12,2) NOT NULL,
        "buy_now_price" numeric(12,2) NULL,
        "reserve_price" numeric(12,2) NULL,
        "bid_increment" numeric(12,2) NOT NULL DEFAULT 1.00,
        "start_date" timestamptz NOT NULL,
        "end_date" timestamptz NOT NULL,
        "reject_reason" character varying(500) NULL,
        "reviewed_by" bigint NULL,
        "reviewed_at" timestamptz NULL,
        "auction_id" bigint NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_auction_requests_product_id"
          FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_auction_requests_seller_id"
          FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_auction_requests_reviewed_by"
          FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_auction_requests_auction_id"
          FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE SET NULL,
        CONSTRAINT "chk_auction_requests_status"
          CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled')),
        CONSTRAINT "chk_auction_requests_dates" CHECK ("end_date" > "start_date"),
        CONSTRAINT "chk_auction_requests_quantity" CHECK ("quantity" >= 1)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_auction_requests_seller_id" ON "auction_requests" ("seller_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_auction_requests_status" ON "auction_requests" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_auction_requests_product_id" ON "auction_requests" ("product_id")`);

    // One open request per product. Without this a seller could queue the same
    // product twice and an admin could approve both, producing two live auctions for
    // one item — which is the thing assertAuctionable exists to prevent.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_auction_requests_one_pending_per_product"
      ON "auction_requests" ("product_id") WHERE "status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "auction_requests"`);
  }
}
