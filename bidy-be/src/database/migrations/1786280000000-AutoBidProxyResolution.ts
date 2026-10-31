import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Makes the existing `auto_bid_configs` table usable as a real proxy-bidding engine.
 *
 * 1. Drops `increment_amount`. It competed with `auctions.bid_increment` as the step
 *    size, so two configs on the same auction with equal `limit_bid` but different
 *    increments resolved differently depending on processing order. `auctions.bid_increment`
 *    is now the single source of truth. Safe to drop: no code ever read this column
 *    (auto-bid resolution was never implemented — `processAutoBidForAuction` was a stub).
 * 2. Adds the partial index used to resolve "highest active competitor" on every bid.
 */
export class AutoBidProxyResolution1786280000000 implements MigrationInterface {
    name = 'AutoBidProxyResolution1786280000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auto_bid_configs" DROP COLUMN "increment_amount"`);
        await queryRunner.query(`CREATE INDEX "idx_auto_bid_configs_resolution" ON "auto_bid_configs" ("auction_id", "limit_bid", "created_at") WHERE "is_active" = true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_auto_bid_configs_resolution"`);
        await queryRunner.query(`ALTER TABLE "auto_bid_configs" ADD "increment_amount" numeric(12,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "auto_bid_configs" ALTER COLUMN "increment_amount" DROP DEFAULT`);
    }

}
