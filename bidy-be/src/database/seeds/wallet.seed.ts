import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * Phase 1 — Seed system platform user and platform wallet per docs/wallet-plan.md §2 Phase 1.
 *
 * Both the user and wallet use ON CONFLICT DO NOTHING to ensure idempotency when re-run.
 * The password hash is explicitly unmatchable ($2b$12$disabled.account...) so the system account
 * can never authenticate interactively.
 */
export async function seedWallet(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    // 1. Insert system_platform user (role: admin, status: active, unmatchable password hash)
    await queryRunner.query(`
      INSERT INTO "users" ("username", "full_name", "email", "password_hash", "role", "status")
      VALUES (
        'system_platform',
        'System Platform',
        'system@internal.bidy',
        '$2b$12$disabled.account.system.platform.cannot.authenticate.never',
        'admin',
        'active'
      )
      ON CONFLICT ("email") DO NOTHING;
    `);

    // 2. Insert platform wallet with balance 0 and status active
    await queryRunner.query(`
      INSERT INTO "wallets" ("user_id", "balance", "status")
      SELECT "id", 0, 'active'
      FROM "users"
      WHERE "email" = 'system@internal.bidy'
      ON CONFLICT ("user_id") DO NOTHING;
    `);

    console.log('✅ System platform user and wallet seeded');
  } finally {
    await queryRunner.release();
  }
}
