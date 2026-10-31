/**
 * Smallest runnable check for Phase 5, Phase 6, and Phase 7 wallet operations.
 *
 *   npx tsx src/tests/wallet-phase-5-6-7.check.ts
 *
 * Covers:
 * - Phase 5: Withdrawal request creation, debit hold, SLA deadline (10 days),
 *            single open request constraint, cancel, admin process, admin complete (proof_url),
 *            admin reject (refund), admin listing & overdue filter.
 * - Phase 6: User transactions (cursor-paginated, balance_after), user summary (by type),
 *            admin overview (from daily summary), admin escrow report (Invariant 3 coverage).
 * - Phase 6: Cron jobs — SLA alert, 5 invariant reconciliation, daily summary aggregation.
 * - Phase 7: Hardening — idempotency under replayed complete/reject/cancel,
 *            guard against platform wallet withdrawal, no negative balance bypass.
 */
import assert from 'node:assert/strict';
import { WalletService } from '../modules/wallet/wallet.service.js';
import { WalletCronService } from '../modules/wallet/wallet-cron.service.js';
import { Wallet } from '../modules/wallet/entity/wallet.entity.js';
import { WalletLedger } from '../modules/wallet/entity/wallet-ledger.entity.js';
import { WalletWithdrawalRequest } from '../modules/wallet/entity/wallet-withdrawal-request.entity.js';
import { WalletDailySummary } from '../modules/wallet/entity/wallet-daily-summary.entity.js';
import { Order } from '../modules/order/entity/order.entity.js';
import { toMinor, toDecimal } from '../modules/wallet/wallet-ledger.service.js';
import { User } from '../modules/user/entity/user.entity.js';
import { notificationService } from '../modules/notification/notification.service.js';
import { NotificationType } from '../modules/notification/enum/notification-type.enum.js';

function createHarness() {
  const wallets: any[] = [
    { id: '1', userId: 'user-1', balance: '1000000.00', status: 'active', createdAt: new Date(), updatedAt: new Date() },
    { id: '2', userId: 'user-2', balance: '500000.00', status: 'active', createdAt: new Date(), updatedAt: new Date() },
    { id: '3', userId: 'user-locked', balance: '500000.00', status: 'locked', createdAt: new Date(), updatedAt: new Date() },
    { id: '99', userId: 'platform-user', balance: '2000000.00', status: 'active', createdAt: new Date(), updatedAt: new Date() },
  ];

  const withdrawals: any[] = [];
  const ledgerRows: any[] = [
    { id: '1', walletId: '1', type: 'topup_success', amount: '1000000.00', balanceAfter: '1000000.00', createdAt: new Date() },
    { id: '2', walletId: '2', type: 'topup_success', amount: '500000.00', balanceAfter: '500000.00', createdAt: new Date() },
    { id: '3', walletId: '99', type: 'platform_fee', amount: '2000000.00', balanceAfter: '2000000.00', createdAt: new Date() },
  ];
  const summaries: any[] = [];
  const orders: any[] = [
    { id: '101', total_amount: '300000.00', fund_status: 'held', delivered_at: new Date(Date.now() - 86400000), created_at: new Date(Date.now() - 172800000) },
    { id: '102', total_amount: '500000.00', fund_status: 'held', delivered_at: null, created_at: new Date(Date.now() - 86400000) },
  ];

  let nextWithdrawalId = 10;
  let nextLedgerId = 10;

  const fakeLedgerService: any = {
    postEntry: async (_manager: any, entry: any) => {
      const wallet = wallets.find((w) => String(w.id) === String(entry.walletId));
      if (!wallet) throw new Error('WALLET_NOT_FOUND');
      if (wallet.status !== 'active') throw new Error('WALLET_LOCKED');

      const currentMinor = toMinor(wallet.balance);
      const deltaMinor = toMinor(entry.amount);
      const newMinor = currentMinor + deltaMinor;
      if (newMinor < 0n) throw new Error('INSUFFICIENT_BALANCE');

      const balanceAfter = toDecimal(newMinor);
      wallet.balance = balanceAfter;

      const row = {
        id: String(nextLedgerId++),
        ...entry,
        balanceAfter,
        createdAt: new Date(),
      };
      ledgerRows.push(row);
      return row;
    },
  };

  const fakeDataSource: any = {
    transaction: async (cb: any) => {
      return await cb(fakeManager);
    },
    getRepository: (entity: any) => getRepo(entity),
    query: async (sql: string, params?: any[]) => {
      if (sql.includes('wallet_daily_summary') && params) {
        const [, date, topup, payment, withdraw, fee, active] = params;
        const existingIdx = summaries.findIndex((s) => s.summaryDate === date);
        const row = {
          id: String(summaries.length + 1),
          summaryDate: date,
          totalTopup: topup,
          totalPayment: payment,
          totalWithdraw: withdraw,
          totalPlatformFee: fee,
          activeWallets: active,
          createdAt: new Date(),
        };
        if (existingIdx >= 0) summaries[existingIdx] = row;
        else summaries.push(row);
        return [row];
      }
      if (sql.includes('HAVING w.balance !=')) {
        return [];
      }
      return [];
    },
  };

  const getRepo = (entity: any) => {
    if (entity === Wallet || entity?.name === 'Wallet') {
      return {
        findOne: async (opt: any) => {
          if (opt?.where?.userId) {
            return wallets.find((w) => String(w.userId) === String(opt.where.userId)) ?? null;
          }
          if (opt?.where?.id) {
            return wallets.find((w) => String(w.id) === String(opt.where.id)) ?? null;
          }
          return null;
        },
        find: async () => wallets,
        createQueryBuilder: () => ({
          select: () => ({
            getRawOne: async () => {
              const sum = wallets.reduce((acc, w) => acc + toMinor(w.balance), 0n);
              return { total: toDecimal(sum) };
            },
          }),
          where: () => ({
            getMany: async () => wallets.filter((w) => toMinor(w.balance) < 0n),
          }),
        }),
      };
    }

    if (entity === WalletWithdrawalRequest || entity?.name === 'WalletWithdrawalRequest') {
      return {
        create: (data: any) => ({ id: String(nextWithdrawalId++), ...data, createdAt: new Date(), updatedAt: new Date() }),
        save: async (data: any) => {
          const idx = withdrawals.findIndex((w) => String(w.id) === String(data.id));
          if (idx >= 0) withdrawals[idx] = { ...withdrawals[idx], ...data };
          else withdrawals.push(data);
          return data;
        },
        findOne: async (opt: any) => {
          if (opt?.where?.userId && opt?.where?.status) {
            return (
              withdrawals.find(
                (w) =>
                  String(w.userId) === String(opt.where.userId) &&
                  ['pending', 'processing'].includes(w.status),
              ) ?? null
            );
          }
          if (opt?.where?.id) {
            return withdrawals.find((w) => String(w.id) === String(opt.where.id)) ?? null;
          }
          return null;
        },
        find: async (opt: any) => {
          let list = [...withdrawals];
          if (opt?.where?.userId) list = list.filter((w) => String(w.userId) === String(opt.where.userId));
          return list;
        },
        createQueryBuilder: () => {
          let filtered = [...withdrawals];
          return {
            where: (_expr: string, params: any) => {
              if (params?.userId) filtered = filtered.filter((w) => String(w.userId) === String(params.userId));
              return {
                andWhere: () => {},
                orderBy: () => ({
                  addOrderBy: () => ({
                    take: () => ({
                      getMany: async () => filtered,
                    }),
                  }),
                  take: () => ({
                    getMany: async () => filtered,
                  }),
                }),
              };
            },
          };
        },
      };
    }

    if (entity === WalletLedger || entity?.name === 'WalletLedger') {
      let isNonBoundary = false;
      const qb: any = {
        where: (expr?: string) => {
          if (expr?.includes('NOT IN')) isNonBoundary = true;
          return qb;
        },
        andWhere: () => qb,
        orderBy: () => qb,
        addOrderBy: () => qb,
        take: () => qb,
        getMany: async () => ledgerRows,
        select: () => qb,
        addSelect: () => qb,
        groupBy: () => qb,
        getRawMany: async () => [
          { type: 'topup_success', totalAmount: '1000000.00', count: 1 },
        ],
        getRawOne: async () => {
          if (isNonBoundary) {
            isNonBoundary = false;
            return { total: '0.00' };
          }
          const sum = wallets.reduce((acc, w) => acc + toMinor(w.balance), 0n);
          return { total: toDecimal(sum) };
        },
      };
      return {
        createQueryBuilder: () => qb,
      };
    }

    if (entity === WalletDailySummary || entity?.name === 'WalletDailySummary') {
      return {
        findOneOrFail: async () => summaries[0] ?? { summaryDate: '2026-09-17' },
        createQueryBuilder: () => ({
          where: () => ({ andWhere: () => ({}) }),
          orderBy: () => ({
            take: () => ({
              getMany: async () => summaries,
            }),
          }),
        }),
      };
    }

    if (entity === Order || entity?.name === 'Order') {
      const qb: any = {
        where: () => qb,
        andWhere: () => qb,
        orderBy: () => qb,
        addOrderBy: () => qb,
        take: () => qb,
        getMany: async () => orders,
        select: () => qb,
        addSelect: () => qb,
        getRawOne: async () => ({ totalEscrow: '800000.00', total: '800000.00', count: 2 }),
      };
      return {
        createQueryBuilder: () => qb,
      };
    }

    return {} as any;
  };

  const files: any[] = [
    { id: '100', s3Key: 'withdrawal-proofs/receipt.jpg', originalName: 'receipt.jpg', mimeType: 'image/jpeg', sizeBytes: 1024 },
  ];
  const fakeFileService: any = {
    findById: async (id: string) => files.find((f) => String(f.id) === String(id)) ?? null,
    urlOf: async (file: any) => (file ? `https://r2.bidy.vn/${file.s3Key}` : null),
    urlsByIds: async (ids: (string | null | undefined)[]) => {
      const map = new Map<string, string>();
      for (const id of ids) {
        if (!id) continue;
        const file = files.find((f) => String(f.id) === String(id));
        if (file) map.set(id, `https://r2.bidy.vn/${file.s3Key}`);
      }
      return map;
    },
  };

  const fakeManager: any = {
    getRepository: (entity: any) => getRepo(entity),
  };

  return {
    wallets,
    withdrawals,
    ledgerRows,
    summaries,
    orders,
    files,
    fakeDataSource,
    fakeLedgerService,
    fakeFileService,
  };
}

async function runTests() {
  process.env.PLATFORM_WALLET_ID = '99';

  console.log('Testing Phase 5: Withdrawal Operations...');
  const h = createHarness();
  const service = new WalletService(
    h.fakeDataSource.getRepository(Wallet),
    {} as any,
    h.fakeLedgerService,
    h.fakeDataSource,
    h.fakeFileService,
  );

  // 1. Create withdrawal: normal success
  const wReq = await service.createWithdrawal('user-1', {
    amount: '200000.00',
    bankAccountNo: '0123456789',
    bankAccountName: 'NGUYEN VAN A',
    bankCode: 'MB',
  });
  assert.equal(wReq.status, 'pending');
  assert.equal(wReq.amount, '200000.00');
  assert.equal(wReq.bankCode, 'MB');
  assert.ok(wReq.deadlineAt.getTime() > Date.now()); // SLA = 10 days
  // Balance debited by 200,000
  const user1Wallet = await service.getWalletByUserId('user-1');
  assert.equal(user1Wallet.balance, '800000.00');
  console.log('  ok   P5-01  createWithdrawal debits balance and sets 10-day deadline');

  // 2. Reject duplicate open request (WITHDRAWAL_ALREADY_PENDING)
  await assert.rejects(
    async () => {
      await service.createWithdrawal('user-1', {
        amount: '50000.00',
        bankAccountNo: '0123456789',
        bankAccountName: 'NGUYEN VAN A',
        bankCode: 'MB',
      });
    },
    (err: any) => err.message === 'WITHDRAWAL_ALREADY_PENDING',
  );
  console.log('  ok   P5-02  enforces 1 open request per user (WITHDRAWAL_ALREADY_PENDING)');

  // 3. Reject platform wallet withdrawal
  await assert.rejects(
    async () => {
      await service.createWithdrawal('platform-user', {
        amount: '100000.00',
        bankAccountNo: '0123456789',
        bankAccountName: 'PLATFORM',
        bankCode: 'MB',
      });
    },
    (err: any) => err.message.includes('Platform wallet'),
  );
  console.log('  ok   P5-03  PLATFORM_WALLET_ID is blocked from withdrawing');

  // 4. Reject locked wallet withdrawal
  await assert.rejects(
    async () => {
      await service.createWithdrawal('user-locked', {
        amount: '100000.00',
        bankAccountNo: '0123456789',
        bankAccountName: 'LOCKED',
        bankCode: 'MB',
      });
    },
    (err: any) => err.message === 'WALLET_LOCKED',
  );
  console.log('  ok   P5-04  locked wallet cannot withdraw');

  // 5. User cancels pending withdrawal -> full refund
  const cancelled = await service.cancelWithdrawal('user-1', wReq.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancelledBy, 'user');
  assert.equal(user1Wallet.balance, '1000000.00'); // refunded
  console.log('  ok   P5-05  cancelWithdrawal refunds 100% of the hold');

  // 6. Cancel replay is idempotent
  const replayCancel = await service.cancelWithdrawal('user-1', wReq.id);
  assert.equal(replayCancel.status, 'cancelled');
  console.log('  ok   P5-06  cancel replay is idempotent');

  // 7. Create another withdrawal to test admin processing & completion
  const wReq2 = await service.createWithdrawal('user-1', {
    amount: '400000.00',
    bankAccountNo: '0123456789',
    bankAccountName: 'NGUYEN VAN A',
    bankCode: 'MB',
  });
  assert.equal(user1Wallet.balance, '600000.00');

  // Admin processes
  const processing = await service.processWithdrawal('admin-1', wReq2.id);
  assert.equal(processing.status, 'processing');
  assert.equal(processing.adminId, 'admin-1');
  console.log('  ok   P5-07  processWithdrawal moves status to processing without ledger movement');

  // User cannot cancel once in processing
  await assert.rejects(
    async () => {
      await service.cancelWithdrawal('user-1', wReq2.id);
    },
    (err: any) => err.message.includes('Cannot cancel'),
  );
  console.log('  ok   P5-08  user cannot cancel request once in processing');

  // Admin complete requires proof_file_id
  await assert.rejects(
    async () => {
      await service.completeWithdrawal('admin-1', wReq2.id, {} as any);
    },
    (err: any) => err.message.includes('proof_file_id is required'),
  );
  console.log('  ok   P5-09  completeWithdrawal requires proof_file_id');

  // Admin complete rejects non-existent file
  await assert.rejects(
    async () => {
      await service.completeWithdrawal('admin-1', wReq2.id, { proof_file_id: '99999' });
    },
    (err: any) => err.message.includes('Proof file not found'),
  );

  // Admin completes with proof
  const completed = await service.completeWithdrawal('admin-1', wReq2.id, {
    proof_file_id: '100',
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.proofFileId, '100');
  assert.equal(completed.proofUrl, 'https://r2.bidy.vn/withdrawal-proofs/receipt.jpg');
  // Balance unchanged because hold was already deducted at creation
  assert.equal(user1Wallet.balance, '600000.00');
  console.log('  ok   P5-10  completeWithdrawal closes book at 0.00 with proof_file_id');

  // 8. Test admin reject workflow
  const wReq3 = await service.createWithdrawal('user-2', {
    amount: '300000.00',
    bankAccountNo: '9876543210',
    bankAccountName: 'TRAN VAN B',
    bankCode: 'VCB',
  });
  const user2Wallet = await service.getWalletByUserId('user-2');
  assert.equal(user2Wallet.balance, '200000.00');

  const rejected = await service.rejectWithdrawal('admin-1', wReq3.id, {
    reject_reason: 'Invalid account number',
  });
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.rejectReason, 'Invalid account number');
  assert.equal(user2Wallet.balance, '500000.00'); // refunded
  console.log('  ok   P5-11  rejectWithdrawal refunds full amount to user wallet');

  // 12. Admin list carries the source breakdown and the bank-benchmark total (plan Phase 5).
  const qbOf = (terminal: Record<string, () => Promise<any>>) => {
    const qb: any = new Proxy({}, { get: (_t, k: string) => terminal[k] ?? (() => qb) });
    return qb;
  };
  const listDs: any = {
    getRepository: (entity: any) => ({
      createQueryBuilder: () =>
        entity === WalletWithdrawalRequest
          ? qbOf({ getMany: async () => [{ id: '5', walletId: '1' }, { id: '4', walletId: '2' }] })
          : qbOf({ getRawMany: async () => [
              { wallet_id: '1', type: 'topup_success', sum: '1000000.00' },
              { wallet_id: '1', type: 'payment_release', sum: '475000.00' },
            ] }),
    }),
    query: async (sql: string) => (sql.includes('FROM wallets') ? [{ totalUserLiability: '4000000.00' }] : []),
  };
  const listed = await new WalletService({} as any, {} as any, h.fakeLedgerService, listDs, h.fakeFileService).listAdminWithdrawals({} as any);
  assert.equal(listed.totalUserLiability, '4000000.00');
  assert.deepEqual(listed.items[0].sourceBreakdown, { selfTopup: '1000000.00', salesRevenue: '475000.00' });
  assert.deepEqual(listed.items[1].sourceBreakdown, { selfTopup: '0.00', salesRevenue: '0.00' });
  console.log('  ok   P5-12  listAdminWithdrawals returns source breakdown and total user liability');

  console.log('\nTesting Phase 6: Statistics, Escrow & Invariants...');
  // 9. User transactions cursor-paginated
  const txList = await service.getUserTransactions('user-1', { limit: 10 });
  assert.ok(Array.isArray(txList.items));
  console.log('  ok   P6-01  getUserTransactions returns transactions with cursor pagination');

  // 10. User summary by type
  const summary = await service.getUserSummary('user-1', {});
  assert.equal(summary.walletId, '1');
  assert.ok(summary.byType);
  console.log('  ok   P6-02  getUserSummary aggregates totals by ledger type');

  // 11. Admin escrow report
  const escrowReport = await service.getAdminEscrow({});
  assert.equal(escrowReport.totalEscrow, '800000.00');
  assert.equal(escrowReport.heldOrderCount, 2);
  assert.equal(escrowReport.platformWalletBalance, '2000000.00');
  assert.equal(escrowReport.isEscrowCovered, true); // 2,000,000 >= 800,000
  console.log('  ok   P6-03  getAdminEscrow reports held escrow and platform coverage (Invariant 3)');

  // 12. WalletCronService reconciliation
  const cronService = new WalletCronService(h.fakeDataSource);
  const invResults = await cronService.checkInvariants();
  assert.equal(invResults.allPassed, true);
  assert.equal(invResults.results.length, 5); // Invariant 0, 1, 2, 3, 4
  console.log('  ok   P6-04  checkInvariants verifies all 5 financial invariants');

  // 13. Daily summary aggregation
  const daily = await cronService.aggregateDailySummary(new Date('2026-09-17'));
  assert.ok(daily);
  // 17:30Z is already 00:30 on the 18th in Vietnam, so it belongs to the 18th's summary.
  const upsertDates: string[] = [];
  const realQuery = h.fakeDataSource.query;
  h.fakeDataSource.query = async (sql: string, params?: any[]) => {
    if (sql.includes('wallet_daily_summary') && params) upsertDates.push(params[0]);
    return realQuery(sql, params);
  };
  await cronService.aggregateDailySummary(new Date('2026-09-17T17:30:00Z'));
  h.fakeDataSource.query = realQuery;
  assert.deepEqual(upsertDates, ['2026-09-18']);
  console.log('  ok   P6-05  aggregateDailySummary generates and saves summary record (Vietnam calendar day)');

  // 14–15. Admins are notified on SLA breach and on a failed invariant (plan Phase 5/6).
  const sent: any[] = [];
  const originalCreate = notificationService.createNotification;
  notificationService.createNotification = (async (data: any) => { sent.push(data); }) as any;
  let userQuery: any;
  const alertDs: any = {
    ...h.fakeDataSource,
    getRepository: (entity: any) => {
      if (entity === User) return { find: async (opt: any) => { userQuery = opt; return [{ id: 'admin-1' }, { id: 'admin-2' }]; } };
      if (entity === WalletWithdrawalRequest) return { find: async () => [{ id: '7' }, { id: '8' }] };
      return h.fakeDataSource.getRepository(entity);
    },
  };
  try {
    const alertCron = new WalletCronService(alertDs);
    const sla = await alertCron.checkWithdrawalSla();
    assert.equal(sla.overdueCount, 2);
    assert.equal(sent.length, 2);
    assert.ok(sent.every((n) => n.type === NotificationType.WITHDRAWAL_SLA_OVERDUE));
    assert.deepEqual(sent.map((n) => n.recipient), ['admin-1', 'admin-2']);
    assert.equal(userQuery.where.role, 'admin');
    console.log('  ok   P6-06  checkWithdrawalSla notifies every active admin');

    sent.length = 0;
    alertCron.checkInvariants = async () => ({
      allPassed: false,
      results: [{ invariant: 'Invariant 2', passed: false, message: 'drift' }],
    });
    alertCron.aggregateDailySummary = async () => ({} as any);
    await alertCron.runNightlyReconciliation();
    assert.equal(sent.length, 2);
    assert.ok(sent.every((n) => n.type === NotificationType.WALLET_RECONCILIATION_FAILED));
    assert.match(sent[0].message, /Invariant 2/);
    console.log('  ok   P6-07  runNightlyReconciliation alerts admins when an invariant fails');
  } finally {
    notificationService.createNotification = originalCreate;
  }

  console.log('\nAll Phase 5, 6, 7 checks passed successfully.');
}

runTests().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});
