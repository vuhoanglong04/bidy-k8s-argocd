import { AppError } from '../../middlewares/error.middleware.js';

/**
 * Wallet Ledger Service — Phase 2 of Bidy Wallet Implementation.
 *
 * Implements the core append-only double-entry ledger engine.
 * Governed by the 6 design principles in docs/wallet-plan.md §0:
 * 1. Ledger is the source of truth, wallet balance is a cache.
 * 2. Ledger is strictly append-only.
 * 3. Double-entry: internal transfers sum to 0. Boundary legs excluded.
 * 4. Idempotent by construction: duplicate idempotencyKey returns existing row, moves no money.
 * 5. Platform fee charged at release, withdrawals are 100% payout.
 * 6. BigInt minor units for all money math in JS — no floats, no string concatenation.
 */

export type LedgerType =
  | 'topup_success'
  | 'payment'
  | 'payment_escrow_in'
  | 'payment_release'
  | 'payment_escrow_out'
  | 'platform_fee'
  | 'payment_refund'
  | 'withdraw_hold'
  | 'withdraw_success'
  | 'withdraw_failed'
  | 'withdraw_cancelled'
  | 'adjustment';

export interface EntryInput {
  walletId: string;
  type: LedgerType;
  amount: string; // signed decimal string, e.g. '1000000.00', '-30000.00'
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface LedgerWalletRow {
  id: string;
  balance: string; // decimal(14,2) string
  status: 'active' | 'locked' | string;
}

export interface LedgerRow extends EntryInput {
  id?: number | string;
  balanceAfter: string;
  createdAt?: Date | string;
}

/**
 * Duck-typed manager interface decoupling the engine from TypeORM.
 * Supports test harnesses (FakeManager) and production (TypeORM EntityManager adapter).
 */
export interface LedgerManager {
  lockWallet(walletId: string): Promise<LedgerWalletRow>;
  updateBalance(walletId: string, balance: string): Promise<void>;
  insertLedger(entry: EntryInput, balanceAfter: string): Promise<LedgerRow> | LedgerRow;
  findLedgerByKey(key: string): Promise<LedgerRow | null> | LedgerRow | null;
}

/**
 * Entries whose counterpart is the real bank account, not an internal wallet.
 * Per docs/wallet-plan.md §0.1b & §2, these boundary legs are excluded from
 * the internal zero-sum assertion.
 */
export const BOUNDARY_TYPES: ReadonlySet<LedgerType> = new Set<LedgerType>([
  'topup_success',
  'withdraw_hold',
  'withdraw_success',
  'withdraw_failed',
  'withdraw_cancelled',
  'adjustment',
]);

/**
 * Parse a decimal(14,2) string to BigInt minor units (cents).
 * Accepts optional leading '+' or '-', whole part up to 12 digits, and up to 2 decimal digits.
 * Never uses parseFloat or Number.
 */
export function toMinor(decimal: string): bigint {
  if (typeof decimal !== 'string') {
    throw new AppError(`Expected decimal string, got ${typeof decimal}`, 400);
  }
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(decimal.trim());
  if (!match) {
    throw new AppError(`Invalid decimal(14,2) value: ${JSON.stringify(decimal)}`, 400);
  }
  const [, signMatch, whole, frac = ''] = match;
  if (whole.length > 12) {
    throw new AppError(`Value exceeds decimal(14,2) precision (max 12 integer digits): ${decimal}`, 400);
  }
  const sign = signMatch === '-' ? '-' : '';
  return BigInt(`${sign}${whole}${frac.padEnd(2, '0')}`);
}

/**
 * Convert BigInt minor units (cents) to a canonical decimal(14,2) string.
 */
export function toDecimal(minor: bigint): string {
  const negative = minor < 0n;
  const absMinor = negative ? -minor : minor;
  const digits = absMinor.toString().padStart(3, '0');
  const body = `${digits.slice(0, -2)}.${digits.slice(-2)}`;
  return negative ? `-${body}` : body;
}

/**
 * Compare two wallet IDs for lock ordering (ascending) to avoid deadlocks (LED-16 / CON-03).
 * Guarantees strict transitivity: numeric IDs sort numerically first, followed by non-numeric strings.
 */
export function compareWalletIds(a: string, b: string): number {
  const aNum = /^-?\d+$/.test(a);
  const bNum = /^-?\d+$/.test(b);
  if (aNum && bNum) {
    const diff = BigInt(a) - BigInt(b);
    return diff < 0n ? -1 : diff > 0n ? 1 : 0;
  }
  if (aNum !== bNum) {
    return aNum ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Validates the expected sign per LedgerType (docs/wallet-plan.md §1.2).
 */
export function validateLedgerAmount(type: LedgerType, amountMinor: bigint): void {
  switch (type) {
    case 'topup_success':
    case 'payment_escrow_in':
    case 'payment_release':
    case 'payment_refund':
    case 'withdraw_failed':
    case 'withdraw_cancelled':
      if (amountMinor <= 0n) {
        throw new AppError(`INVALID_AMOUNT_SIGN: ${type} must be strictly positive`, 400);
      }
      break;
    case 'payment':
    case 'payment_escrow_out':
    case 'withdraw_hold':
      if (amountMinor >= 0n) {
        throw new AppError(`INVALID_AMOUNT_SIGN: ${type} must be strictly negative`, 400);
      }
      break;
    case 'platform_fee':
      if (amountMinor < 0n) {
        throw new AppError(`INVALID_AMOUNT_SIGN: platform_fee cannot be negative`, 400);
      }
      break;
    case 'withdraw_success':
      if (amountMinor !== 0n) {
        throw new AppError(`INVALID_AMOUNT_SIGN: withdraw_success must have amount 0.00`, 400);
      }
      break;
    case 'adjustment':
      if (amountMinor === 0n) {
        throw new AppError(`INVALID_AMOUNT_SIGN: adjustment cannot be 0.00`, 400);
      }
      break;
  }
}

export function isLedgerManager(obj: any): obj is LedgerManager {
  return (
    obj != null &&
    typeof obj.lockWallet === 'function' &&
    typeof obj.updateBalance === 'function' &&
    typeof obj.insertLedger === 'function' &&
    typeof obj.findLedgerByKey === 'function'
  );
}

/**
 * Thin adapter creating a LedgerManager from a TypeORM EntityManager.
 * Uses ON CONFLICT DO NOTHING to prevent PostgreSQL 25P02 transaction aborts on duplicate keys.
 */
export function createTypeOrmLedgerManager(em: any): LedgerManager {
  if (isLedgerManager(em)) {
    return em;
  }
  if (!em || typeof em.query !== 'function') {
    throw new AppError('Expected LedgerManager or TypeORM EntityManager with query method', 500);
  }
  return {
    async lockWallet(walletId: string): Promise<LedgerWalletRow> {
      const rows = await em.query(
        `SELECT id::text, balance::text, status FROM wallets WHERE id = $1 FOR UPDATE`,
        [walletId]
      );
      if (!rows || rows.length === 0) {
        throw new AppError(`WALLET_NOT_FOUND: ${walletId}`, 404);
      }
      return {
        id: String(rows[0].id),
        balance: String(rows[0].balance),
        status: rows[0].status,
      };
    },

    async updateBalance(walletId: string, balance: string): Promise<void> {
      await em.query(
        `UPDATE wallets SET balance = $1::numeric(14,2), updated_at = NOW() WHERE id = $2`,
        [balance, walletId]
      );
    },

    async insertLedger(entry: EntryInput, balanceAfter: string): Promise<LedgerRow> {
      const rows = await em.query(
        `INSERT INTO wallet_ledger (
           wallet_id, type, amount, balance_after, reference_type, reference_id, idempotency_key, metadata, created_at
         )
         VALUES ($1, $2, $3::numeric(14,2), $4::numeric(14,2), $5, $6, $7, $8::jsonb, NOW())
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id, wallet_id AS "walletId", type, amount::text, balance_after::text AS "balanceAfter",
                   reference_type AS "referenceType", reference_id AS "referenceId", idempotency_key AS "idempotencyKey", metadata`,
        [
          entry.walletId,
          entry.type,
          entry.amount,
          balanceAfter,
          entry.referenceType ?? null,
          entry.referenceId ?? null,
          entry.idempotencyKey,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
        ]
      );

      if (!rows || rows.length === 0) {
        const existing = await this.findLedgerByKey(entry.idempotencyKey);
        if (!existing) {
          throw new AppError('IDEMPOTENCY_FETCH_FAILED', 500);
        }
        return existing;
      }

      const row = rows[0];
      return {
        id: row.id,
        walletId: String(row.walletId),
        type: row.type,
        amount: String(row.amount),
        balanceAfter: String(row.balanceAfter),
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        idempotencyKey: row.idempotencyKey,
        metadata: row.metadata,
      };
    },

    async findLedgerByKey(key: string): Promise<LedgerRow | null> {
      const rows = await em.query(
        `SELECT id, wallet_id AS "walletId", type, amount::text, balance_after::text AS "balanceAfter",
                reference_type AS "referenceType", reference_id AS "referenceId", idempotency_key AS "idempotencyKey", metadata
         FROM wallet_ledger
         WHERE idempotency_key = $1`,
        [key]
      );
      if (!rows || rows.length === 0) {
        return null;
      }
      const row = rows[0];
      return {
        id: row.id,
        walletId: String(row.walletId),
        type: row.type,
        amount: String(row.amount),
        balanceAfter: String(row.balanceAfter),
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        idempotencyKey: row.idempotencyKey,
        metadata: row.metadata,
      };
    },
  };
}

function resolveManager(manager: unknown): LedgerManager {
  if (isLedgerManager(manager)) {
    return manager;
  }
  return createTypeOrmLedgerManager(manager);
}

export class WalletLedgerService {
  constructor() {
    this.postEntry = this.postEntry.bind(this);
    this.postTransfer = this.postTransfer.bind(this);
  }

  /**
   * Posts a single ledger entry.
   * Acquires row lock on the wallet, validates status and balance,
   * performs BigInt money arithmetic, inserts ledger row, updates cached balance.
   * On duplicate idempotency key (23505 or pre-check), returns existing row without moving money.
   */
  async postEntry(manager: unknown, entry: EntryInput): Promise<LedgerRow> {
    const m = resolveManager(manager);

    // Fast-path idempotency check: if key already exists, return existing row immediately
    // without moving money or checking wallet status/balance (prevents false INSUFFICIENT_BALANCE on retried debits)
    const existing = await m.findLedgerByKey(entry.idempotencyKey);
    if (existing) {
      return existing;
    }

    const wallet = await m.lockWallet(entry.walletId);
    if (!wallet) {
      throw new AppError(`WALLET_NOT_FOUND: ${entry.walletId}`, 404);
    }

    if (wallet.status !== 'active') {
      throw new AppError(`WALLET_LOCKED: ${entry.walletId}`, 403);
    }

    const amountMinor = toMinor(entry.amount);
    validateLedgerAmount(entry.type, amountMinor);

    const currentMinor = toMinor(wallet.balance);
    // The plan (§2 Phase 2 step 4) specifies computing balance_after = balance + amount in SQL.
    // This uses BigInt minor units in JS instead. This is safe because SELECT ... FOR UPDATE
    // holds the row lock across the read-modify-write so no concurrent writer can interleave,
    // and BigInt arithmetic is exact so principle 6 (no float precision loss) is satisfied.
    const balanceAfterMinor = currentMinor + amountMinor;

    if (balanceAfterMinor < 0n) {
      throw new AppError('INSUFFICIENT_BALANCE', 400);
    }

    const balanceAfter = toDecimal(balanceAfterMinor);

    try {
      const row = await m.insertLedger(entry, balanceAfter);
      await m.updateBalance(entry.walletId, balanceAfter);
      return row;
    } catch (error: any) {
      const isUniqueViolation =
        error?.code === '23505' ||
        String(error?.code) === '23505' ||
        error?.driverError?.code === '23505' ||
        String(error?.driverError?.code) === '23505';

      if (isUniqueViolation) {
        const existingRow = await m.findLedgerByKey(entry.idempotencyKey);
        if (existingRow) return existingRow;
      }
      throw error;
    }
  }

  /**
   * Posts multiple ledger entries within a single transaction.
   * Validates that all internal (non-boundary) legs sum to exactly 0.
   * Locks wallets in ascending order by walletId to prevent deadlocks (LED-16 / CON-03).
   * Enforces transfer-level idempotency atomicity to prevent partial replay exploits.
   */
  async postTransfer(manager: unknown, entries: EntryInput[]): Promise<LedgerRow[]> {
    const m = resolveManager(manager);

    if (entries.length === 0) {
      return [];
    }

    // Atomic idempotency check across the entire transfer:
    // Either all legs have already been executed, or none have.
    const existingChecks = await Promise.all(
      entries.map((e) => m.findLedgerByKey(e.idempotencyKey))
    );
    const existingCount = existingChecks.filter(Boolean).length;
    if (existingCount === entries.length) {
      return existingChecks as LedgerRow[];
    }
    if (existingCount > 0 && existingCount < entries.length) {
      throw new AppError('Inconsistent transfer idempotency: some legs already exist', 409);
    }

    // Balance assertion on internal legs (docs/wallet-plan.md §0.1b & §2)
    const internalTotal = entries
      .filter((e) => !BOUNDARY_TYPES.has(e.type))
      .reduce((sum, e) => sum + toMinor(e.amount), 0n);

    if (internalTotal !== 0n) {
      throw new AppError(
        `postTransfer internal legs are not balanced: ${toDecimal(internalTotal)}`,
        422
      );
    }

    // Deadlock avoidance (LED-16 / CON-03): lock wallets in ascending ID order
    const ordered = [...entries].sort((a, b) => compareWalletIds(a.walletId, b.walletId));
    const rows: LedgerRow[] = [];
    for (const entry of ordered) {
      rows.push(await this.postEntry(m, entry));
    }
    return rows;
  }
}

export default WalletLedgerService;
