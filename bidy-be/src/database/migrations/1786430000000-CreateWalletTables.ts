import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 1 — Create 4 new wallet tables per docs/wallet-plan.md §1.1:
 * - wallets: cache balance + active/locked status
 * - wallet_ledger: append-only double-entry financial truth
 * - wallet_withdrawal_requests: manual withdrawal operational workflow
 * - wallet_daily_summary: nightly balance/reconciliation cache
 */
export class CreateWalletTables1786430000000 implements MigrationInterface {
  name = 'CreateWalletTables1786430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Table: wallets
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" BIGSERIAL NOT NULL,
        "user_id" bigint NOT NULL,
        "balance" numeric(14,2) NOT NULL DEFAULT '0.00',
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallets_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wallets_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_wallets_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "chk_wallets_status" CHECK ("status" IN ('active', 'locked'))
      )
    `);

    // 2. Table: wallet_ledger
    await queryRunner.query(`
      CREATE TABLE "wallet_ledger" (
        "id" BIGSERIAL NOT NULL,
        "wallet_id" bigint NOT NULL,
        "type" character varying(30) NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "balance_after" numeric(14,2) NOT NULL,
        "reference_type" character varying(30),
        "reference_id" bigint,
        "idempotency_key" character varying(255) NOT NULL,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallet_ledger_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wallet_ledger_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "FK_wallet_ledger_wallet_id" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "chk_wallet_ledger_type" CHECK ("type" IN (
          'topup_success',
          'payment',
          'payment_escrow_in',
          'payment_release',
          'payment_escrow_out',
          'platform_fee',
          'payment_refund',
          'withdraw_hold',
          'withdraw_success',
          'withdraw_failed',
          'withdraw_cancelled',
          'adjustment'
        ))
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_wallet_ledger_wallet_id" ON "wallet_ledger" ("wallet_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_wallet_ledger_reference" ON "wallet_ledger" ("reference_type", "reference_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_wallet_ledger_wallet_id_created_at" ON "wallet_ledger" ("wallet_id", "created_at")`);

    // 3. Table: wallet_withdrawal_requests
    await queryRunner.query(`
      CREATE TABLE "wallet_withdrawal_requests" (
        "id" BIGSERIAL NOT NULL,
        "wallet_id" bigint NOT NULL,
        "user_id" bigint NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "bank_account_no" character varying(50) NOT NULL,
        "bank_account_name" character varying(255) NOT NULL,
        "bank_code" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "cancelled_by" character varying(20),
        "deadline_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "admin_id" bigint,
        "proof_url" character varying(1024),
        "reject_reason" text,
        "processed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallet_withdrawal_requests_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wallet_withdrawal_requests_wallet_id" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_wallet_withdrawal_requests_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_wallet_withdrawal_requests_admin_id" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "chk_wallet_withdrawal_requests_status" CHECK ("status" IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
        CONSTRAINT "chk_wallet_withdrawal_requests_cancelled_by" CHECK ("cancelled_by" IS NULL OR "cancelled_by" IN ('user', 'admin'))
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_wallet_withdrawal_requests_wallet_id" ON "wallet_withdrawal_requests" ("wallet_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_wallet_withdrawal_requests_user_id" ON "wallet_withdrawal_requests" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_wallet_withdrawal_requests_status" ON "wallet_withdrawal_requests" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_wallet_withdrawal_requests_deadline_at" ON "wallet_withdrawal_requests" ("deadline_at")`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_wallet_withdrawal_requests_user_open"
      ON "wallet_withdrawal_requests" ("user_id")
      WHERE status IN ('pending', 'processing')
    `);

    // 4. Table: wallet_daily_summary
    await queryRunner.query(`
      CREATE TABLE "wallet_daily_summary" (
        "id" BIGSERIAL NOT NULL,
        "summary_date" date NOT NULL,
        "total_topup" numeric(14,2) NOT NULL DEFAULT '0.00',
        "total_payment" numeric(14,2) NOT NULL DEFAULT '0.00',
        "total_withdraw" numeric(14,2) NOT NULL DEFAULT '0.00',
        "total_platform_fee" numeric(14,2) NOT NULL DEFAULT '0.00',
        "active_wallets" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallet_daily_summary_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wallet_daily_summary_summary_date" UNIQUE ("summary_date")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_daily_summary"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_withdrawal_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_ledger"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets"`);
  }
}
