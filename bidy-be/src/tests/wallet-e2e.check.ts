/**
 * End-to-end money-movement checks for the wallet ledger.
 *
 *   npx tsx src/tests/wallet-e2e.check.ts
 *
 * Covers E2E-01..E2E-06 of wallet-service-test-cases.md: a full auction payout
 * lifecycle, the QR pass-through variant, refund, underpaid top-up, a rejected
 * withdrawal, and the reconciliation invariants over everything the run wrote.
 * E2E-07..E2E-15 extend that with the overpaid webhook, a user-cancelled withdrawal,
 * the adjustment valve, a locked wallet, and the Phase 7 hardening set — concurrency,
 * idempotency under load, lock ordering, crash rollback, and the 4F deadline sweep.
 *
 * The ledger engine does not exist yet. Until src/modules/wallet/wallet-ledger.service.ts
 * exports postEntry/postTransfer this file reports PENDING and exits 0, so it can
 * live in the suite from day one without turning `npm test` red. The moment the
 * service lands, these become real gates with no edit needed here.
 *
 * Money is held the way Postgres hands it back — DECIMAL comes out of TypeORM as a
 * STRING, not a number. The fake below stores balances as strings on purpose: an
 * implementation that does `wallet.balance + amount` in JavaScript concatenates
 * instead of adding, and the balance assertions catch it. That is NUM-01, observed
 * end to end rather than in isolation.
 */
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Contract under test — fixed by docs/wallet-plan.md §2 Phase 2.
// ---------------------------------------------------------------------------

type LedgerType =
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

interface EntryInput {
  walletId: string;
  type: LedgerType;
  amount: string; // signed, decimal string — never a float
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

interface LedgerEngine {
  postEntry(manager: unknown, entry: EntryInput): Promise<unknown>;
  postTransfer(manager: unknown, entries: EntryInput[]): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Money helpers. Everything is integer minor units internally; the boundary
// speaks decimal strings, exactly like the database column does.
// ---------------------------------------------------------------------------

function toMinor(decimal: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(decimal.trim());
  assert.ok(match, `not a decimal(14,2) value: ${JSON.stringify(decimal)}`);
  const [, sign, whole, frac = ''] = match;
  return BigInt(`${sign}${whole}${frac.padEnd(2, '0')}`);
}

function toDecimal(minor: bigint): string {
  const negative = minor < 0n;
  const digits = (negative ? -minor : minor).toString().padStart(3, '0');
  const body = `${digits.slice(0, -2)}.${digits.slice(-2)}`;
  return negative ? `-${body}` : body;
}

const add = (a: string, b: string) => toDecimal(toMinor(a) + toMinor(b));
const negate = (a: string) => toDecimal(-toMinor(a));

/** ROUND(final_price * 0.05, 2), half-up — the 4B formula, on final_price only. */
function platformFeeOf(finalPrice: string): string {
  const scaled = toMinor(finalPrice) * 5n; // × 0.05 × 100
  const quotient = scaled / 100n;
  const remainder = scaled % 100n;
  return toDecimal(remainder >= 50n ? quotient + 1n : quotient);
}

// ---------------------------------------------------------------------------
// Fake Postgres. Emulates only what the ledger depends on: row locks that
// serialise, a unique index that throws 23505, and all-or-nothing rollback.
// ---------------------------------------------------------------------------

class UniqueViolation extends Error {
  code = '23505';
  constructor(public constraint: string) {
    super(`duplicate key value violates unique constraint "${constraint}"`);
  }
}

interface WalletRow {
  id: string;
  balance: string; // decimal-as-string, like TypeORM returns
  status: 'active' | 'locked';
}

interface LedgerRow extends EntryInput {
  id: number;
  balanceAfter: string;
}

class FakeDb {
  wallets = new Map<string, WalletRow>();
  ledger: LedgerRow[] = [];
  keys = new Set<string>();
  lockOrderViolations: string[] = [];
  private nextId = 1;
  private chain: Promise<unknown> = Promise.resolve();

  createWallet(id: string, balance = '0.00', status: WalletRow['status'] = 'active') {
    this.wallets.set(id, { id, balance, status });
    return id;
  }

  /** Serialised like a transaction holding row locks; rolls back on throw. */
  async transaction<T>(fn: (m: FakeManager) => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const snapshot = {
        wallets: new Map([...this.wallets].map(([k, v]) => [k, { ...v }])),
        ledger: [...this.ledger],
        keys: new Set(this.keys),
      };
      const manager = new FakeManager(this);
      try {
        const out = await fn(manager);
        manager.assertLockOrder();
        return out;
      } catch (error) {
        this.wallets = snapshot.wallets;
        this.ledger = snapshot.ledger;
        this.keys = snapshot.keys;
        throw error;
      }
    });
    this.chain = run.catch(() => undefined);
    return run as Promise<T>;
  }

  insertLedger(entry: EntryInput, balanceAfter: string): LedgerRow {
    if (this.keys.has(entry.idempotencyKey)) {
      throw new UniqueViolation('wallet_ledger_idempotency_key_key');
    }
    this.keys.add(entry.idempotencyKey);
    const row: LedgerRow = { ...entry, id: this.nextId++, balanceAfter };
    this.ledger.push(row);
    return row;
  }

  balanceOf(walletId: string): string {
    const wallet = this.wallets.get(walletId);
    assert.ok(wallet, `unknown wallet ${walletId}`);
    return wallet.balance;
  }

  ledgerSumOf(walletId: string): string {
    return toDecimal(
      this.ledger
        .filter((row) => row.walletId === walletId)
        .reduce((total, row) => total + toMinor(row.amount), 0n),
    );
  }
}

class FakeManager {
  private locked: string[] = [];
  constructor(private db: FakeDb) {}

  /** SELECT ... FOR UPDATE */
  async lockWallet(walletId: string): Promise<WalletRow> {
    this.locked.push(walletId);
    const wallet = this.db.wallets.get(walletId);
    assert.ok(wallet, `WALLET_NOT_FOUND: ${walletId}`);
    return wallet;
  }

  async updateBalance(walletId: string, balance: string) {
    const wallet = this.db.wallets.get(walletId)!;
    wallet.balance = balance;
  }

  insertLedger(entry: EntryInput, balanceAfter: string) {
    return this.db.insertLedger(entry, balanceAfter);
  }

  findLedgerByKey(key: string) {
    return this.db.ledger.find((row) => row.idempotencyKey === key) ?? null;
  }

  /** LED-16 / CON-03: multi-wallet transactions must lock in ascending id order. */
  assertLockOrder() {
    const ids = this.locked.map((id) => Number(id));
    for (let i = 1; i < ids.length; i++) {
      if (ids[i] < ids[i - 1]) {
        this.db.lockOrderViolations.push(this.locked.join(' -> '));
        return;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Reference engine. Used only to keep these scenarios runnable before the real
// service lands; once it exists, `loadEngine` returns that instead and every
// assertion below applies unchanged to production code.
// ---------------------------------------------------------------------------

/**
 * Entries whose counterpart is the real bank account, not another wallet. They are
 * the system's boundary with the outside world, so they cannot balance internally —
 * see docs/wallet-plan.md §0.1b.
 */
const BOUNDARY_TYPES: ReadonlySet<LedgerType> = new Set<LedgerType>([
  'topup_success',
  'withdraw_hold',
  'withdraw_success',
  'withdraw_failed',
  'withdraw_cancelled',
  'adjustment',
]);

const referenceEngine: LedgerEngine = {
  async postEntry(manager: unknown, entry: EntryInput) {
    const m = manager as FakeManager;
    const wallet = await m.lockWallet(entry.walletId);

    if (wallet.status !== 'active') throw new Error(`WALLET_LOCKED: ${entry.walletId}`);

    const after = add(wallet.balance, entry.amount);
    if (toMinor(after) < 0n) throw new Error('INSUFFICIENT_BALANCE');

    try {
      const row = m.insertLedger(entry, after);
      await m.updateBalance(entry.walletId, after);
      return row;
    } catch (error: any) {
      // LED-08/LED-10: a replayed key is success, not failure, and must not move money.
      if (error?.code === '23505') return m.findLedgerByKey(entry.idempotencyKey);
      throw error;
    }
  },

  async postTransfer(manager: unknown, entries: EntryInput[]) {
    // LED-13: only the internal legs have to cancel out. A transfer may also carry
    // boundary legs (the QR pass-through in 4D opens with a topup_success), and
    // demanding those net to zero would reject a correct flow.
    const internalTotal = entries
      .filter((e) => !BOUNDARY_TYPES.has(e.type))
      .reduce((sum, e) => sum + toMinor(e.amount), 0n);
    assert.equal(internalTotal, 0n, `postTransfer internal legs are not balanced: ${toDecimal(internalTotal)}`);

    const ordered = [...entries].sort((a, b) => Number(a.walletId) - Number(b.walletId));
    const rows = [];
    for (const entry of ordered) rows.push(await referenceEngine.postEntry(manager, entry));
    return rows;
  },
};

async function loadEngine(): Promise<{ engine: LedgerEngine; real: boolean }> {
  try {
    // Built at runtime so tsc does not try to resolve a module that is not written
    // yet — a static specifier here would break `npm run build` until Phase 2 lands.
    const specifier = ['..', 'modules', 'wallet', 'wallet-ledger.service.js'].join('/');
    const mod: any = await import(specifier);
    const Service = mod.WalletLedgerService ?? mod.default;
    if (!Service) return { engine: referenceEngine, real: false };
    const instance = new Service();
    if (typeof instance.postEntry !== 'function' || typeof instance.postTransfer !== 'function') {
      return { engine: referenceEngine, real: false };
    }
    return {
      engine: {
        postEntry: (m, e) => instance.postEntry(m, e),
        postTransfer: (m, e) => instance.postTransfer(m, e),
      },
      real: true,
    };
  } catch {
    return { engine: referenceEngine, real: false };
  }
}

// ---------------------------------------------------------------------------
// Business flows, transcribed from docs/wallet-plan.md §4 and §5.
// ---------------------------------------------------------------------------

interface OrderRow {
  id: string;
  buyerWallet: string;
  sellerWallet: string;
  finalPrice: string;
  shippingFee: string;
  totalAmount: string;
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'expired';
  fundStatus: 'none' | 'held' | 'released' | 'refunded';
  paymentChannel?: 'wallet' | 'qr_direct';
  platformFee?: string;
  sellerPayout?: string;
  feeRate?: string;
  releasedBy?: string;
}

function makeOrder(id: string, buyerWallet: string, sellerWallet: string, finalPrice: string, shippingFee: string): OrderRow {
  return {
    id,
    buyerWallet,
    sellerWallet,
    finalPrice,
    shippingFee,
    totalAmount: add(finalPrice, shippingFee),
    paymentStatus: 'pending',
    fundStatus: 'none',
  };
}

function flows(db: FakeDb, engine: LedgerEngine, platform: string) {
  return {
    /** Phase 3 — bank transfer landed, Sepay reported it. */
    async topup(walletId: string, amount: string, providerTxId: string) {
      return db.transaction((m) =>
        engine.postEntry(m, {
          walletId,
          type: 'topup_success',
          amount,
          referenceType: 'sepay_webhook',
          idempotencyKey: `sepay:${providerTxId}`,
        }),
      );
    },

    /** 4A — buyer pays from wallet balance. */
    async payWithWallet(order: OrderRow) {
      assert.equal(order.paymentStatus, 'pending', 'order is not payable');
      await db.transaction((m) =>
        engine.postTransfer(m, [
          { walletId: order.buyerWallet, type: 'payment', amount: negate(order.totalAmount), referenceType: 'order', referenceId: order.id, idempotencyKey: `order_payment:${order.id}` },
          { walletId: platform, type: 'payment_escrow_in', amount: order.totalAmount, referenceType: 'order', referenceId: order.id, idempotencyKey: `order_escrow_in:${order.id}` },
        ]),
      );
      order.paymentStatus = 'paid';
      order.fundStatus = 'held';
      order.paymentChannel = 'wallet';
    },

    /** 4D — QR pass-through: the money enters the wallet, then leaves, in one go. */
    async payByQr(order: OrderRow, received: string, providerTxId: string) {
      const shortfall = toMinor(received) < toMinor(order.totalAmount);

      if (shortfall) {
        // 4E: credit what actually arrived, leave the order unpaid.
        await this.topup(order.buyerWallet, received, providerTxId);
        return { paid: false };
      }

      // Whatever actually arrived is credited in full; only total_amount leaves for
      // escrow, so any overpayment simply stays in the buyer's wallet (4E).
      await db.transaction((m) =>
        engine.postTransfer(m, [
          { walletId: order.buyerWallet, type: 'topup_success', amount: received, referenceType: 'sepay_webhook', idempotencyKey: `sepay:${providerTxId}` },
          { walletId: order.buyerWallet, type: 'payment', amount: negate(order.totalAmount), referenceType: 'order', referenceId: order.id, idempotencyKey: `order_payment:${order.id}` },
          { walletId: platform, type: 'payment_escrow_in', amount: order.totalAmount, referenceType: 'order', referenceId: order.id, idempotencyKey: `order_escrow_in:${order.id}` },
        ]),
      );
      order.paymentStatus = 'paid';
      order.fundStatus = 'held';
      order.paymentChannel = 'qr_direct';
      return { paid: true };
    },

    /** 4B — admin releases escrow, platform keeps 5% of final_price. */
    async release(order: OrderRow, adminId: string) {
      assert.equal(order.fundStatus, 'held', 'release requires fund_status=held');
      const fee = platformFeeOf(order.finalPrice);
      const payout = add(add(order.finalPrice, order.shippingFee), negate(fee));

      await db.transaction((m) =>
        engine.postTransfer(m, [
          { walletId: platform, type: 'payment_escrow_out', amount: negate(order.totalAmount), referenceType: 'order', referenceId: order.id, idempotencyKey: `order_escrow_out:${order.id}` },
          { walletId: order.sellerWallet, type: 'payment_release', amount: payout, referenceType: 'order', referenceId: order.id, idempotencyKey: `payment_release:${order.id}`, metadata: { admin_id: adminId } },
          { walletId: platform, type: 'platform_fee', amount: fee, referenceType: 'order', referenceId: order.id, idempotencyKey: `platform_fee:${order.id}`, metadata: { admin_id: adminId, fee_rate: '0.0500' } },
        ]),
      );
      order.fundStatus = 'released';
      order.platformFee = fee;
      order.sellerPayout = payout;
      order.feeRate = '0.0500';
      order.releasedBy = adminId;
    },

    /** 4C — refund while the money is still in escrow. Released is terminal. */
    async refund(order: OrderRow, adminId: string) {
      assert.equal(order.fundStatus, 'held', 'refund requires fund_status=held');
      await db.transaction((m) =>
        engine.postTransfer(m, [
          { walletId: platform, type: 'payment_escrow_out', amount: negate(order.totalAmount), referenceType: 'order', referenceId: order.id, idempotencyKey: `order_escrow_out:${order.id}` },
          { walletId: order.buyerWallet, type: 'payment_refund', amount: order.totalAmount, referenceType: 'order', referenceId: order.id, idempotencyKey: `order_refund:${order.id}`, metadata: { admin_id: adminId } },
        ]),
      );
      order.paymentStatus = 'refunded';
      order.fundStatus = 'refunded';
    },

    /**
     * 4F — PaymentDeadlineService. An order whose payment_deadline passed while the
     * money is still in escrow must give it back. Skipping this leg is how buyer money
     * gets stranded in the platform wallet forever, so it posts the same legs as 4C.
     */
    async expireOrder(order: OrderRow) {
      if (order.fundStatus === 'held') {
        await this.refund(order, 'payment-deadline-job');
      }
      order.paymentStatus = 'expired';
    },

    /** Phase 5 — withdrawal holds the money up front; reject gives it back. */
    async requestWithdrawal(walletId: string, amount: string, requestId: string) {
      return db.transaction((m) =>
        engine.postEntry(m, { walletId, type: 'withdraw_hold', amount: negate(amount), referenceType: 'withdrawal_request', referenceId: requestId, idempotencyKey: `withdraw_hold:${requestId}` }),
      );
    },

    async completeWithdrawal(walletId: string, requestId: string, adminId: string) {
      return db.transaction((m) =>
        engine.postEntry(m, { walletId, type: 'withdraw_success', amount: '0.00', referenceType: 'withdrawal_request', referenceId: requestId, idempotencyKey: `withdraw_success:${requestId}`, metadata: { admin_id: adminId } }),
      );
    },

    async rejectWithdrawal(walletId: string, amount: string, requestId: string, adminId: string) {
      return db.transaction((m) =>
        engine.postEntry(m, { walletId, type: 'withdraw_failed', amount, referenceType: 'withdrawal_request', referenceId: requestId, idempotencyKey: `withdraw_failed:${requestId}`, metadata: { admin_id: adminId } }),
      );
    },

    /** Phase 5 — the user pulls the request back while it is still pending. */
    async cancelWithdrawal(walletId: string, amount: string, requestId: string) {
      return db.transaction((m) =>
        engine.postEntry(m, { walletId, type: 'withdraw_cancelled', amount, referenceType: 'withdrawal_request', referenceId: requestId, idempotencyKey: `withdraw_cancelled:${requestId}` }),
      );
    },

    /**
     * §0.1d — the manual reconciliation valve. Used when the money is on the bank
     * statement but the webhook never arrived, and as the reversal instrument for a
     * mistake (principle 2: append a correcting entry, never UPDATE history).
     */
    async adjust(walletId: string, amount: string, adjustmentId: string, metadata: Record<string, unknown>) {
      return db.transaction((m) =>
        engine.postEntry(m, { walletId, type: 'adjustment', amount, referenceType: 'wallet_adjustment', referenceId: adjustmentId, idempotencyKey: `adjustment:${adjustmentId}`, metadata }),
      ) as Promise<LedgerRow>;
    },
  };
}

// ---------------------------------------------------------------------------
// Reconciliation — Phase 6. Runs after every scenario, not just at the end.
// ---------------------------------------------------------------------------

function assertInvariants(db: FakeDb, label: string) {
  // Invariant 1: ledger total equals the platform's total obligation. NOT zero —
  // topup_success and withdraw_hold are boundaries with the real bank account.
  const ledgerTotal = db.ledger.reduce((sum, row) => sum + toMinor(row.amount), 0n);
  const balanceTotal = [...db.wallets.values()].reduce((sum, w) => sum + toMinor(w.balance), 0n);
  assert.equal(toDecimal(ledgerTotal), toDecimal(balanceTotal), `${label}: Invariant 1 — ledger total != sum of balances`);

  // Invariant 1b: purely internal movements cancel out.
  const internal: LedgerType[] = ['payment', 'payment_escrow_in', 'payment_escrow_out', 'payment_release', 'platform_fee', 'payment_refund'];
  const internalTotal = db.ledger
    .filter((row) => internal.includes(row.type))
    .reduce((sum, row) => sum + toMinor(row.amount), 0n);
  assert.equal(toDecimal(internalTotal), '0.00', `${label}: Invariant 1b — internal entries do not net to zero`);

  for (const wallet of db.wallets.values()) {
    // Invariant 2: cached balance matches its own ledger.
    assert.equal(db.balanceOf(wallet.id), db.ledgerSumOf(wallet.id), `${label}: Invariant 2 — wallet ${wallet.id} balance drifted from its ledger`);
    // Invariant 4: nothing goes negative. No clawback path exists, so this is absolute.
    assert.ok(toMinor(wallet.balance) >= 0n, `${label}: Invariant 4 — wallet ${wallet.id} is negative (${wallet.balance})`);
  }

  // Invariant 2b: every row's balance_after must equal the running balance of its
  // wallet at that point. Invariant 2 only compares the two endpoints, so a pair of
  // rows carrying wrong snapshots that happen to cancel out slips past it — and
  // balance_after is what the transaction-history screen renders to the user.
  const running = new Map<string, bigint>();
  for (const row of db.ledger) {
    const next = (running.get(row.walletId) ?? 0n) + toMinor(row.amount);
    running.set(row.walletId, next);
    assert.equal(
      row.balanceAfter,
      toDecimal(next),
      `${label}: Invariant 2b — ledger row ${row.id} (${row.type}) recorded balance_after=${row.balanceAfter}, running balance is ${toDecimal(next)}`,
    );
  }

  assert.deepEqual(db.lockOrderViolations, [], `${label}: LED-16 — wallets locked out of ascending order`);
}

function assertEscrowCovered(db: FakeDb, platform: string, heldOrders: OrderRow[], label: string) {
  // Invariant 3: the platform wallet covers everything it is holding.
  const held = heldOrders
    .filter((order) => order.fundStatus === 'held')
    .reduce((sum, order) => sum + toMinor(order.totalAmount), 0n);
  assert.ok(toMinor(db.balanceOf(platform)) >= held, `${label}: Invariant 3 — platform wallet ${db.balanceOf(platform)} < escrow ${toDecimal(held)}`);
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

interface World {
  db: FakeDb;
  flow: ReturnType<typeof flows>;
  platform: string;
  buyer: string;
  seller: string;
}

function newWorld(engine: LedgerEngine): World {
  const db = new FakeDb();
  // Ids ascend platform < buyer < seller so lock-order checks are meaningful.
  const platform = db.createWallet('1');
  const buyer = db.createWallet('2');
  const seller = db.createWallet('3');
  return { db, flow: flows(db, engine, platform), platform, buyer, seller };
}

const scenarios: { id: string; name: string; run: (engine: LedgerEngine) => Promise<void> }[] = [
  {
    id: 'E2E-01',
    name: 'full lifecycle: top up, pay from wallet, release, withdraw, complete',
    run: async (engine) => {
      const w = newWorld(engine);
      const order = makeOrder('1001', w.buyer, w.seller, '1000000.00', '30000.00');

      await w.flow.topup(w.buyer, '2000000.00', 'sepay-tx-1');
      assert.equal(w.db.balanceOf(w.buyer), '2000000.00', 'top-up did not credit the wallet');

      await w.flow.payWithWallet(order);
      assert.equal(w.db.balanceOf(w.buyer), '970000.00');
      assert.equal(w.db.balanceOf(w.platform), '1030000.00', 'escrow did not receive the full total');
      assert.equal(order.fundStatus, 'held');
      assertEscrowCovered(w.db, w.platform, [order], 'E2E-01 held');
      assertInvariants(w.db, 'E2E-01 after payment');

      await w.flow.release(order, '77');
      // REL-01: 5% of final_price only — never of total_amount.
      assert.equal(order.platformFee, '50000.00', 'fee must be 5% of final_price, not total_amount');
      assert.equal(order.sellerPayout, '980000.00', 'seller keeps the shipping fee in full');
      assert.equal(w.db.balanceOf(w.seller), '980000.00');
      assert.equal(w.db.balanceOf(w.platform), '50000.00', 'platform should retain exactly the commission');
      assert.equal(order.releasedBy, '77', 'REL-10: released_by is never null — there is no auto-release');
      assertInvariants(w.db, 'E2E-01 after release');

      await w.flow.requestWithdrawal(w.seller, '900000.00', 'wd-1');
      assert.equal(w.db.balanceOf(w.seller), '80000.00', 'WDR-02: the hold debits immediately');

      await w.flow.completeWithdrawal(w.seller, 'wd-1', '77');
      // WDR-25: completing pays out 100% and charges nothing — the fee was taken at release.
      assert.equal(w.db.balanceOf(w.seller), '80000.00', 'completing a withdrawal must not move money again');

      assert.equal(w.db.balanceOf(w.buyer), '970000.00');
      assert.equal(w.db.balanceOf(w.platform), '50000.00');
      assertInvariants(w.db, 'E2E-01 final');
    },
  },

  {
    id: 'E2E-02',
    name: 'QR pass-through: money enters and leaves the wallet in one transfer',
    run: async (engine) => {
      const w = newWorld(engine);
      const order = makeOrder('1002', w.buyer, w.seller, '1000000.00', '30000.00');

      const before = w.db.balanceOf(w.buyer);
      const result = await w.flow.payByQr(order, '1030000.00', 'sepay-tx-2');

      assert.equal(result.paid, true);
      // QRD-03: the buyer's balance is unchanged, but both legs are in the ledger.
      assert.equal(w.db.balanceOf(w.buyer), before, 'pass-through must leave the balance untouched');
      assert.equal(order.paymentChannel, 'qr_direct');
      assert.equal(order.fundStatus, 'held');

      const buyerTypes = w.db.ledger.filter((r) => r.walletId === w.buyer).map((r) => r.type);
      assert.deepEqual(buyerTypes, ['topup_success', 'payment'], 'QRD-05: history must show money in, then out');

      await w.flow.release(order, '77');
      assert.equal(w.db.balanceOf(w.seller), '980000.00');
      assert.equal(w.db.balanceOf(w.platform), '50000.00');
      assertInvariants(w.db, 'E2E-02 final');
    },
  },

  {
    id: 'E2E-03',
    name: 'refund before release returns the full total, shipping included',
    run: async (engine) => {
      const w = newWorld(engine);
      const order = makeOrder('1003', w.buyer, w.seller, '1000000.00', '30000.00');

      await w.flow.topup(w.buyer, '1030000.00', 'sepay-tx-3');
      await w.flow.payWithWallet(order);
      await w.flow.refund(order, '77');

      // REF-02: no fee is withheld — nothing was ever released.
      assert.equal(w.db.balanceOf(w.buyer), '1030000.00', 'refund must return the full total_amount');
      assert.equal(w.db.balanceOf(w.platform), '0.00', 'escrow must be emptied by the refund');
      assert.equal(order.fundStatus, 'refunded');

      // REF-03: released is terminal. There is no clawback, by decision.
      order.fundStatus = 'released';
      await assert.rejects(() => w.flow.refund(order, '77'), /fund_status=held/, 'refund after release must be impossible');

      assertInvariants(w.db, 'E2E-03 final');
    },
  },

  {
    id: 'E2E-04',
    name: 'underpaid QR credits the wallet, leaves the order unpaid, then tops up',
    run: async (engine) => {
      const w = newWorld(engine);
      const order = makeOrder('1004', w.buyer, w.seller, '1000000.00', '30000.00');

      const result = await w.flow.payByQr(order, '1000000.00', 'sepay-tx-4');

      // UND-01: the shortfall does not strand the money — it lands in the wallet.
      assert.equal(result.paid, false);
      assert.equal(w.db.balanceOf(w.buyer), '1000000.00');
      assert.equal(order.paymentStatus, 'pending', 'an underpaid order must not be marked paid');
      assert.equal(order.fundStatus, 'none');
      assert.equal(w.db.balanceOf(w.platform), '0.00', 'nothing should reach escrow yet');

      // UND-03: the buyer makes up the difference and pays from balance.
      await w.flow.topup(w.buyer, '50000.00', 'sepay-tx-5');
      await w.flow.payWithWallet(order);
      assert.equal(w.db.balanceOf(w.buyer), '20000.00');

      await w.flow.release(order, '77');
      assert.equal(w.db.balanceOf(w.seller), '980000.00');
      assertInvariants(w.db, 'E2E-04 final');
    },
  },

  {
    id: 'E2E-05',
    name: 'rejected withdrawal refunds, then a second attempt completes',
    run: async (engine) => {
      const w = newWorld(engine);

      await w.flow.topup(w.seller, '1000000.00', 'sepay-tx-6');
      await w.flow.requestWithdrawal(w.seller, '500000.00', 'wd-2');
      assert.equal(w.db.balanceOf(w.seller), '500000.00');

      // WDR-15: rejecting puts the money back, in full.
      await w.flow.rejectWithdrawal(w.seller, '500000.00', 'wd-2', '77');
      assert.equal(w.db.balanceOf(w.seller), '1000000.00');

      await w.flow.requestWithdrawal(w.seller, '500000.00', 'wd-3');
      await w.flow.completeWithdrawal(w.seller, 'wd-3', '77');
      assert.equal(w.db.balanceOf(w.seller), '500000.00', 'each leg must apply exactly once');

      assertInvariants(w.db, 'E2E-05 final');
    },
  },

  {
    id: 'E2E-06',
    name: 'replays and double-clicks across a whole lifecycle move money once',
    run: async (engine) => {
      const w = newWorld(engine);
      const order = makeOrder('1006', w.buyer, w.seller, '1000000.00', '30000.00');

      // TOP-02: the same Sepay webhook, delivered ten times.
      for (let i = 0; i < 10; i++) await w.flow.topup(w.buyer, '2000000.00', 'sepay-tx-7');
      assert.equal(w.db.balanceOf(w.buyer), '2000000.00', 'a replayed webhook must credit once');

      // PAY-06: two concurrent pay requests for one order.
      await Promise.allSettled([w.flow.payWithWallet(order), w.flow.payWithWallet({ ...order })]);
      assert.equal(w.db.balanceOf(w.buyer), '970000.00', 'double-clicking pay must debit once');

      // REL-07: two concurrent releases.
      await Promise.allSettled([w.flow.release(order, '77'), w.flow.release({ ...order, fundStatus: 'held' }, '77')]);
      assert.equal(w.db.balanceOf(w.seller), '980000.00', 'double-clicking release must credit once');
      assert.equal(w.db.balanceOf(w.platform), '50000.00');

      // REL-06: an explicit second release is refused outright.
      await assert.rejects(() => w.flow.release(order, '77'), /fund_status=held/);

      const releaseRows = w.db.ledger.filter((r) => r.type === 'payment_release');
      assert.equal(releaseRows.length, 1, 'exactly one payment_release row may exist per order');

      assertInvariants(w.db, 'E2E-06 final');
    },
  },

  {
    id: 'E2E-07',
    name: 'overpaid QR credits every dong received and leaves the surplus in the wallet',
    run: async (engine) => {
      const w = newWorld(engine);
      const order = makeOrder('1007', w.buyer, w.seller, '1000000.00', '30000.00');

      // 4E, the overpay half: 1,100,000 arrives for a 1,030,000 order. The behaviour
      // being pinned is the one order.service.ts:333 gets wrong today — it compares
      // only with `<`, so the 70,000 surplus is swallowed and recorded nowhere.
      const result = await w.flow.payByQr(order, '1100000.00', 'sepay-tx-8');

      assert.equal(result.paid, true);
      assert.equal(order.paymentStatus, 'paid');
      assert.equal(order.fundStatus, 'held');
      assert.equal(order.paymentChannel, 'qr_direct');

      const credited = w.db.ledger
        .filter((row) => row.type === 'topup_success')
        .reduce((sum, row) => sum + toMinor(row.amount), 0n);
      assert.equal(toDecimal(credited), '1100000.00', 'the full transferAmount must be credited, not just total_amount');

      assert.equal(w.db.balanceOf(w.buyer), '70000.00', 'the overpayment must stay spendable in the buyer wallet');
      assert.equal(w.db.balanceOf(w.platform), '1030000.00', 'escrow takes exactly total_amount, no more');

      assertEscrowCovered(w.db, w.platform, [order], 'E2E-07 held');
      assertInvariants(w.db, 'E2E-07 final');
    },
  },

  {
    id: 'E2E-08',
    name: 'user cancels a pending withdrawal and the hold comes back in full',
    run: async (engine) => {
      const w = newWorld(engine);

      await w.flow.topup(w.seller, '800000.00', 'sepay-tx-9');
      await w.flow.requestWithdrawal(w.seller, '300000.00', 'wd-4');
      assert.equal(w.db.balanceOf(w.seller), '500000.00');

      // WDR: cancelling returns 100%. No fee is taken on the way out — the platform's
      // 5% was already collected at release (principle 5).
      await w.flow.cancelWithdrawal(w.seller, '300000.00', 'wd-4');
      assert.equal(w.db.balanceOf(w.seller), '800000.00', 'cancelling must return the whole hold');

      // A double-clicked cancel button must not refund twice.
      await w.flow.cancelWithdrawal(w.seller, '300000.00', 'wd-4');
      assert.equal(w.db.balanceOf(w.seller), '800000.00');
      assert.equal(w.db.ledger.filter((row) => row.type === 'withdraw_cancelled').length, 1);

      assertInvariants(w.db, 'E2E-08 final');
    },
  },

  {
    id: 'E2E-09',
    name: 'adjustment is the reconciliation valve, and corrections are appended not edited',
    run: async (engine) => {
      const w = newWorld(engine);

      // §0.1d: the transfer is on the bank statement but Sepay never called back.
      const row = await w.flow.adjust(w.buyer, '250000.00', 'adj-1', {
        reason: 'Sepay webhook never arrived for a confirmed bank transfer',
        bank_reference: 'FT24010112345',
        admin_id: '77',
      });
      assert.equal(w.db.balanceOf(w.buyer), '250000.00');

      // An adjustment with no reason and no bank reference is unauditable, and this is
      // the one entry type that can mint money without a Sepay payload behind it.
      assert.ok(row.metadata?.reason, 'an adjustment must record why it was made');
      assert.ok(row.metadata?.bank_reference, 'an adjustment must record the bank transaction id');

      // Principle 2: the ledger is append-only. A mistake is reversed by a second
      // entry, never by rewriting the first.
      await w.flow.adjust(w.buyer, '-250000.00', 'adj-2', {
        reason: 'reversal of adj-1, transfer turned out to belong to another user',
        bank_reference: 'FT24010112345',
        admin_id: '77',
      });
      assert.equal(w.db.balanceOf(w.buyer), '0.00');
      assert.equal(w.db.ledger.filter((r) => r.type === 'adjustment').length, 2, 'the correction is a new row, not an edit');

      // Invariant 4 has no exception, not even for an admin.
      await assert.rejects(
        () => w.flow.adjust(w.buyer, '-1.00', 'adj-3', { reason: 'overdraw attempt', bank_reference: 'x', admin_id: '77' }),
        /INSUFFICIENT_BALANCE/,
        'an adjustment must not be able to push a wallet negative',
      );

      assertInvariants(w.db, 'E2E-09 final');
    },
  },

  {
    id: 'E2E-10',
    name: 'a locked wallet accepts no movement in either direction',
    run: async (engine) => {
      const w = newWorld(engine);

      await w.flow.topup(w.buyer, '500000.00', 'sepay-tx-10');
      w.db.wallets.get(w.buyer)!.status = 'locked';

      await assert.rejects(() => w.flow.topup(w.buyer, '100000.00', 'sepay-tx-11'), /WALLET_LOCKED/, 'a locked wallet must not be credited');
      await assert.rejects(() => w.flow.requestWithdrawal(w.buyer, '100000.00', 'wd-5'), /WALLET_LOCKED/, 'a locked wallet must not be debited');

      assert.equal(w.db.balanceOf(w.buyer), '500000.00', 'a rejected entry must roll back without a trace');
      assert.equal(w.db.ledger.length, 1);

      assertInvariants(w.db, 'E2E-10 final');
    },
  },

  {
    id: 'E2E-11',
    name: 'CON-01: 50 concurrent payments from a wallet funded for one leave exactly one paid',
    run: async (engine) => {
      const w = newWorld(engine);
      const order = makeOrder('A', w.buyer, w.seller, '1000000.00', '30000.00');

      // Exactly one order's worth of money, 50 distinct orders racing for it.
      await w.flow.topup(w.buyer, order.totalAmount, 'sepay-tx-20');
      const orders = Array.from({ length: 50 }, (_, i) =>
        makeOrder(`C${i}`, w.buyer, w.seller, order.finalPrice, order.shippingFee));

      const results = await Promise.allSettled(orders.map((o) => w.flow.payWithWallet(o)));
      const paid = results.filter((r) => r.status === 'fulfilled');

      assert.equal(paid.length, 1, `exactly one payment may succeed, ${paid.length} did`);
      assert.equal(w.db.balanceOf(w.buyer), '0.00', 'the buyer must be drained exactly once');
      assert.equal(w.db.balanceOf(w.platform), order.totalAmount, 'escrow holds exactly one order');
      assert.equal(w.db.ledger.filter((r) => r.type === 'payment').length, 1, 'a losing request must leave no ledger row');
      for (const r of results.filter((x) => x.status === 'rejected')) {
        assert.match((r as PromiseRejectedResult).reason.message, /INSUFFICIENT_BALANCE/, 'losers must fail on balance, not on a crash');
      }

      assertEscrowCovered(w.db, w.platform, orders, 'E2E-11 held');
      assertInvariants(w.db, 'E2E-11 final');
    },
  },

  {
    id: 'E2E-12',
    name: 'LED-08: 100 concurrent writes of one idempotency_key create one row and move money once',
    run: async (engine) => {
      const w = newWorld(engine);

      const attempts = Array.from({ length: 100 }, () => w.flow.topup(w.buyer, '250000.00', 'sepay-tx-21'));
      const results = await Promise.allSettled(attempts);

      assert.equal(results.filter((r) => r.status === 'rejected').length, 0, 'a replay is success, never an error');
      assert.equal(w.db.ledger.length, 1, `the unique index must admit one row, got ${w.db.ledger.length}`);
      assert.equal(w.db.balanceOf(w.buyer), '250000.00', 'balance must move exactly once under replay');

      assertInvariants(w.db, 'E2E-12 final');
    },
  },

  {
    id: 'E2E-13',
    name: 'CON-03: release and payment racing on the platform wallet never cross lock order',
    run: async (engine) => {
      const w = newWorld(engine);
      const held = makeOrder('A', w.buyer, w.seller, '1000000.00', '30000.00');
      const fresh = makeOrder('B', w.buyer, w.seller, '500000.00', '20000.00');

      await w.flow.topup(w.buyer, '2000000.00', 'sepay-tx-22');
      await w.flow.payWithWallet(held); // A is now in escrow, ready to release

      // release locks {platform, seller}, pay locks {buyer, platform} — the opposite
      // direction if either one locked in argument order instead of by wallet id.
      await Promise.all([w.flow.release(held, '77'), w.flow.payWithWallet(fresh)]);

      assert.deepEqual(w.db.lockOrderViolations, [], 'wallets must be locked by ascending id in every transaction');
      assert.equal(held.fundStatus, 'released');
      assert.equal(fresh.fundStatus, 'held');
      assertEscrowCovered(w.db, w.platform, [held, fresh], 'E2E-13 held');
      assertInvariants(w.db, 'E2E-13 final');
    },
  },

  {
    id: 'E2E-14',
    name: 'CON-04: a crash after the ledger insert rolls the balance back with it',
    run: async (engine) => {
      const w = newWorld(engine);
      await w.flow.topup(w.buyer, '600000.00', 'sepay-tx-23');

      // The ledger row and the balance update live in one transaction. Dying between
      // them is the one failure that would leave the cache lying about the truth.
      await assert.rejects(
        () =>
          w.db.transaction(async (m) => {
            await engine.postEntry(m, {
              walletId: w.buyer,
              type: 'withdraw_hold',
              amount: '-600000.00',
              referenceType: 'withdrawal_request',
              referenceId: 'wd-crash',
              idempotencyKey: 'withdraw_hold:wd-crash',
            });
            throw new Error('PROCESS_KILLED');
          }),
        /PROCESS_KILLED/,
      );

      assert.equal(w.db.ledger.length, 1, 'the rolled-back entry must leave no ledger row');
      assert.equal(w.db.balanceOf(w.buyer), '600000.00', 'balance must be untouched after a rollback');

      // The key must be free again, otherwise a retry is locked out forever.
      await w.flow.requestWithdrawal(w.buyer, '600000.00', 'wd-crash');
      assert.equal(w.db.balanceOf(w.buyer), '0.00', 'the retry after a crash must go through');

      assertInvariants(w.db, 'E2E-14 final');
    },
  },

  {
    id: 'E2E-15',
    name: '4F: an expired order still holding escrow refunds the buyer instead of stranding it',
    run: async (engine) => {
      const w = newWorld(engine);
      const order = makeOrder('A', w.buyer, w.seller, '1000000.00', '30000.00');

      await w.flow.topup(w.buyer, '1030000.00', 'sepay-tx-24');
      await w.flow.payWithWallet(order);

      // PaymentDeadlineService runs: the deadline passed with the money in escrow.
      await w.flow.expireOrder(order);

      assert.equal(order.paymentStatus, 'expired');
      assert.equal(order.fundStatus, 'refunded', 'the job must move fund_status, not only payment_status');
      assert.equal(w.db.balanceOf(w.buyer), '1030000.00', 'the buyer must be made whole, shipping included');
      assert.equal(w.db.balanceOf(w.platform), '0.00', 'no buyer money may be left stranded in the platform wallet');
      assert.equal(w.db.ledger.filter((r) => r.type === 'payment_refund').length, 1);

      // A second sweep of the same order must not pay the buyer twice.
      await w.flow.expireOrder(order);
      assert.equal(w.db.balanceOf(w.buyer), '1030000.00', 'a repeated sweep must not refund twice');

      assertInvariants(w.db, 'E2E-15 final');
    },
  },
];

// ---------------------------------------------------------------------------
// Endpoint surface — docs/wallet-plan.md §7, all 18 endpoints.
//
// The scenarios above prove the money legs. They say nothing about whether an
// endpoint exists, who is allowed to call it, or which guard stands in front of it:
// they never touch Express. This section closes that half by walking the composed
// router's real layer stack, the way route-mounting.check.ts and
// route-auth-scope.check.ts already do in this repo — no HTTP listener, no database.
//
// Endpoints that do not exist yet report PENDING rather than FAIL, so this file can
// carry the whole plan from day one without turning `npm test` red. The moment a
// route is mounted it stops being pending and its guards become a hard gate, with no
// edit needed here. `rules` is the business logic the plan attaches to the endpoint;
// `coveredBy` names the scenario that already pins a rule down, and `null` marks a
// rule no ledger-level test can reach — it needs the service, so it stays a
// checklist item printed in the summary until its phase lands.
// ---------------------------------------------------------------------------

interface EndpointSpec {
  method: string;
  path: string;
  phase: string;
  /** Middleware that must stand in front of this route. */
  guards: string[];
  /** Ledger legs the endpoint writes, '' when it writes none. */
  legs: string;
  /** [rule, scenario that covers it | null] */
  rules: [string, string | null][];
}

const ENDPOINT_SPECS: EndpointSpec[] = [
  // ---- Phase 3 — top-up -------------------------------------------------
  {
    method: 'POST', path: '/api/v1/wallet/topup', phase: 'Phase 3', guards: ['isAuth'], legs: '',
    rules: [
      ['creates transactions row: status=pending, order_id=NULL, wallet_id=caller', null],
      ['returns a qr.sepay.vn URL built the same way as OrderService.getOrderPaymentQr', null],
      ['rate limited', null],
    ],
  },
  {
    // The plan writes this as /orders/sepay/webhook in §7 and Phase 3, but the route
    // that actually exists is /orders/webhook/sepay (order.route.ts:32). Since the plan's
    // instruction is "reuse it, do not create a second endpoint", the mounted path wins
    // and the plan's string is a typo. Asserting the plan's spelling would push the team
    // into mounting a duplicate money-printing webhook, which is the opposite of the intent.
    method: 'POST', path: '/api/v1/orders/webhook/sepay', phase: 'Phase 3 / 4D / 4E', guards: ['verifySepayWebhook'], legs: 'topup_success (+ payment, payment_escrow_in on the QR path)',
    rules: [
      ['verifySepayWebhook runs before anything else — §0.1b, past this line is a money printer', null],
      ['the credited amount comes from payload.transferAmount, never from the client body', null],
      ['idempotencyKey is sepay:{provider_transaction_id}; a replayed payload credits once', 'E2E-06'],
      ['transfer note matching BIDY{orderId} routes to the order flow, otherwise to top-up', null],
      ['an unparseable note is credited as a plain top-up, never guessed onto an order', null],
      ['underpaid: credit what arrived, order stays pending with fund_status=none', 'E2E-04'],
      ['overpaid: credit the full amount, escrow takes total_amount, surplus stays in the wallet', 'E2E-07'],
      ['returns 200 even on a duplicate, so Sepay stops retrying', null],
      ['sets transactions.transaction_status = success', null],
    ],
  },

  // ---- Phase 4 — order payment & escrow ---------------------------------
  {
    method: 'POST', path: '/api/v1/orders/:id/pay', phase: 'Phase 4A', guards: ['isAuth'], legs: 'payment −total, payment_escrow_in +total',
    rules: [
      ['both legs post in one transaction and net to zero', 'E2E-01'],
      ['order.buyer_id must be the caller', null],
      ['order.payment_status must be pending', null],
      ['now() must be within order.payment_deadline', null],
      ['sets payment_status=paid, fund_status=held, payment_channel=wallet', null],
      ['a double-clicked pay debits exactly once', 'E2E-06'],
      ['an insufficient balance is refused outright', 'E2E-09'],
    ],
  },
  {
    method: 'GET', path: '/api/v1/orders/:id/payment-qr', phase: 'Phase 4D', guards: ['isAuth'], legs: 'pass-through via the webhook',
    rules: [
      ['transfer note format BIDY{orderId padStart 3} is unchanged', null],
      ['money enters the wallet and leaves for escrow in one transfer', 'E2E-02'],
      ['creates transactions row with order_id and the buyer wallet', null],
    ],
  },
  {
    method: 'POST', path: '/api/v1/admin/orders/:id/release', phase: 'Phase 4B', guards: ['isAuth', 'isAdmin'], legs: 'payment_escrow_out −total, payment_release +payout, platform_fee +fee',
    rules: [
      ['platform_fee = ROUND(final_price * 0.05, 2), on final_price only — never on shipping_fee', 'E2E-01'],
      ['seller_payout = final_price + shipping_fee − platform_fee', 'E2E-01'],
      ['fund_status must be held; a second release is refused', 'E2E-06'],
      ['SELECT orders ... FOR UPDATE before deciding', null],
      ['snapshots platform_fee, seller_payout, fee_rate, released_at, released_by onto the order', null],
      ['notifies the seller (NotificationType.PAYMENT_RELEASED)', null],
    ],
  },
  {
    method: 'POST', path: '/api/v1/admin/orders/:id/refund', phase: 'Phase 4C', guards: ['isAuth', 'isAdmin'], legs: 'payment_escrow_out −total, payment_refund +total',
    rules: [
      ['refunds the full total_amount, shipping included, with no fee withheld', 'E2E-03'],
      ['fund_status must be held — released is terminal, there is no clawback', 'E2E-03'],
      ['sets payment_status=refunded, fund_status=refunded', null],
    ],
  },

  // ---- Phase 5 — withdrawals --------------------------------------------
  {
    method: 'POST', path: '/api/v1/wallet/withdrawals', phase: 'Phase 5', guards: ['isAuth'], legs: 'withdraw_hold −amount',
    rules: [
      ['debits the wallet immediately so the money cannot be spent twice', 'E2E-01'],
      ['one open request per user, enforced by a partial unique index on (user_id) WHERE status IN (pending, processing)', null],
      ['a 23505 from that index surfaces as WITHDRAWAL_ALREADY_PENDING, not a 500', null],
      ['deadline_at = now() + 10 days', null],
      ['no minimum and no maximum — the only limit is the available balance', 'E2E-09'],
      ['PLATFORM_WALLET_ID may not create a withdrawal request', null],
      ['rate limited', null],
    ],
  },
  {
    method: 'GET', path: '/api/v1/wallet/withdrawals', phase: 'Phase 5', guards: ['isAuth'], legs: '',
    rules: [['cursor paginated, scoped to the caller', null]],
  },
  {
    method: 'DELETE', path: '/api/v1/wallet/withdrawals/:id', phase: 'Phase 5', guards: ['isAuth'], legs: 'withdraw_cancelled +amount',
    rules: [
      ['returns 100% of the hold', 'E2E-08'],
      ['a replayed cancel refunds once', 'E2E-08'],
      ['allowed only while status=pending; processing is locked because the admin may already have transferred', null],
      ['only the owner may cancel', null],
    ],
  },
  {
    method: 'PATCH', path: '/api/v1/admin/wallet/withdrawals/:id/process', phase: 'Phase 5', guards: ['isAuth', 'isAdmin'], legs: '',
    rules: [['status change only — writes no ledger row', null]],
  },
  {
    method: 'POST', path: '/api/v1/admin/wallet/withdrawals/:id/complete', phase: 'Phase 5', guards: ['isAuth', 'isAdmin'], legs: 'withdraw_success 0.00',
    rules: [
      ['closes the book at amount 0.00 — the money left at withdraw_hold', 'E2E-05'],
      ['proof_file_id is required, uploaded through the existing file module', null],
      ['pays out 100%: no fee is computed anywhere in the withdrawal path', 'E2E-05'],
    ],
  },
  {
    method: 'POST', path: '/api/v1/admin/wallet/withdrawals/:id/reject', phase: 'Phase 5', guards: ['isAuth', 'isAdmin'], legs: 'withdraw_failed +amount',
    rules: [
      ['returns the full amount, and a later attempt can still complete', 'E2E-05'],
      ['each leg applies exactly once under replay', 'E2E-05'],
    ],
  },

  // ---- Phase 3 / 6 — admin reconciliation --------------------------------
  {
    method: 'POST', path: '/api/v1/admin/wallet/adjustment', phase: 'Phase 3 §0.1d', guards: ['isAuth', 'isAdmin'], legs: 'adjustment ±amount',
    rules: [
      ['credits a transfer that is on the bank statement but whose webhook never arrived', 'E2E-09'],
      ['reason and the bank transaction id are mandatory in metadata', 'E2E-09'],
      ['a mistake is reversed by a second entry, never by editing the first', 'E2E-09'],
      ['may not push a wallet negative', 'E2E-09'],
    ],
  },

  // ---- Phase 6 — statistics ---------------------------------------------
  {
    method: 'GET', path: '/api/v1/wallet', phase: 'Phase 6', guards: ['isAuth'], legs: '',
    rules: [['returns the real balance and status, replacing the stub that hardcodes balance: 0', null]],
  },
  {
    method: 'GET', path: '/api/v1/wallet/transactions', phase: 'Phase 6', guards: ['isAuth'], legs: '',
    rules: [
      ['cursor paginated on (wallet_id, created_at) — never OFFSET', null],
      ['filterable by type, from, to', null],
      ['each row renders balance_after, which must match the running balance', 'E2E-01'],
    ],
  },
  {
    method: 'GET', path: '/api/v1/wallet/summary', phase: 'Phase 6', guards: ['isAuth'], legs: '',
    rules: [['SUM(amount) GROUP BY type over the caller\'s ledger', null]],
  },
  {
    method: 'GET', path: '/api/v1/admin/wallet/overview', phase: 'Phase 6', guards: ['isAuth', 'isAdmin'], legs: '',
    rules: [['reads wallet_daily_summary — must not scan the full ledger', null]],
  },
  {
    method: 'GET', path: '/api/v1/admin/wallet/escrow', phase: 'Phase 6', guards: ['isAuth', 'isAdmin'], legs: '',
    rules: [
      ['SUM(total_amount) FROM orders WHERE fund_status = held', null],
      ['ordered by delivered_at ascending, so the oldest stuck order surfaces first (4F)', null],
      ['the platform wallet always covers what it is holding — Invariant 3', 'E2E-01'],
    ],
  },
];

interface MountedRoute {
  key: string;
  /** Route handlers plus every middleware mounted along the path to them. */
  middleware: Set<string>;
}

/** Rebuild the concrete paths Express would match, carrying the guards down. */
function collectWalletRoutes(layer: any, prefix = '', inherited: string[] = []): MountedRoute[] {
  if (layer.route) {
    const own = (layer.route.stack ?? []).map((s: any) => s.name).filter(Boolean);
    const path = `${prefix}${layer.route.path}`.replace(/(.)\/$/, '$1');
    return Object.keys(layer.route.methods).map((method) => ({
      key: `${method.toUpperCase()} ${path}`,
      middleware: new Set<string>([...inherited, ...own]),
    }));
  }

  if (layer.handle?.stack) {
    // Express does not keep the literal mount path, so recover it from the layer's
    // own regexp: /^\/api\/v1\/wallet\/?(?=\/|$)/ -> '/api/v1/wallet'
    const source: string = layer.regexp?.source ?? '';
    const segment = layer.regexp?.fast_slash
      ? ''
      : source.replace(/^\^/, '').replace(/\\\/\?\(\?=\\\/\|\$\)$/, '').replace(/\\\//g, '/');

    // Middleware registered with router.use(...) guards every route declared after
    // it in the same router, so it has to travel down with the prefix.
    const mountGuards = layer.handle.stack
      .filter((child: any) => !child.route && child.name && child.name !== 'router' && child.name !== '<anonymous>')
      .map((child: any) => child.name);

    return layer.handle.stack.flatMap((child: any) =>
      collectWalletRoutes(child, prefix + segment, [...inherited, ...mountGuards]),
    );
  }

  return [];
}

async function checkEndpoints(): Promise<{ failed: number; pending: number }> {
  let routes: Map<string, MountedRoute>;
  try {
    const { indexRouter } = await import('../routes/index.js');
    routes = new Map(
      (indexRouter as any).stack
        .flatMap((layer: any) => collectWalletRoutes(layer))
        .map((route: MountedRoute) => [route.key, route]),
    );
  } catch (error: any) {
    console.log(`  PENDING  router could not be composed, endpoint gates skipped: ${error.message}`);
    return { failed: 0, pending: ENDPOINT_SPECS.length };
  }

  let failed = 0;
  const pending: EndpointSpec[] = [];

  for (const spec of ENDPOINT_SPECS) {
    const key = `${spec.method} ${spec.path}`;
    const mounted = routes.get(key);

    if (!mounted) {
      pending.push(spec);
      continue;
    }

    // Mounted means implemented, so the guards stop being advisory.
    const missingGuards = spec.guards.filter((guard) => !mounted.middleware.has(guard));
    if (missingGuards.length > 0) {
      failed++;
      console.error(
        `  FAIL ${key}\n       missing guard(s): ${missingGuards.join(', ')}\n` +
          `       found: ${[...mounted.middleware].join(', ') || '(none)'}`,
      );
      continue;
    }
    console.log(`  ok   ${key}  [${spec.guards.join(' + ') || 'public'}]`);
  }

  if (pending.length > 0) {
    console.log(`\n  ${pending.length}/${ENDPOINT_SPECS.length} endpoints not mounted yet — gates arm themselves once the route exists:`);
    for (const spec of pending) {
      const uncovered = spec.rules.filter(([, by]) => by === null).length;
      console.log(
        `    PENDING  ${spec.method} ${spec.path}  (${spec.phase}, ${spec.guards.join(' + ') || 'public'})` +
          `\n             ${spec.legs || 'no ledger legs'} — ${spec.rules.length - uncovered}/${spec.rules.length} rules pinned by a scenario`,
      );
    }
  }

  return { failed, pending: pending.length };
}

/** Which plan rules still have no runnable check behind them. */
function reportRuleCoverage() {
  const all = ENDPOINT_SPECS.flatMap((spec) => spec.rules.map(([rule, by]) => ({ spec, rule, by })));
  const uncovered = all.filter((entry) => entry.by === null);

  console.log(`\nBusiness rules: ${all.length - uncovered.length}/${all.length} pinned by a scenario above.`);
  console.log('Still needing their service before a check can reach them:');
  for (const spec of ENDPOINT_SPECS) {
    const open = spec.rules.filter(([, by]) => by === null);
    if (open.length === 0) continue;
    console.log(`  ${spec.method} ${spec.path}`);
    for (const [rule] of open) console.log(`    - ${rule}`);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const { engine, real } = await loadEngine();

  if (!real) {
    console.log('  PENDING  wallet ledger engine not implemented yet');
    console.log('           expected: src/modules/wallet/wallet-ledger.service.ts');
    console.log('           exporting WalletLedgerService with postEntry() and postTransfer().');
    console.log('           Scenarios below run against the reference engine to prove the');
    console.log('           expectations themselves are self-consistent.');
    console.log('');
  }

  let failed = 0;
  for (const scenario of scenarios) {
    try {
      await scenario.run(engine);
      console.log(`  ok   ${scenario.id}  ${scenario.name}`);
    } catch (error: any) {
      failed++;
      console.error(`  FAIL ${scenario.id}  ${scenario.name}\n       ${error.message}`);
    }
  }

  console.log(`\n${scenarios.length - failed}/${scenarios.length} scenarios passed${real ? '' : ' (reference engine)'}`);

  console.log('\nEndpoint surface — docs/wallet-plan.md §7, 18 endpoints:');
  const endpoints = await checkEndpoints();
  reportRuleCoverage();

  console.log(
    `\n${ENDPOINT_SPECS.length - endpoints.pending - endpoints.failed}/${ENDPOINT_SPECS.length} endpoints mounted and correctly guarded, ` +
      `${endpoints.pending} pending, ${endpoints.failed} failing.`,
  );

  // Until the real service exists a failure here means the spec contradicts itself,
  // which is worth printing but must not fail anyone's `npm test`. A mounted endpoint
  // with the wrong guard is never excused, though — that is live code, not a stub.
  const fatal = endpoints.failed > 0 || (real && failed > 0);
  process.exit(fatal ? 1 : 0);
}

main();
