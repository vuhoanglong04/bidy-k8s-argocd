/**
 * The ledger engine's SQL, executed against a real PostgreSQL.
 *
 *   npx tsx src/tests/wallet-ledger-pg.check.ts
 *
 * wallet-e2e.check.ts proves the engine's *arithmetic* against an in-memory fake. It
 * never runs a line of SQL, so everything inside createTypeOrmLedgerManager — the
 * FOR UPDATE, the ON CONFLICT DO NOTHING that stands in for catching 23505, the
 * ::numeric(14,2) and ::jsonb casts, and the assumption that DECIMAL comes back as a
 * string — is invisible to it. Those are exactly the parts that can only be wrong
 * against a real database. This file covers that half.
 *
 * Unlike the other checks in this directory it needs Postgres. When none is reachable
 * it prints SKIP and exits 0, so `npm test` still passes on a machine without one.
 * Everything it writes happens inside a transaction that is always rolled back, so it
 * leaves no rows behind and can be run repeatedly.
 */
import assert from 'node:assert/strict';
import { AppDataSource } from '../database/data-source.js';
import {
  WalletLedgerService,
  createTypeOrmLedgerManager,
} from '../modules/wallet/wallet-ledger.service.js';

/** Thrown at the end of the work transaction so Postgres rolls everything back. */
class Rollback extends Error {}

const service = new WalletLedgerService();

async function seedWallet(em: any, suffix: string, balance: string, status = 'active'): Promise<string> {
  const [user] = await em.query(
    `INSERT INTO users (username, fullname, phone_number, email, password_hash, role, status)
     VALUES ($1, 'Ledger PG Check', '0900000000', $2, 'x', 'user', 'active')
     RETURNING id`,
    [`pgcheck_${suffix}`, `pgcheck_${suffix}@internal.invalid`],
  );
  const [wallet] = await em.query(
    `INSERT INTO wallets (user_id, balance, status) VALUES ($1, $2::numeric(14,2), $3) RETURNING id`,
    [user.id, balance, status],
  );
  return String(wallet.id);
}

const countRows = async (em: any, key: string): Promise<number> => {
  const [row] = await em.query(`SELECT count(*)::int AS n FROM wallet_ledger WHERE idempotency_key = $1`, [key]);
  return row.n;
};

const balanceOf = async (em: any, walletId: string): Promise<string> => {
  const [row] = await em.query(`SELECT balance::text AS balance FROM wallets WHERE id = $1`, [walletId]);
  return row.balance;
};

async function run(em: any) {
  const m = createTypeOrmLedgerManager(em);
  const buyer = await seedWallet(em, `buyer_${Date.now()}`, '0.00');
  const platform = await seedWallet(em, `platform_${Date.now()}`, '0.00');
  const frozen = await seedWallet(em, `frozen_${Date.now()}`, '500.00', 'locked');

  // --- a credit lands, and DECIMAL comes back as a string ---------------------
  {
    const row = await service.postEntry(m, {
      walletId: buyer,
      type: 'topup_success',
      amount: '1030000.00',
      referenceType: 'sepay_webhook',
      idempotencyKey: 'pgcheck:sepay:tx-1',
      metadata: { bank_reference: 'FT24001', admin_id: '77' },
    });

    assert.equal(typeof row.amount, 'string', 'DECIMAL must arrive as a string, not a number — NUM-01');
    assert.equal(row.amount, '1030000.00');
    assert.equal(row.balanceAfter, '1030000.00', 'balance_after must be the post-entry balance');
    assert.equal(await balanceOf(em, buyer), '1030000.00', 'the cached balance must follow the ledger');
    assert.deepEqual(row.metadata, { bank_reference: 'FT24001', admin_id: '77' }, 'jsonb metadata must round-trip');
  }

  // --- the replay path: ON CONFLICT DO NOTHING, not a second row --------------
  {
    const again = await service.postEntry(m, {
      walletId: buyer,
      type: 'topup_success',
      amount: '1030000.00',
      referenceType: 'sepay_webhook',
      idempotencyKey: 'pgcheck:sepay:tx-1',
    });

    assert.equal(await countRows(em, 'pgcheck:sepay:tx-1'), 1, 'the unique index must admit exactly one row');
    assert.equal(again.balanceAfter, '1030000.00', 'a replay returns the original row');
    assert.equal(await balanceOf(em, buyer), '1030000.00', 'a replay must not move money a second time');
  }

  // --- a debit larger than the balance is refused, and writes nothing ---------
  {
    await assert.rejects(
      () =>
        service.postEntry(m, {
          walletId: buyer,
          type: 'withdraw_hold',
          amount: '-2000000.00',
          referenceType: 'withdrawal_request',
          idempotencyKey: 'pgcheck:withdraw_hold:over',
        }),
      /INSUFFICIENT_BALANCE/,
    );
    assert.equal(await countRows(em, 'pgcheck:withdraw_hold:over'), 0, 'a refused entry must leave no row');
    assert.equal(await balanceOf(em, buyer), '1030000.00');
  }

  // --- a locked wallet moves in neither direction ------------------------------
  {
    await assert.rejects(
      () =>
        service.postEntry(m, {
          walletId: frozen,
          type: 'topup_success',
          amount: '1.00',
          idempotencyKey: 'pgcheck:sepay:tx-frozen',
        }),
      /WALLET_LOCKED/,
    );
    assert.equal(await balanceOf(em, frozen), '500.00');
  }

  // --- a two-legged transfer: both legs land, the internal legs cancel ---------
  {
    const rows = await service.postTransfer(m, [
      {
        walletId: buyer,
        type: 'payment',
        amount: '-1030000.00',
        referenceType: 'order',
        referenceId: '1',
        idempotencyKey: 'pgcheck:order_payment:1',
      },
      {
        walletId: platform,
        type: 'payment_escrow_in',
        amount: '1030000.00',
        referenceType: 'order',
        referenceId: '1',
        idempotencyKey: 'pgcheck:order_escrow_in:1',
      },
    ]);

    assert.equal(rows.length, 2);
    assert.equal(await balanceOf(em, buyer), '0.00', 'the buyer is debited in full');
    assert.equal(await balanceOf(em, platform), '1030000.00', 'escrow holds the whole order');

    const [sum] = await em.query(
      `SELECT COALESCE(SUM(amount), 0)::text AS total FROM wallet_ledger
       WHERE type IN ('payment', 'payment_escrow_in', 'payment_escrow_out',
                      'payment_release', 'platform_fee', 'payment_refund')
         AND idempotency_key LIKE 'pgcheck:%'`,
    );
    assert.equal(sum.total, '0.00', 'Invariant 1b — internal legs must net to zero in the database too');
  }

  // --- Invariant 2, read straight out of Postgres ------------------------------
  for (const walletId of [buyer, platform, frozen]) {
    const [row] = await em.query(
      `SELECT w.balance::text AS balance,
              COALESCE((SELECT SUM(l.amount) FROM wallet_ledger l WHERE l.wallet_id = w.id), 0)::text AS ledger
       FROM wallets w WHERE w.id = $1`,
      [walletId],
    );
    if (walletId === frozen) continue; // seeded with an opening balance, no ledger behind it
    assert.equal(row.balance, row.ledger, `Invariant 2 — wallet ${walletId} balance drifted from its ledger`);
  }

  // --- an unbalanced transfer is refused before anything is written ------------
  {
    await assert.rejects(
      () =>
        service.postTransfer(m, [
          { walletId: platform, type: 'payment_escrow_out', amount: '-1030000.00', idempotencyKey: 'pgcheck:bad:1' },
          { walletId: buyer, type: 'payment_refund', amount: '900000.00', idempotencyKey: 'pgcheck:bad:2' },
        ]),
      /not balanced/,
      'a transfer whose internal legs do not cancel must be rejected outright',
    );
    assert.equal(await countRows(em, 'pgcheck:bad:1'), 0, 'a rejected transfer must write no leg at all');
  }
}

async function main() {
  try {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
  } catch (error: any) {
    // Only an unreachable server is a skip. Anything else — bad credentials, missing
    // migrations, broken entity metadata — is a real failure and must not hide here.
    const unreachable = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH'];
    if (unreachable.includes(error?.code) || unreachable.some((c) => error?.message?.includes(c))) {
      console.log('  SKIP  wallet-ledger-pg.check: no PostgreSQL reachable');
      process.exit(0);
    }
    throw error;
  }

  let failure: unknown = null;
  try {
    await AppDataSource.transaction(async (em) => {
      try {
        await run(em);
      } catch (error) {
        failure = error;
      }
      // Always roll back: this check writes real rows and must leave none behind.
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  } finally {
    await AppDataSource.destroy();
  }

  if (failure) {
    console.error(`  FAIL  wallet-ledger-pg.check\n        ${(failure as Error).message}`);
    process.exit(1);
  }
  console.log('wallet-ledger-pg.check: OK (ledger SQL verified against PostgreSQL, all rows rolled back)');
}

main();
