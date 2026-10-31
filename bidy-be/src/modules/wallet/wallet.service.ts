import crypto from 'crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Wallet } from './entity/wallet.entity.js';
import { Transaction } from '../order/entity/transaction.entity.js';
import { WalletLedger } from './entity/wallet-ledger.entity.js';
import { WalletWithdrawalRequest } from './entity/wallet-withdrawal-request.entity.js';
import { WalletDailySummary } from './entity/wallet-daily-summary.entity.js';
import { Order } from '../order/entity/order.entity.js';
import { AppDataSource } from '../../database/data-source.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { sepayConfig } from '../../config/sepay.config.js';
import { buildSepayQrUrl } from '../../common/util/sepay-qr.util.js';
import { WalletLedgerService, toMinor, toDecimal } from './wallet-ledger.service.js';
import {
  CreateWithdrawalDto,
  CompleteWithdrawalDto,
  RejectWithdrawalDto,
  AdminListWithdrawalsDto,
  ListWithdrawalsDto,
} from './dtos/withdrawal.dto.js';
import { createNotification } from '../notification/notification.service.js';
import { NotificationType } from '../notification/enum/notification-type.enum.js';
import { FileService } from '../file/file.service.js';
import { fileService as defaultFileService } from '../file/file.provider.js';

export interface WalletAdjustmentParams {
  walletId: string;
  amount: string | number;
  reason: string;
  bank_reference?: string;
  bankTransactionId?: string;
  bankReference?: string;
}

export class WalletService {
  constructor(
    private readonly walletRepository: Repository<Wallet> = AppDataSource.getRepository(Wallet),
    private readonly transactionRepository: Repository<Transaction> = AppDataSource.getRepository(Transaction),
    private readonly walletLedgerService: WalletLedgerService = new WalletLedgerService(),
    private readonly dataSource: DataSource = AppDataSource,
    private readonly fileService: FileService = defaultFileService,
  ) {}

  /**
   * Retrieve wallet information for a given user.
   */
  async getWalletByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });

    if (!wallet) {
      throw new AppError('WALLET_NOT_FOUND', 404);
    }

    return wallet;
  }

  /**
   * Initiates a wallet top-up request.
   * Creates a pending Transaction row (order_id = null, wallet_id = caller's wallet)
   * and builds the VietQR payment instructions.
   */
  async topup(userId: string, amount: string) {
    const wallet = await this.getWalletByUserId(userId);
    if (wallet.status !== 'active') {
      throw new AppError('WALLET_LOCKED', 403);
    }

    const amountMinor = toMinor(amount);
    if (amountMinor <= 0n) {
      throw new AppError('Top-up amount must be strictly positive', 400);
    }
    const canonicalAmount = toDecimal(amountMinor);

    const transaction = this.transactionRepository.create({
      userId,
      walletId: wallet.id,
      orderId: null,
      amount: canonicalAmount as any,
      paymentMethod: 'sepay',
      transactionStatus: 'pending',
      transactionDate: new Date(),
    });

    const savedTx = await this.transactionRepository.save(transaction);

    const paymentPrefix = sepayConfig.paymentPrefix || 'BIDY';
    const paddedId = String(savedTx.id).padStart(3, '0');
    const paymentCode = `${paymentPrefix}TOPUP${paddedId}`;

    const { bankName, accountNumber, accountName } = sepayConfig;
    const qrCodeUrl = buildSepayQrUrl({
      accountNumber,
      bankName,
      amount: canonicalAmount,
      des: paymentCode,
    });

    return {
      transactionId: savedTx.id,
      walletId: wallet.id,
      amount: canonicalAmount,
      paymentCode,
      qrCodeUrl,
      bankInfo: {
        bankName,
        accountNumber,
        accountName,
      },
    };
  }

  private async formatWithdrawalRequest(req: WalletWithdrawalRequest) {
    let proofUrl: string | null = null;
    if (req.proofFileId) {
      const file = req.proofFile ?? (await this.fileService.findById(req.proofFileId));
      proofUrl = await this.fileService.urlOf(file);
    }
    return {
      ...req,
      proofFileId: req.proofFileId ?? null,
      proofUrl,
    };
  }

  private async formatWithdrawalRequests(requests: WalletWithdrawalRequest[]) {
    const fileIds = requests.map((r) => r.proofFileId).filter((id): id is string => !!id);
    const urlMap = await this.fileService.urlsByIds(fileIds);
    return requests.map((req) => ({
      ...req,
      proofFileId: req.proofFileId ?? null,
      proofUrl: req.proofFileId ? (urlMap.get(req.proofFileId) ?? null) : null,
    }));
  }

  /**
   * Phase 5 — User creates a withdrawal request.
   * Debits the wallet immediately with withdraw_hold (-amount).
   * Enforces 1 open request per user via partial unique index on (user_id) WHERE status IN ('pending', 'processing').
   * Deadline = now + 10 days.
   * Platform wallet may not withdraw.
   */
  async createWithdrawal(userId: string, dto: CreateWithdrawalDto) {
    const wallet = await this.getWalletByUserId(userId);

    const platformWalletId = process.env.PLATFORM_WALLET_ID;
    if (platformWalletId && String(wallet.id) === String(platformWalletId)) {
      throw new AppError('Platform wallet may not create a withdrawal request', 403);
    }

    if (wallet.status !== 'active') {
      throw new AppError('WALLET_LOCKED', 403);
    }

    const amountStr =
      typeof dto.amount === 'number'
        ? (Number.isFinite(dto.amount) ? dto.amount.toFixed(2) : '')
        : String(dto.amount ?? '').trim();
    const amountMinor = toMinor(amountStr);
    if (amountMinor <= 0n) {
      throw new AppError('Withdrawal amount must be strictly positive', 400);
    }
    const canonicalAmount = toDecimal(amountMinor);

    const bankAccountNo = (dto.bank_account_no ?? dto.bankAccountNo)?.trim();
    const bankAccountName = (dto.bank_account_name ?? dto.bankAccountName)?.trim();
    const bankCode = (dto.bank_code ?? dto.bankCode)?.trim();

    if (!bankAccountNo || !bankAccountName || !bankCode) {
      throw new AppError('bankAccountNo, bankAccountName, and bankCode are required', 400);
    }

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const withdrawalRepo = manager.getRepository(WalletWithdrawalRequest);

      const existingOpen = await withdrawalRepo.findOne({
        where: {
          userId,
          status: In(['pending', 'processing']),
        },
      });
      if (existingOpen) {
        throw new AppError('WITHDRAWAL_ALREADY_PENDING', 400);
      }

      const deadlineAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      const withdrawal = withdrawalRepo.create({
        walletId: wallet.id,
        userId,
        amount: canonicalAmount,
        bankAccountNo,
        bankAccountName,
        bankCode,
        status: 'pending',
        deadlineAt,
      });

      let savedReq: WalletWithdrawalRequest;
      try {
        savedReq = await withdrawalRepo.save(withdrawal);
      } catch (err: any) {
        if (err?.code === '23505') {
          throw new AppError('WITHDRAWAL_ALREADY_PENDING', 400);
        }
        throw err;
      }

      await this.walletLedgerService.postEntry(manager, {
        walletId: String(wallet.id),
        type: 'withdraw_hold',
        amount: `-${canonicalAmount}`,
        referenceType: 'withdrawal_request',
        referenceId: String(savedReq.id),
        idempotencyKey: `withdraw_hold:${savedReq.id}`,
      });

      return await this.formatWithdrawalRequest(savedReq);
    });
  }

  /**
   * Phase 5 — User lists their withdrawal requests (cursor-paginated).
   */
  async listUserWithdrawals(userId: string, query: ListWithdrawalsDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const qb = this.dataSource
      .getRepository(WalletWithdrawalRequest)
      .createQueryBuilder('w')
      .where('w.user_id = :userId', { userId });

    if (query.cursor) {
      qb.andWhere('w.id < :cursor', { cursor: query.cursor });
    }

    qb.orderBy('w.id', 'DESC');
    qb.take(limit + 1);

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? String(results[results.length - 1].id) : null;
    const formatted = await this.formatWithdrawalRequests(results);

    return {
      items: formatted,
      nextCursor,
    };
  }

  /**
   * Phase 5 — User cancels a pending withdrawal request.
   * Allowed only while status = 'pending'.
   * Refunds 100% of the hold: withdraw_cancelled (+amount).
   */
  async cancelWithdrawal(userId: string, withdrawalId: string) {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(WalletWithdrawalRequest);
      const req = await repo.findOne({
        where: { id: withdrawalId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!req) {
        throw new AppError('Withdrawal request not found', 404);
      }
      if (String(req.userId) !== String(userId)) {
        throw new AppError('Forbidden: only the owner may cancel', 403);
      }
      if (req.status === 'cancelled') {
        return await this.formatWithdrawalRequest(req); // idempotent replay
      }
      if (req.status !== 'pending') {
        throw new AppError(`Cannot cancel withdrawal with status "${req.status}"`, 400);
      }

      req.status = 'cancelled';
      req.cancelledBy = 'user';
      const saved = await repo.save(req);

      await this.walletLedgerService.postEntry(manager, {
        walletId: String(req.walletId),
        type: 'withdraw_cancelled',
        amount: req.amount,
        referenceType: 'withdrawal_request',
        referenceId: String(req.id),
        idempotencyKey: `withdraw_cancelled:${req.id}`,
      });

      return await this.formatWithdrawalRequest(saved);
    });
  }

  /**
   * Phase 5 — Admin acknowledges processing of a withdrawal request.
   * Status change only — writes no ledger row.
   */
  async processWithdrawal(adminId: string, withdrawalId: string) {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(WalletWithdrawalRequest);
      const req = await repo.findOne({
        where: { id: withdrawalId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!req) {
        throw new AppError('Withdrawal request not found', 404);
      }
      if (req.status === 'processing') {
        return await this.formatWithdrawalRequest(req); // idempotent
      }
      if (req.status !== 'pending') {
        throw new AppError(`Cannot move withdrawal from status "${req.status}" to processing`, 400);
      }

      req.status = 'processing';
      req.adminId = String(adminId);
      req.processedAt = new Date();
      const saved = await repo.save(req);
      return await this.formatWithdrawalRequest(saved);
    });
  }

  /**
   * Phase 5 — Admin confirms bank transfer completion.
   * Closes the book with withdraw_success at 0.00.
   * Requires proof_file_id.
   */
  async completeWithdrawal(adminId: string, withdrawalId: string, dto: CompleteWithdrawalDto) {
    const proofFileId = (dto.proof_file_id ?? dto.proofFileId)?.trim();
    if (!proofFileId) {
      throw new AppError('proof_file_id is required', 400);
    }

    const file = await this.fileService.findById(proofFileId);
    if (!file) {
      throw new AppError('Proof file not found', 400);
    }

    const updated = await this.dataSource.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(WalletWithdrawalRequest);
      const req = await repo.findOne({
        where: { id: withdrawalId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!req) {
        throw new AppError('Withdrawal request not found', 404);
      }
      if (req.status === 'completed') {
        return req; // idempotent replay
      }
      if (req.status !== 'pending' && req.status !== 'processing') {
        throw new AppError(`Cannot complete withdrawal with status "${req.status}"`, 400);
      }

      await this.walletLedgerService.postEntry(manager, {
        walletId: String(req.walletId),
        type: 'withdraw_success',
        amount: '0.00',
        referenceType: 'withdrawal_request',
        referenceId: String(req.id),
        idempotencyKey: `withdraw_success:${req.id}`,
        metadata: {
          admin_id: String(adminId),
          proofFileId: proofFileId,
        },
      });

      req.status = 'completed';
      req.proofFileId = proofFileId;
      req.adminId = String(adminId);
      req.processedAt = new Date();
      return await repo.save(req);
    });

    const proofUrl = await this.fileService.urlOf(file);

    try {
      await createNotification({
        userId: updated.userId,
        type: NotificationType.WITHDRAWAL_COMPLETED,
        title: 'Rút tiền thành công',
        message: `Yêu cầu rút tiền ${updated.amount} VNĐ của bạn đã được chuyển thành công.`,
        metadata: { withdrawalId: updated.id, proofFileId: updated.proofFileId },
      });
    } catch {
      // Non-fatal
    }

    return {
      ...updated,
      proofFileId: updated.proofFileId ?? null,
      proofUrl,
    };
  }

  /**
   * Phase 5 — Admin rejects a withdrawal request.
   * Refunds full hold amount: withdraw_failed (+amount).
   */
  async rejectWithdrawal(adminId: string, withdrawalId: string, dto: RejectWithdrawalDto) {
    const rejectReason =
      (dto.reject_reason ?? dto.rejectReason)?.trim() || 'Yêu cầu rút tiền bị từ chối bởi admin';

    const updated = await this.dataSource.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(WalletWithdrawalRequest);
      const req = await repo.findOne({
        where: { id: withdrawalId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!req) {
        throw new AppError('Withdrawal request not found', 404);
      }
      if (req.status === 'rejected') {
        return req; // idempotent replay
      }
      if (req.status !== 'pending' && req.status !== 'processing') {
        throw new AppError(`Cannot reject withdrawal with status "${req.status}"`, 400);
      }

      await this.walletLedgerService.postEntry(manager, {
        walletId: String(req.walletId),
        type: 'withdraw_failed',
        amount: req.amount,
        referenceType: 'withdrawal_request',
        referenceId: String(req.id),
        idempotencyKey: `withdraw_failed:${req.id}`,
        metadata: {
          admin_id: String(adminId),
          reject_reason: rejectReason,
        },
      });

      req.status = 'rejected';
      req.rejectReason = rejectReason;
      req.adminId = String(adminId);
      req.processedAt = new Date();
      return await repo.save(req);
    });

    try {
      await createNotification({
        userId: updated.userId,
        type: NotificationType.WITHDRAWAL_REJECTED,
        title: 'Yêu cầu rút tiền bị từ chối',
        message: `Yêu cầu rút tiền ${updated.amount} VNĐ của bạn đã bị từ chối: ${rejectReason}`,
        metadata: { withdrawalId: updated.id, rejectReason },
      });
    } catch {
      // Non-fatal
    }

    return await this.formatWithdrawalRequest(updated);
  }

  /**
   * Phase 5 — Admin lists withdrawal requests with filters (status, overdue) and cursor pagination.
   */
  async listAdminWithdrawals(query: AdminListWithdrawalsDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const qb = this.dataSource.getRepository(WalletWithdrawalRequest).createQueryBuilder('w');

    if (query.status) {
      qb.andWhere('w.status = :status', { status: query.status });
    }

    const isOverdue = query.overdue === true || query.overdue === 'true';
    if (isOverdue) {
      qb.andWhere("w.status IN ('pending', 'processing') AND w.deadline_at < NOW()");
    }

    if (query.cursor) {
      qb.andWhere('w.id < :cursor', { cursor: query.cursor });
    }

    if (isOverdue) {
      qb.orderBy('w.deadline_at', 'ASC').addOrderBy('w.id', 'DESC');
    } else {
      qb.orderBy('w.id', 'DESC');
    }

    qb.take(limit + 1);

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? String(results[results.length - 1].id) : null;
    const formatted = await this.formatWithdrawalRequests(results);

    let ledgerMap: Record<string, { selfTopup: string; salesRevenue: string }> = {};

    if (results.length > 0) {
      const walletIds = [...new Set(results.map((r) => r.walletId))];
      const ledgerSums: Array<{ wallet_id: string; type: string; sum: string }> = await this.dataSource
        .getRepository(WalletLedger)
        .createQueryBuilder('l')
        .select('l.wallet_id', 'wallet_id')
        .addSelect('l.type', 'type')
        .addSelect('SUM(l.amount)::text', 'sum')
        .where('l.wallet_id IN (:...walletIds)', { walletIds })
        .andWhere('l.type IN (:...types)', { types: ['topup_success', 'payment_release'] })
        .groupBy('l.wallet_id')
        .addGroupBy('l.type')
        .getRawMany();

      ledgerMap = ledgerSums.reduce((acc, row) => {
        if (!acc[row.wallet_id]) {
          acc[row.wallet_id] = { selfTopup: '0.00', salesRevenue: '0.00' };
        }
        if (row.type === 'topup_success') {
          acc[row.wallet_id].selfTopup = row.sum ?? '0.00';
        } else if (row.type === 'payment_release') {
          acc[row.wallet_id].salesRevenue = row.sum ?? '0.00';
        }
        return acc;
      }, {} as Record<string, { selfTopup: string; salesRevenue: string }>);
    }

    const itemsWithBreakdown = formatted.map((item) => ({
      ...item,
      sourceBreakdown: ledgerMap[item.walletId] ?? {
        selfTopup: '0.00',
        salesRevenue: '0.00',
      },
    }));

    const liabilityResult = await this.dataSource.query(
      'SELECT COALESCE(SUM(balance), 0)::text AS "totalUserLiability" FROM wallets',
    );
    const totalUserLiability: string =
      liabilityResult?.[0]?.totalUserLiability ?? liabilityResult?.[0]?.coalesce ?? '0.00';

    return {
      items: itemsWithBreakdown,
      nextCursor,
      totalUserLiability,
    };
  }

  /**
   * Phase 6 — User transaction history.
   * Cursor-paginated on (wallet_id, created_at, id) — never OFFSET.
   */
  async getUserTransactions(
    userId: string,
    query: { type?: string; from?: string; to?: string; cursor?: string; limit?: number },
  ) {
    const wallet = await this.getWalletByUserId(userId);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

    const qb = this.dataSource
      .getRepository(WalletLedger)
      .createQueryBuilder('l')
      .where('l.wallet_id = :walletId', { walletId: wallet.id });

    if (query.type) {
      qb.andWhere('l.type = :type', { type: query.type });
    }
    if (query.from) {
      qb.andWhere('l.created_at >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('l.created_at <= :to', { to: new Date(query.to) });
    }

    if (query.cursor) {
      let cursorDate: Date | null = null;
      let cursorId: string = query.cursor;
      try {
        const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
        if (decoded.includes('_')) {
          const parts = decoded.split('_');
          cursorDate = new Date(parts[0]);
          cursorId = parts[1];
        }
      } catch {
        // Fallback plain id
      }

      if (cursorDate && !isNaN(cursorDate.getTime())) {
        qb.andWhere(
          '(l.created_at < :cursorDate OR (l.created_at = :cursorDate AND l.id < :cursorId))',
          {
            cursorDate,
            cursorId,
          },
        );
      } else {
        qb.andWhere('l.id < :cursorId', { cursorId });
      }
    }

    qb.orderBy('l.created_at', 'DESC').addOrderBy('l.id', 'DESC');
    qb.take(limit + 1);

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;

    let nextCursor: string | null = null;
    if (hasMore) {
      const last = results[results.length - 1];
      nextCursor = Buffer.from(`${last.createdAt.toISOString()}_${last.id}`).toString('base64');
    }

    return {
      items: results.map((r) => ({
        id: r.id,
        walletId: r.walletId,
        type: r.type,
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        referenceType: r.referenceType,
        referenceId: r.referenceId,
        idempotencyKey: r.idempotencyKey,
        metadata: r.metadata,
        createdAt: r.createdAt,
      })),
      nextCursor,
    };
  }

  /**
   * Phase 6 — User financial summary: SUM(amount) GROUP BY type over the caller's ledger.
   */
  async getUserSummary(userId: string, query: { from?: string; to?: string }) {
    const wallet = await this.getWalletByUserId(userId);
    const qb = this.dataSource
      .getRepository(WalletLedger)
      .createQueryBuilder('l')
      .select('l.type', 'type')
      .addSelect('SUM(l.amount)', 'totalAmount')
      .addSelect('COUNT(l.id)', 'count')
      .where('l.wallet_id = :walletId', { walletId: wallet.id });

    if (query.from) {
      qb.andWhere('l.created_at >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('l.created_at <= :to', { to: new Date(query.to) });
    }

    qb.groupBy('l.type');
    const rows = await qb.getRawMany();

    const byType: Record<string, { totalAmount: string; count: number }> = {};
    for (const row of rows) {
      byType[row.type] = {
        totalAmount: toDecimal(toMinor(row.totalAmount ?? '0.00')),
        count: Number(row.count ?? 0),
      };
    }

    return {
      walletId: wallet.id,
      balance: wallet.balance,
      status: wallet.status,
      byType,
    };
  }

  /**
   * Phase 6 — Admin overview reading from wallet_daily_summary (must not scan full ledger).
   */
  async getAdminOverview(query: { from?: string; to?: string; limit?: number }) {
    const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 365);
    const qb = this.dataSource
      .getRepository(WalletDailySummary)
      .createQueryBuilder('s');

    if (query.from) {
      qb.andWhere('s.summary_date >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('s.summary_date <= :to', { to: query.to });
    }

    qb.orderBy('s.summary_date', 'DESC');
    qb.take(limit);

    const summaries = await qb.getMany();

    let totalTopup = 0n;
    let totalPayment = 0n;
    let totalWithdraw = 0n;
    let totalPlatformFee = 0n;
    let latestActiveWallets = 0;

    if (summaries.length > 0) {
      latestActiveWallets = summaries[0].activeWallets;
      for (const s of summaries) {
        totalTopup += toMinor(s.totalTopup || '0.00');
        totalPayment += toMinor(s.totalPayment || '0.00');
        totalWithdraw += toMinor(s.totalWithdraw || '0.00');
        totalPlatformFee += toMinor(s.totalPlatformFee || '0.00');
      }
    }

    return {
      totals: {
        totalTopup: toDecimal(totalTopup),
        totalPayment: toDecimal(totalPayment),
        totalWithdraw: toDecimal(totalWithdraw),
        totalPlatformFee: toDecimal(totalPlatformFee),
        activeWallets: latestActiveWallets,
      },
      dailySummaries: summaries,
    };
  }

  /**
   * Phase 6 — Admin escrow report.
   * Total held escrow amount and orders ordered by delivered_at ASC NULLS LAST, created_at ASC (4F).
   * Verifies Invariant 3: platform wallet balance >= total held escrow.
   */
  async getAdminEscrow(query: { cursor?: string; limit?: number }) {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

    const stats = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'totalEscrow')
      .addSelect('COUNT(o.id)', 'count')
      .where('o.fund_status = :status', { status: 'held' })
      .getRawOne();

    const totalEscrowMinor = toMinor(stats?.totalEscrow ?? '0.00');
    const totalEscrow = toDecimal(totalEscrowMinor);
    const heldOrderCount = Number(stats?.count ?? 0);

    const platformWalletId = process.env.PLATFORM_WALLET_ID;
    let platformBalance = '0.00';
    if (platformWalletId) {
      const platformWallet = await this.walletRepository.findOne({
        where: { id: platformWalletId },
      });
      if (platformWallet) {
        platformBalance = platformWallet.balance;
      }
    }

    const platformBalanceMinor = toMinor(platformBalance);
    const isEscrowCovered = platformBalanceMinor >= totalEscrowMinor;

    const qb = this.dataSource
      .getRepository(Order)
      .createQueryBuilder('o')
      .where('o.fund_status = :status', { status: 'held' });

    if (query.cursor) {
      qb.andWhere('o.id > :cursor', { cursor: query.cursor });
    }

    qb.orderBy('o.delivered_at', 'ASC', 'NULLS LAST')
      .addOrderBy('o.created_at', 'ASC')
      .addOrderBy('o.id', 'ASC');

    qb.take(limit + 1);

    const orders = await qb.getMany();
    const hasMore = orders.length > limit;
    const results = hasMore ? orders.slice(0, limit) : orders;
    const nextCursor = hasMore ? String(results[results.length - 1].id) : null;

    return {
      totalEscrow,
      heldOrderCount,
      platformWalletBalance: platformBalance,
      isEscrowCovered,
      orders: results,
      nextCursor,
    };
  }

  /**
   * Admin manual reconciliation valve (§0.1d).
   * Credits or debits an existing wallet using double-entry ledger type 'adjustment'.
   * Mandatory: reason and bank_reference in metadata, acting admin_id.
   * Cannot push a wallet balance negative (enforced by the ledger engine).
   */
  async adjustBalance(adminId: string, params: WalletAdjustmentParams) {
    const bankRef = (params.bank_reference ?? params.bankTransactionId ?? params.bankReference)?.trim();
    if (!bankRef) {
      throw new AppError('bank_reference (bank transaction ID) is required in metadata', 400);
    }

    const reason = params.reason?.trim();
    if (!reason) {
      throw new AppError('reason is required in metadata', 400);
    }

    const amountStr = typeof params.amount === 'number' ? params.amount.toFixed(2) : String(params.amount).trim();
    const amountMinor = toMinor(amountStr);
    if (amountMinor === 0n) {
      throw new AppError('Adjustment amount cannot be zero', 400);
    }
    const canonicalAmount = toDecimal(amountMinor);

    const adjustmentId = crypto.randomUUID();
    const idempotencyKey = `adjustment:${adjustmentId}`;

    const metadata = {
      reason,
      bank_reference: bankRef,
      admin_id: String(adminId),
    };

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      return await this.walletLedgerService.postEntry(manager, {
        walletId: String(params.walletId),
        type: 'adjustment',
        amount: canonicalAmount,
        referenceType: 'wallet_adjustment',
        referenceId: adjustmentId,
        idempotencyKey,
        metadata,
      });
    });
  }
}
