import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 1 — Alter existing tables per docs/wallet-plan.md §1.4 and §1.5:
 * - orders: escrow columns (fund_status, platform_fee, seller_payout, fee_rate, payment_channel,
 *   delivered_at, released_at, released_by)
 * - transactions: nullable order_id, wallet_id foreign key, unique provider_transaction_id
 * - harmonize precision: decimal(14,2) across all money columns in orders, transactions,
 *   auctions, auction_deposits, bid_history, archive_bid_history.
 */
export class AlterTablesForWallet1786440000000 implements MigrationInterface {
  name = 'AlterTablesForWallet1786440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Alter orders
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "fund_status" character varying(20) NOT NULL DEFAULT 'none',
        ADD COLUMN "platform_fee" numeric(14,2),
        ADD COLUMN "seller_payout" numeric(14,2),
        ADD COLUMN "fee_rate" numeric(5,4),
        ADD COLUMN "payment_channel" character varying(20),
        ADD COLUMN "delivered_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "released_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "released_by" bigint,
        ADD CONSTRAINT "FK_orders_released_by" FOREIGN KEY ("released_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        ADD CONSTRAINT "chk_orders_fund_status" CHECK ("fund_status" IN ('none', 'held', 'released', 'refunded')),
        ADD CONSTRAINT "chk_orders_payment_channel" CHECK ("payment_channel" IS NULL OR "payment_channel" IN ('wallet', 'qr_direct'))
    `);

    // 2. Harmonize precision for orders
    await queryRunner.query(`
      ALTER TABLE "orders"
        ALTER COLUMN "final_price" TYPE numeric(14,2),
        ALTER COLUMN "shipping_fee" TYPE numeric(14,2),
        ALTER COLUMN "total_amount" TYPE numeric(14,2)
    `);

    // 3. Alter transactions
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ALTER COLUMN "order_id" DROP NOT NULL,
        ADD COLUMN "wallet_id" bigint,
        ADD CONSTRAINT "FK_transactions_wallet_id" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        ADD CONSTRAINT "UQ_transactions_provider_transaction_id" UNIQUE ("provider_transaction_id"),
        ALTER COLUMN "amount" TYPE numeric(14,2)
    `);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_wallet_id" ON "transactions" ("wallet_id")`);

    // 4. Harmonize precision for auctions and other money columns
    await queryRunner.query(`
      ALTER TABLE "auctions"
        ALTER COLUMN "starting_price" TYPE numeric(14,2),
        ALTER COLUMN "current_price" TYPE numeric(14,2),
        ALTER COLUMN "buy_now_price" TYPE numeric(14,2),
        ALTER COLUMN "reserve_price" TYPE numeric(14,2),
        ALTER COLUMN "bid_increment" TYPE numeric(14,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "auction_deposits"
        ALTER COLUMN "amount" TYPE numeric(14,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "bid_history"
        ALTER COLUMN "amount" TYPE numeric(14,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "archive_bid_history"
        ALTER COLUMN "amount" TYPE numeric(14,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Revert precision on archive_bid_history, bid_history, auction_deposits, auctions
    await queryRunner.query(`
      ALTER TABLE "archive_bid_history"
        ALTER COLUMN "amount" TYPE numeric(12,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "bid_history"
        ALTER COLUMN "amount" TYPE numeric(12,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "auction_deposits"
        ALTER COLUMN "amount" TYPE numeric(12,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "auctions"
        ALTER COLUMN "starting_price" TYPE numeric(12,2),
        ALTER COLUMN "current_price" TYPE numeric(12,2),
        ALTER COLUMN "buy_now_price" TYPE numeric(12,2),
        ALTER COLUMN "reserve_price" TYPE numeric(12,2),
        ALTER COLUMN "bid_increment" TYPE numeric(12,2)
    `);

    // 2. Revert transactions
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_wallet_id"`);
    await queryRunner.query(`
      ALTER TABLE "transactions"
        DROP CONSTRAINT IF EXISTS "UQ_transactions_provider_transaction_id",
        DROP CONSTRAINT IF EXISTS "FK_transactions_wallet_id",
        DROP COLUMN IF EXISTS "wallet_id",
        ALTER COLUMN "amount" TYPE numeric(12,2),
        ALTER COLUMN "order_id" SET NOT NULL
    `);

    // 3. Revert orders
    await queryRunner.query(`
      ALTER TABLE "orders"
        ALTER COLUMN "final_price" TYPE numeric(12,2),
        ALTER COLUMN "shipping_fee" TYPE numeric(12,2),
        ALTER COLUMN "total_amount" TYPE numeric(12,2),
        DROP CONSTRAINT IF EXISTS "FK_orders_released_by",
        DROP CONSTRAINT IF EXISTS "chk_orders_payment_channel",
        DROP CONSTRAINT IF EXISTS "chk_orders_fund_status",
        DROP COLUMN IF EXISTS "released_by",
        DROP COLUMN IF EXISTS "released_at",
        DROP COLUMN IF EXISTS "delivered_at",
        DROP COLUMN IF EXISTS "payment_channel",
        DROP COLUMN IF EXISTS "fee_rate",
        DROP COLUMN IF EXISTS "seller_payout",
        DROP COLUMN IF EXISTS "platform_fee",
        DROP COLUMN IF EXISTS "fund_status"
    `);
  }
}
