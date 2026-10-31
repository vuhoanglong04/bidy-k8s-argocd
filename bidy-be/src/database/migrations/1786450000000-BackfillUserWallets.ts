import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 1 — Backfill wallets for all existing users with balance 0 per docs/wallet-plan.md §2 Phase 1.
 */
export class BackfillUserWallets1786450000000 implements MigrationInterface {
  name = 'BackfillUserWallets1786450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "wallets" ("user_id", "balance", "status")
      SELECT "id", 0, 'active'
      FROM "users"
      ON CONFLICT ("user_id") DO NOTHING
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Documented no-op: Data backfills are irreversible in a running system.
    // Deleting balance = 0 rows would destroy wallets created by post-migration user
    // registrations and the platform wallet when empty. If rolling back the entire
    // feature, 1786430000000-CreateWalletTables drops the "wallets" table completely.
  }
}
