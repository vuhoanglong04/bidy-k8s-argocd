import { In, LessThan, Not, Repository } from 'typeorm';
import { AppDataSource } from '../../database/data-source.js';
import { Wallet } from './entity/wallet.entity.js';
import { WalletLedger } from './entity/wallet-ledger.entity.js';
import { WalletWithdrawalRequest } from './entity/wallet-withdrawal-request.entity.js';
import { WalletDailySummary } from './entity/wallet-daily-summary.entity.js';
import { Order } from '../order/entity/order.entity.js';
import { User } from '../user/entity/user.entity.js';
import { UserRole, UserStatus } from '../user/enum/user.enum.js';
import { notificationService } from '../notification/notification.service.js';
import { NotificationType } from '../notification/enum/notification-type.enum.js';
import { NotificationCategory } from '../notification/enum/notification-category.enum.js';
import { NotificationPriority } from '../notification/enum/notification-priority.enum.js';
import { BOUNDARY_TYPES, toMinor, toDecimal } from './wallet-ledger.service.js';
import { logger } from '../../common/util/logger.js';
import { VNTimeUtils } from '../../common/util/vnTimezone.js';

export interface InvariantResult {
  invariant: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export class WalletCronService {
  constructor(
    private readonly dataSource = AppDataSource,
  ) {}

  private get walletRepo(): Repository<Wallet> {
    return this.dataSource.getRepository(Wallet);
  }

  private get ledgerRepo(): Repository<WalletLedger> {
    return this.dataSource.getRepository(WalletLedger);
  }

  private get withdrawalRepo(): Repository<WalletWithdrawalRequest> {
    return this.dataSource.getRepository(WalletWithdrawalRequest);
  }

  private get dailySummaryRepo(): Repository<WalletDailySummary> {
    return this.dataSource.getRepository(WalletDailySummary);
  }

  private get orderRepo(): Repository<Order> {
    return this.dataSource.getRepository(Order);
  }

  private async notifyAdmins(
    type: NotificationType,
    title: string,
    message: string,
    relatedData?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const admins = await this.dataSource.getRepository(User).find({
        where: {
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          email: Not('system@internal.bidy'),
        },
        select: { id: true },
      });

      for (const admin of admins) {
        try {
          await notificationService.createNotification({
            recipient: String(admin.id),
            type,
            title,
            message,
            category: NotificationCategory.SYSTEM,
            priority: NotificationPriority.URGENT,
            relatedData,
          });
        } catch (notifErr: any) {
          logger.error('[WalletCronService] Failed to send admin notification', {
            adminId: admin.id,
            type,
            error: notifErr?.message ?? notifErr,
          });
        }
      }
    } catch (err: any) {
      logger.error('[WalletCronService] Failed to query admins for notification', {
        type,
        error: err?.message ?? err,
      });
    }
  }

  /**
   * Phase 5 — Withdrawal SLA warning cron (runs hourly).
   * Queries pending/processing requests where deadline_at < now() and notifies/alerts.
   * Does NOT automatically refund/cancel (per docs/wallet-plan.md Phase 5).
   */
  async checkWithdrawalSla(): Promise<{ overdueCount: number; overdueIds: string[] }> {
    const overdue = await this.withdrawalRepo.find({
      where: {
        status: In(['pending', 'processing']),
        deadlineAt: LessThan(new Date()),
      },
      order: { deadlineAt: 'ASC' },
    });

    if (overdue.length > 0) {
      logger.warn('[Cron-Withdrawal-SLA]: Overdue withdrawal requests found!', {
        count: overdue.length,
        ids: overdue.map((r) => r.id),
      });

      await this.notifyAdmins(
        NotificationType.WITHDRAWAL_SLA_OVERDUE,
        'Yêu cầu rút tiền quá hạn SLA',
        `${overdue.length} yêu cầu rút tiền đã quá hạn 10 ngày chưa xử lý.`,
        { withdrawalIds: overdue.map((r) => String(r.id)) },
      );
    }

    return {
      overdueCount: overdue.length,
      overdueIds: overdue.map((r) => r.id),
    };
  }

  /**
   * Phase 6 — Nightly reconciliation of 5 financial invariants.
   *
   * Invariant 0: Bank statement benchmark logging: total user liability = SUM(wallets.balance).
   * Invariant 1: System ledger equals system wallet balances; internal non-boundary legs net to 0.
   * Invariant 2: Per-wallet integrity: wallet.balance === SUM(wallet_ledger.amount WHERE wallet_id = X).
   * Invariant 3: Escrow coverage: platform wallet balance >= SUM(orders.total_amount WHERE fund_status = 'held').
   * Invariant 4: No wallet balance may be negative.
   *
   * If any invariant is violated, logs CRITICAL alerts without modifying data.
   */
  async checkInvariants(): Promise<{ allPassed: boolean; results: InvariantResult[] }> {
    const results: InvariantResult[] = [];

    // --- Invariant 0: Bank reconciliation benchmark --------------------------
    const totalBalanceRow = await this.walletRepo
      .createQueryBuilder('w')
      .select('COALESCE(SUM(w.balance), 0)', 'total')
      .getRawOne();
    const systemTotalBalance = toDecimal(toMinor(totalBalanceRow?.total ?? '0.00'));
    logger.info('[Reconciliation-Inv0]: Bank balance benchmark', {
      systemTotalBalance,
      note: 'Admin bank account must hold at least this amount.',
    });
    results.push({
      invariant: 'Invariant 0 — Bank Balance Benchmark',
      passed: true,
      message: `System total user balance: ${systemTotalBalance}`,
      details: { systemTotalBalance },
    });

    // --- Invariant 1: System-wide balance equality & internal zero-sum -------
    const ledgerTotalRow = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.amount), 0)', 'total')
      .getRawOne();
    const ledgerTotal = toDecimal(toMinor(ledgerTotalRow?.total ?? '0.00'));

    const inv1BalanceMatch = systemTotalBalance === ledgerTotal;

    const boundaryList = Array.from(BOUNDARY_TYPES);
    const internalZeroRow = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.amount), 0)', 'total')
      .where('l.type NOT IN (:...boundaryTypes)', { boundaryTypes: boundaryList })
      .getRawOne();
    const internalSum = toDecimal(toMinor(internalZeroRow?.total ?? '0.00'));
    const internalZeroMatch = internalSum === '0.00';

    const inv1Passed = inv1BalanceMatch && internalZeroMatch;
    if (!inv1Passed) {
      logger.error('[Reconciliation-Inv1]: CRITICAL - Ledger balance mismatch!', null, {
        systemTotalBalance,
        ledgerTotal,
        internalSum,
      });
    }
    results.push({
      invariant: 'Invariant 1 — System Ledger Balance & Internal Zero-Sum',
      passed: inv1Passed,
      message: inv1Passed
        ? 'Ledger total matches wallets balance, and internal transfers net to 0.'
        : `Mismatch: wallets=${systemTotalBalance}, ledger=${ledgerTotal}, internalNet=${internalSum}`,
      details: { systemTotalBalance, ledgerTotal, internalSum },
    });

    // --- Invariant 2: Per-wallet ledger check ---------------------------------
    const mismatchedWallets = await this.dataSource.query(`
      SELECT w.id, w.balance::text AS wallet_balance, COALESCE(SUM(l.amount), 0)::text AS ledger_sum
      FROM wallets w
      LEFT JOIN wallet_ledger l ON l.wallet_id = w.id
      GROUP BY w.id
      HAVING w.balance != COALESCE(SUM(l.amount), 0)
    `);

    const inv2Passed = mismatchedWallets.length === 0;
    if (!inv2Passed) {
      logger.error('[Reconciliation-Inv2]: CRITICAL - Per-wallet balance mismatch detected!', null, {
        count: mismatchedWallets.length,
        mismatches: mismatchedWallets,
      });
    }
    results.push({
      invariant: 'Invariant 2 — Per-Wallet Ledger Integrity',
      passed: inv2Passed,
      message: inv2Passed
        ? 'All individual wallet balances match their ledger sums.'
        : `${mismatchedWallets.length} wallet(s) have mismatched balance vs ledger.`,
      details: { mismatchedCount: mismatchedWallets.length, mismatches: mismatchedWallets },
    });

    // --- Invariant 3: Escrow coverage ----------------------------------------
    const escrowRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'total')
      .where('o.fund_status = :status', { status: 'held' })
      .getRawOne();
    const heldEscrowTotal = toDecimal(toMinor(escrowRow?.total ?? '0.00'));

    const platformWalletId = process.env.PLATFORM_WALLET_ID;
    let platformBalance = '0.00';
    if (platformWalletId) {
      const platformWallet = await this.walletRepo.findOne({
        where: { id: platformWalletId },
      });
      if (platformWallet) {
        platformBalance = platformWallet.balance;
      }
    }

    const platformMinor = toMinor(platformBalance);
    const escrowMinor = toMinor(heldEscrowTotal);
    const inv3Passed = platformMinor >= escrowMinor;

    if (!inv3Passed) {
      logger.error('[Reconciliation-Inv3]: CRITICAL - Platform wallet does not cover held escrow!', null, {
        platformBalance,
        heldEscrowTotal,
        deficit: toDecimal(escrowMinor - platformMinor),
      });
    }
    results.push({
      invariant: 'Invariant 3 — Escrow Coverage',
      passed: inv3Passed,
      message: inv3Passed
        ? 'Platform wallet covers all held escrow funds.'
        : `Deficit: platform=${platformBalance}, requiredEscrow=${heldEscrowTotal}`,
      details: { platformBalance, heldEscrowTotal },
    });

    // --- Invariant 4: No negative wallet balances ----------------------------
    const negativeWallets = await this.walletRepo
      .createQueryBuilder('w')
      .where('w.balance < 0')
      .getMany();

    const inv4Passed = negativeWallets.length === 0;
    if (!inv4Passed) {
      logger.error('[Reconciliation-Inv4]: CRITICAL - Negative wallet balances found!', null, {
        count: negativeWallets.length,
        wallets: negativeWallets.map((w) => ({ id: w.id, balance: w.balance })),
      });
    }
    results.push({
      invariant: 'Invariant 4 — No Negative Balances',
      passed: inv4Passed,
      message: inv4Passed
        ? 'No wallet has a negative balance.'
        : `${negativeWallets.length} wallet(s) have negative balances!`,
      details: {
        count: negativeWallets.length,
        wallets: negativeWallets.map((w) => ({ id: w.id, balance: w.balance })),
      },
    });

    const allPassed = results.every((r) => r.passed);
    return { allPassed, results };
  }

  /**
   * Phase 6 — Nightly aggregation into wallet_daily_summary for a specific date (defaults to yesterday).
   * Days are Vietnam calendar days (00:00–23:59 Asia/Ho_Chi_Minh), not UTC days.
   */
  async aggregateDailySummary(targetDate?: Date): Promise<WalletDailySummary> {
    const day = targetDate
      ? VNTimeUtils.convertToVNTime(targetDate)
      : VNTimeUtils.getCurrentVNTime().subtract(1, 'day');
    const summaryDateStr = day.format('YYYY-MM-DD');

    const startOfDay = day.clone().startOf('day').toDate();
    const endOfDay = day.clone().endOf('day').toDate();

    // Topup total
    const topupRow = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.amount), 0)', 'total')
      .where('l.type = :type AND l.created_at BETWEEN :start AND :end', {
        type: 'topup_success',
        start: startOfDay,
        end: endOfDay,
      })
      .getRawOne();
    const totalTopup = toDecimal(toMinor(topupRow?.total ?? '0.00'));

    // Payment total (amounts are negative in ledger for buyer, absolute value aggregated)
    const paymentRow = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('COALESCE(SUM(ABS(l.amount)), 0)', 'total')
      .where('l.type = :type AND l.created_at BETWEEN :start AND :end', {
        type: 'payment',
        start: startOfDay,
        end: endOfDay,
      })
      .getRawOne();
    const totalPayment = toDecimal(toMinor(paymentRow?.total ?? '0.00'));

    // Withdraw total (holds debit wallets)
    const withdrawRow = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('COALESCE(SUM(ABS(l.amount)), 0)', 'total')
      .where('l.type = :type AND l.created_at BETWEEN :start AND :end', {
        type: 'withdraw_hold',
        start: startOfDay,
        end: endOfDay,
      })
      .getRawOne();
    const totalWithdraw = toDecimal(toMinor(withdrawRow?.total ?? '0.00'));

    // Platform fee total
    const feeRow = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.amount), 0)', 'total')
      .where('l.type = :type AND l.created_at BETWEEN :start AND :end', {
        type: 'platform_fee',
        start: startOfDay,
        end: endOfDay,
      })
      .getRawOne();
    const totalPlatformFee = toDecimal(toMinor(feeRow?.total ?? '0.00'));

    // Active wallets with activity on this day
    const activeRow = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('COUNT(DISTINCT l.wallet_id)', 'count')
      .where('l.created_at BETWEEN :start AND :end', {
        start: startOfDay,
        end: endOfDay,
      })
      .getRawOne();
    const activeWallets = Number(activeRow?.count ?? 0);

    // Upsert into wallet_daily_summary
    await this.dataSource.query(
      `
      INSERT INTO wallet_daily_summary (
        summary_date, total_topup, total_payment, total_withdraw, total_platform_fee, active_wallets
      ) VALUES ($1, $2::numeric(14,2), $3::numeric(14,2), $4::numeric(14,2), $5::numeric(14,2), $6)
      ON CONFLICT (summary_date) DO UPDATE SET
        total_topup = EXCLUDED.total_topup,
        total_payment = EXCLUDED.total_payment,
        total_withdraw = EXCLUDED.total_withdraw,
        total_platform_fee = EXCLUDED.total_platform_fee,
        active_wallets = EXCLUDED.active_wallets
    `,
      [summaryDateStr, totalTopup, totalPayment, totalWithdraw, totalPlatformFee, activeWallets],
    );

    const saved = await this.dailySummaryRepo.findOneOrFail({
      where: { summaryDate: summaryDateStr },
    });

    logger.info('[Reconciliation-DailySummary]: Daily summary aggregated successfully', {
      summaryDate: summaryDateStr,
      totalTopup,
      totalPayment,
      totalWithdraw,
      totalPlatformFee,
      activeWallets,
    });

    return saved;
  }

  /**
   * Run full nightly reconciliation workflow.
   */
  async runNightlyReconciliation(): Promise<{
    invariants: { allPassed: boolean; results: InvariantResult[] };
    dailySummary: WalletDailySummary;
  }> {
    const invariants = await this.checkInvariants();
    if (!invariants.allPassed) {
      const failed = invariants.results.filter((r) => !r.passed);
      const failedNames = failed.map((r) => r.invariant).join(', ');
      await this.notifyAdmins(
        NotificationType.WALLET_RECONCILIATION_FAILED,
        'Đối soát ví phát hiện sai lệch',
        `Phát hiện sai lệch tại các kiểm tra: ${failedNames}`,
        { failed },
      );
    }
    const dailySummary = await this.aggregateDailySummary();
    return { invariants, dailySummary };
  }
}
