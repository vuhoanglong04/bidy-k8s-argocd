import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How many units of the product this auction sells.
 *
 * The auction is single-winner: `quantity` is the size of the lot going to that
 * one winner ("5 chiếc bán theo lô"), not a count of units each bidder can buy
 * separately. Nothing in the bidding or order path splits a lot between buyers,
 * so reading it as multi-winner inventory would be wrong.
 *
 * Backfilled to 1 rather than left nullable: every existing auction sold exactly
 * one item, and a nullable column would push "null means one" into every caller.
 * The CHECK is what keeps a zero- or negative-sized lot out of the table — a lot
 * of nothing is not a sale.
 */
export class AddAuctionQuantity1786370000000 implements MigrationInterface {
  name = 'AddAuctionQuantity1786370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE auctions ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE auctions ADD CONSTRAINT chk_auctions_quantity_positive CHECK (quantity >= 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE auctions DROP CONSTRAINT IF EXISTS chk_auctions_quantity_positive`,
    );
    await queryRunner.query(`ALTER TABLE auctions DROP COLUMN IF EXISTS quantity`);
  }
}
