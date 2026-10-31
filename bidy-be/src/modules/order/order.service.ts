import { DataSource, EntityManager, Repository, In } from 'typeorm';
import crypto from 'crypto';
import { Order } from './entity/order.entity.js';
import { Transaction } from './entity/transaction.entity.js';
import { OrderStatus } from './enum/order-status.enum.js';
import { Wallet } from '../wallet/entity/wallet.entity.js';
import { walletConfig } from '../../config/wallet.config.js';
import VNTimeUtils from '../../common/util/vnTimezone.js';
import { sepayConfig } from '../../config/sepay.config.js';
import { logger } from '../../common/util/logger.js';
import webSocketService from '../common/websocket.service.js';
import { buildSepayQrUrl } from '../../common/util/sepay-qr.util.js';
import { WalletLedgerService, toMinor, toDecimal } from '../wallet/wallet-ledger.service.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { notificationService } from '../notification/notification.service.js';
import { NotificationType } from '../notification/enum/notification-type.enum.js';
import { NotificationCategory } from '../notification/enum/notification-category.enum.js';
import { NotificationPriority } from '../notification/enum/notification-priority.enum.js';
import { fileService } from '../file/file.provider.js';
import { AppDataSource } from '../../database/data-source.js';

const PAYMENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export class OrderService {
  private readonly walletRepo?: Repository<Wallet>;
  private readonly transactionRepo?: Repository<Transaction>;

  constructor(
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly walletLedgerService: WalletLedgerService = new WalletLedgerService(),
    walletRepo?: Repository<Wallet>,
    transactionRepo?: Repository<Transaction>,
  ) {
    if (walletRepo) {
      this.walletRepo = walletRepo;
    } else if (dataSource && typeof (dataSource as any).getRepository === 'function') {
      try {
        this.walletRepo = dataSource.getRepository(Wallet);
      } catch {
        this.walletRepo = undefined;
      }
    } else {
      try {
        this.walletRepo = AppDataSource.getRepository(Wallet);
      } catch {
        this.walletRepo = undefined;
      }
    }

    if (transactionRepo) {
      this.transactionRepo = transactionRepo;
    } else if (dataSource && typeof (dataSource as any).getRepository === 'function') {
      try {
        this.transactionRepo = dataSource.getRepository(Transaction);
      } catch {
        this.transactionRepo = undefined;
      }
    } else {
      try {
        this.transactionRepo = AppDataSource.getRepository(Transaction);
      } catch {
        this.transactionRepo = undefined;
      }
    }
  }

  /**
   * The one place an order's buyer wallet is resolved. A missing wallet is a hard
   * failure, never a wallet created on the spot: Phase 1 creates one inside the
   * registration transaction and backfilled every existing user, so absence here means
   * the data is broken and must surface, not be papered over inside a money path.
   */
  private async resolveBuyerWallet(manager: EntityManager, userId: string): Promise<Wallet> {
    const wallet = await manager.findOne(Wallet, { where: { userId } });
    if (!wallet) {
      throw new AppError('BUYER_WALLET_NOT_FOUND', 404);
    }
    return wallet;
  }

  private deadlineOf(order: Order): Date {
    if (order.payment_deadline) return new Date(order.payment_deadline);
    const wonDate = order.created_at ?? new Date();
    return new Date(wonDate.getTime() + PAYMENT_WINDOW_MS);
  }

  async getWonAuctions(userId: string) {
    const orders = await this.orderRepo.find({
      where: { buyer_id: userId },
      relations: { auction: { product: { category: true, images: { file: true } } } },
      order: { created_at: 'DESC' },
    });

    const primaryFiles = orders.map((order) => {
      const images = order.auction?.product?.images;
      const primaryImage = images?.find((img) => img.isPrimary) ?? images?.[0];
      return primaryImage?.file ?? null;
    });

    const imageUrls = await fileService.urlsOf(primaryFiles);

    const now = VNTimeUtils.getCurrentVNTime().toDate();

    const ordersWithDetails = orders.map((order, index) => {
      const wonDate = order.created_at ?? new Date();
      const paymentDeadline = this.deadlineOf(order);
      const diff = paymentDeadline.getTime() - now.getTime();
      const hoursRemaining = diff / (1000 * 60 * 60);

      return {
        id: order.id,
        buyerId: order.buyer_id,
        sellerId: order.seller_id,
        auctionId: order.auction_id,
        shippingAddressId: order.shipping_address_id,
        price: order.final_price || 0,
        shippingFee: order.shipping_fee,
        totalAmount: order.total_amount,
        paymentStatus: order.payment_status,
        shippingStatus: order.shipping_status,
        trackingNumber: order.tracking_number,
        paymentDeadline,
        fundStatus: order.fund_status ?? 'none',
        platformFee: order.platform_fee,
        sellerPayout: order.seller_payout,
        feeRate: order.fee_rate,
        paymentChannel: order.payment_channel,
        deliveredAt: order.delivered_at,
        releasedAt: order.released_at,
        releasedBy: order.released_by,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        wonDate,
        daysRemaining: Math.ceil(diff / (1000 * 60 * 60 * 24)),
        isOverdue: order.payment_status !== OrderStatus.PAID && now > paymentDeadline,
        isUrgent: hoursRemaining < 24 && hoursRemaining > 0,
        bidId: order.auction ? {
          id: order.auction.id,
          name: order.auction.product?.name,
          price: order.auction.currentPrice,
          description: order.auction.product?.description,
          image: imageUrls[index] ?? null,
        } : null,
      };
    });

    return {
      orders: ordersWithDetails,
      summary: {
        total: ordersWithDetails.length,
        pending: ordersWithDetails.filter(o => o.paymentStatus === OrderStatus.PENDING && !o.isOverdue).length,
        paid: ordersWithDetails.filter(o => o.paymentStatus === OrderStatus.PAID).length,
        overdue: ordersWithDetails.filter(o => o.isOverdue).length,
      },
    };
  }

  async getPaymentStatus(userId: string) {
    const pendingOrders = await this.orderRepo.find({
      where: { buyer_id: userId, payment_status: OrderStatus.PENDING },
      order: { payment_deadline: 'ASC' },
    });

    const now = VNTimeUtils.getCurrentVNTime().toDate();

    const overdueOrders = pendingOrders.filter(order => now > this.deadlineOf(order));
    const urgentOrders = pendingOrders.filter(order => {
      const diffHours = (this.deadlineOf(order).getTime() - now.getTime()) / (1000 * 60 * 60);
      return diffHours < 24 && diffHours > 0;
    });

    let warningLevel = 'none';
    if (overdueOrders.length > 0) warningLevel = 'high';
    else if (urgentOrders.length > 0) warningLevel = 'medium';
    else if (pendingOrders.length > 0) warningLevel = 'low';

    return {
      hasOverduePayments: overdueOrders.length > 0,
      overdueCount: overdueOrders.length,
      pendingCount: pendingOrders.length,
      urgentCount: urgentOrders.length,
      nearestDeadline: pendingOrders.length > 0 ? this.deadlineOf(pendingOrders[0]) : null,
      accountStatus: 'active',
      warningLevel,
    };
  }

  /**
   * Moves a batch of orders into PROCESSING under one transaction.
   *
   * The orders are locked before the status check so two concurrent checkouts
   * cannot both claim the same order; without the lock the read-then-write
   * would let a second request pass the PENDING check on stale rows and
   * double-charge the buyer.
   */
  async processPayment(userId: string, orderIds: string[], paymentMethod: string) {
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      throw new Error('INVALID_ORDER_IDS');
    }

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const orders = await manager.find(Order, {
        where: {
          id: In(orderIds),
          buyer_id: userId,
          payment_status: OrderStatus.PENDING,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (orders.length !== orderIds.length) {
        throw new Error('INVALID_OR_ALREADY_PAID_ORDERS');
      }

      const groupId = crypto.randomBytes(16).toString('hex');
      const now = VNTimeUtils.getCurrentVNTime().toDate();
      let totalAmount = 0;

      for (const order of orders) {
        const amount = Number(order.final_price || 0);
        totalAmount += amount;

        await manager.save(Transaction, manager.create(Transaction, {
          userId,
          orderId: order.id,
          amount,
          paymentMethod,
          transactionDate: now,
          transactionStatus: OrderStatus.PROCESSING,
          providerTransactionId: groupId,
        }));

        order.payment_status = OrderStatus.PROCESSING;
        await manager.save(Order, order);
      }

      return {
        transactionId: groupId,
        totalAmount,
        orders: orderIds,
        message: 'Thanh toán đang được xử lý. Vui lòng chờ xác nhận.',
      };
    });
  }

  /** Marks a payment group and its orders PAID. Atomic so an order can never be paid without its transaction row. */
  async confirmPayment(userId: string, paymentId: string) {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const transactions = await manager.find(Transaction, {
        where: {
          providerTransactionId: paymentId,
          userId,
          transactionStatus: OrderStatus.PROCESSING,
        },
        relations: { order: true },
      });

      if (transactions.length === 0) {
        throw new Error('TRANSACTION_NOT_FOUND');
      }

      for (const transaction of transactions) {
        transaction.transactionStatus = OrderStatus.PAID;
        await manager.save(Transaction, transaction);

        if (transaction.order) {
          transaction.order.payment_status = OrderStatus.PAID;
          await manager.save(Order, transaction.order);
        }
      }

      return {
        paymentId,
        paidOrders: transactions.length,
      };
    });
  }

  /**
   * Generates SePay VietQR payment info and code for an order.
   */
  async getOrderPaymentQr(userId: string, orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: { auction: { product: true } },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    if (order.buyer_id !== userId) {
      throw new Error('FORBIDDEN');
    }

    if (order.payment_status === OrderStatus.PAID) {
      throw new Error('ORDER_ALREADY_PAID');
    }

    const amount = Math.max(0, Math.round(Number(order.total_amount ?? order.final_price ?? 0)));
    const paymentPrefix = sepayConfig.paymentPrefix || 'BIDY';
    // Pad order ID to at least 3 digits (e.g., BIDY001, BIDY015, BIDY1024) to satisfy SePay suffix rules
    const paddedOrderId = String(order.id).padStart(3, '0');
    const paymentCode = `${paymentPrefix}${paddedOrderId}`;

    const { bankName, accountNumber, accountName } = sepayConfig;
    const qrCodeUrl = buildSepayQrUrl({
      accountNumber,
      bankName,
      amount,
      des: paymentCode,
    });

    if (this.transactionRepo && this.walletRepo) {
      try {
        const buyerWallet = await this.walletRepo.findOne({ where: { userId } });

        const existingTx = await this.transactionRepo.findOne({
          where: { orderId: order.id, transactionStatus: 'pending' },
        });
        if (!existingTx && this.transactionRepo.create && this.transactionRepo.save) {
          await this.transactionRepo.save(
            this.transactionRepo.create({
              userId,
              walletId: buyerWallet?.id ?? null,
              orderId: order.id,
              amount: amount as any,
              paymentMethod: 'sepay',
              transactionStatus: 'pending',
              transactionDate: new Date(),
            }),
          );
        }
      } catch (err) {
        logger.warn('[OrderService] Non-critical error recording pending QR transaction:', err);
      }
    }

    return {
      orderId: order.id,
      amount,
      paymentCode,
      qrCodeUrl,
      bankInfo: {
        bankName,
        accountNumber,
        accountName,
      },
      paymentDeadline: this.deadlineOf(order),
      paymentStatus: order.payment_status,
    };
  }

  /**
   * Retrieves the current payment and fulfillment status for a specific order.
   * Useful for fallback polling or manual user status verification.
   */
  async getOrderStatus(userId: string, orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    if (order.buyer_id !== userId && order.seller_id !== userId) {
      throw new Error('FORBIDDEN');
    }

    return {
      orderId: order.id,
      paymentStatus: order.payment_status,
      shippingStatus: order.shipping_status,
      totalAmount: Number(order.total_amount ?? order.final_price ?? 0),
      paymentDeadline: this.deadlineOf(order),
      isPaid: order.payment_status === OrderStatus.PAID,
      fundStatus: order.fund_status ?? 'none',
      deliveredAt: order.delivered_at ?? null,
      fund_status: order.fund_status ?? 'none',
      delivered_at: order.delivered_at ?? null,
    };
  }

  /**
   * Processes an incoming SePay webhook payload.
   * Atomically verifies payment, guards against duplicates, routes to either
   * wallet top-up or order payment depending on transfer note prefix, and notifies via WebSocket.
   */
  async processSepayWebhook(payload: any) {
    if (!payload || payload.transferType !== 'in') {
      logger.info('[SePay Webhook] Ignored non-incoming or empty transfer', { transferType: payload?.transferType });
      return { success: true, message: 'Ignored non-incoming transfer' };
    }

    const sepayId = String(payload.id ?? '');
    if (!sepayId) {
      logger.warn('[SePay Webhook] Missing SePay transaction ID');
      return { success: false, message: 'Missing transaction id' };
    }

    let transferAmountMinor: bigint;
    let transferAmountStr: string;
    try {
      const raw = typeof payload.transferAmount === 'number'
        ? (Number.isFinite(payload.transferAmount) ? payload.transferAmount.toFixed(2) : '')
        : typeof payload.transferAmount === 'string'
        ? payload.transferAmount.trim()
        : '';
      transferAmountMinor = toMinor(raw);
      if (transferAmountMinor <= 0n) {
        throw new Error('Transfer amount must be strictly positive');
      }
      transferAmountStr = toDecimal(transferAmountMinor);
    } catch (err: any) {
      logger.warn('[SePay Webhook] Invalid transfer amount in payload', {
        transferAmount: payload?.transferAmount,
        error: err?.message,
      });
      return { success: false, message: 'Invalid transfer amount' };
    }

    const paymentPrefix = sepayConfig.paymentPrefix || 'BIDY';

    // Scan payload.code, payload.content, payload.description
    const searchString = [payload.code, payload.content, payload.description]
      .filter(Boolean)
      .map((s) => String(s).trim())
      .join(' ');

    const topupMatch = searchString.match(new RegExp(`${paymentPrefix}TOPUP(\\d{3,10})`, 'i'));
    const orderMatch = !topupMatch ? searchString.match(new RegExp(`${paymentPrefix}(\\d{3,10})`, 'i')) : null;

    if (!topupMatch && !orderMatch) {
      logger.warn('[SePay Webhook] Unparseable transfer note: no matching top-up or order code found in payload', {
        code: payload.code,
        content: payload.content,
        description: payload.description,
        sepayId,
      });
      return { success: true, message: 'Unparseable transfer note logged for manual handling' };
    }

    // Branch A: Wallet Top-Up Flow (Phase 3)
    if (topupMatch) {
      const rawTxDigits = topupMatch[1];
      const txId = String(parseInt(rawTxDigits, 10));

      if (isNaN(Number(txId))) {
        logger.warn(`[SePay Webhook] Invalid top-up transaction ID parsed: ${rawTxDigits}`);
        return { success: true, message: 'Invalid top-up code format' };
      }

      return await this.dataSource.transaction(async (manager: EntityManager) => {
        const existingTx = await manager.findOne(Transaction, {
          where: { providerTransactionId: sepayId },
        });

        if (existingTx) {
          logger.info(`[SePay Webhook] Duplicate transaction ${sepayId} already processed for tx ${existingTx.id}`);
          return { success: true, message: 'Transaction already processed', transactionId: existingTx.id };
        }

        const transaction = await manager.findOne(Transaction, {
          where: { id: txId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!transaction) {
          logger.warn(`[SePay Webhook] Top-up transaction ${txId} not found in database`);
          return { success: true, message: 'Top-up transaction not found' };
        }

        if (!transaction.walletId) {
          logger.warn(`[SePay Webhook] Top-up transaction ${txId} has no associated walletId`);
          return { success: true, message: 'Top-up transaction has no wallet' };
        }

        if (transaction.transactionStatus === 'success') {
          logger.info(`[SePay Webhook] Top-up transaction ${txId} is already successful`);
          return { success: true, message: 'Top-up transaction already processed', transactionId: transaction.id };
        }

        await this.walletLedgerService.postEntry(manager, {
          walletId: String(transaction.walletId),
          type: 'topup_success',
          amount: transferAmountStr,
          referenceType: 'sepay_webhook',
          referenceId: sepayId,
          idempotencyKey: `sepay:${sepayId}`,
          metadata: {
            sepay_id: sepayId,
            transaction_id: transaction.id,
            user_id: transaction.userId,
          },
        });

        transaction.transactionStatus = 'success';
        transaction.providerTransactionId = sepayId;
        transaction.amount = transferAmountStr as any;
        await manager.save(Transaction, transaction);

        try {
          await notificationService.createNotification({
            recipient: String(transaction.userId),
            type: NotificationType.TOPUP_SUCCESS,
            title: 'Nạp tiền thành công',
            message: `Đã cộng ${transferAmountStr} VNĐ vào ví của bạn.`,
            category: NotificationCategory.ACCOUNT,
            priority: NotificationPriority.NORMAL,
            relatedData: {
              transactionId: transaction.id,
              amount: transferAmountStr,
            },
          });
        } catch (notifErr) {
          logger.error('[SePay Webhook] Failed to send top-up notification:', notifErr);
        }

        try {
          if (webSocketService?.io) {
            webSocketService.io.to(`user_${transaction.userId}`).emit('wallet:topup_success', {
              transactionId: transaction.id,
              walletId: transaction.walletId,
              amount: transferAmountStr,
            });
          }
        } catch (wsErr) {
          logger.error('[SePay Webhook] Failed to emit top-up WebSocket notification:', wsErr);
        }

        logger.info(`[SePay Webhook] Successfully processed top-up for wallet ${transaction.walletId}, amount: ${transferAmountStr}`);
        return {
          success: true,
          message: 'Top-up confirmed successfully',
          walletId: transaction.walletId,
          transactionId: transaction.id,
        };
      });
    }

    // Branch B: Order Payment Flow — QR Pass-Through (Phase 4D / 4E)
    const rawDigits = orderMatch![1];
    const orderId = String(parseInt(rawDigits, 10));

    if (isNaN(Number(orderId))) {
      logger.warn(`[SePay Webhook] Invalid order ID parsed: ${rawDigits}`);
      return { success: true, message: 'Invalid order code format' };
    }

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const existingTx = await manager.findOne(Transaction, {
        where: { providerTransactionId: sepayId },
      });

      if (existingTx) {
        logger.info(`[SePay Webhook] Duplicate transaction ${sepayId} already processed for order ${existingTx.orderId}`);
        return { success: true, message: 'Transaction already processed', orderId: existingTx.orderId };
      }

      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        logger.warn(`[SePay Webhook] Order ${orderId} not found in database`);
        return { success: true, message: 'Order not found' };
      }

      if (order.payment_status === OrderStatus.PAID) {
        logger.info(`[SePay Webhook] Order ${orderId} is already paid`);
        return { success: true, message: 'Order is already paid', orderId };
      }

      const buyerWallet = await this.resolveBuyerWallet(manager, order.buyer_id);
      const buyerWalletId = String(buyerWallet.id);
      const requiredAmountMinor = toMinor(String(order.total_amount ?? order.final_price ?? '0'));
      const requiredAmountStr = toDecimal(requiredAmountMinor);

      // Phase 4E: Underpaid (transferAmount < total_amount)
      // Credit topup_success +transferAmount into buyer's wallet,
      // leave order unpaid with fund_status='none', and notify buyer to make up difference.
      if (transferAmountMinor < requiredAmountMinor) {
        logger.warn(`[SePay Webhook] Insufficient payment for order ${orderId}: received ${transferAmountStr}, required ${requiredAmountStr}`);

        if (this.walletLedgerService && typeof this.walletLedgerService.postEntry === 'function') {
          await this.walletLedgerService.postEntry(manager, {
            walletId: buyerWalletId,
            type: 'topup_success',
            amount: transferAmountStr,
            referenceType: 'sepay_webhook',
            referenceId: sepayId,
            idempotencyKey: `sepay:${sepayId}`,
            metadata: {
              sepay_id: sepayId,
              order_id: order.id,
              user_id: order.buyer_id,
              shortfall: toDecimal(requiredAmountMinor - transferAmountMinor),
            },
          });
        }

        order.fund_status = 'none';
        await manager.save(Order, order);

        await manager.save(Transaction, manager.create(Transaction, {
          userId: order.buyer_id,
          orderId: order.id,
          walletId: buyerWallet?.id ?? null,
          amount: payload.transferAmount,
          paymentMethod: 'sepay',
          transactionDate: new Date(),
          transactionStatus: 'success',
          providerTransactionId: sepayId,
        }));

        try {
          await notificationService.createNotification({
            recipient: String(order.buyer_id),
            type: NotificationType.TOPUP_SUCCESS,
            title: 'Thanh toán đơn hàng chưa đủ',
            message: `Đã cộng ${transferAmountStr} VNĐ vào ví của bạn. Đơn hàng #${order.id} còn thiếu ${toDecimal(requiredAmountMinor - transferAmountMinor)} VNĐ. Vui lòng thanh toán phần còn lại bằng số dư ví.`,
            category: NotificationCategory.ORDER,
            priority: NotificationPriority.HIGH,
            relatedData: {
              orderId: String(order.id),
              received: transferAmountStr,
              required: requiredAmountStr,
              shortfall: toDecimal(requiredAmountMinor - transferAmountMinor),
            },
          });
        } catch (notifErr) {
          logger.error('[SePay Webhook] Failed to send underpaid notification:', notifErr);
        }

        try {
          if (webSocketService?.io) {
            webSocketService.io.to(`user_${order.buyer_id}`).emit('wallet:topup_success', {
              walletId: buyerWalletId,
              amount: transferAmountStr,
              orderId: order.id,
            });
          }
        } catch (wsErr) {
          logger.error('[SePay Webhook] Failed to emit WebSocket notification for underpaid QR:', wsErr);
        }

        return {
          success: true,
          message: 'Underpaid order credited to wallet',
          orderId: order.id,
          paid: false,
          received: transferAmountStr,
          required: requiredAmountStr,
        };
      }

      // Phase 4D / 4E: Exact or Overpaid (transferAmount >= total_amount)
      // Pass-through: Credit full transferAmount to buyer wallet,
      // deduct total_amount for order, escrow total_amount to platform wallet.
      // Any surplus naturally remains in buyer wallet.
      const negativeTotal = toDecimal(-requiredAmountMinor);
      const platformWalletId = walletConfig.platformWalletId;

      if (this.walletLedgerService && typeof this.walletLedgerService.postTransfer === 'function') {
        await this.walletLedgerService.postTransfer(manager, [
          {
            walletId: buyerWalletId,
            type: 'topup_success',
            amount: transferAmountStr,
            referenceType: 'sepay_webhook',
            referenceId: sepayId,
            idempotencyKey: `sepay:${sepayId}`,
          },
          {
            walletId: buyerWalletId,
            type: 'payment',
            amount: negativeTotal,
            referenceType: 'order',
            referenceId: String(order.id),
            idempotencyKey: `order_payment:${order.id}`,
          },
          {
            walletId: platformWalletId,
            type: 'payment_escrow_in',
            amount: requiredAmountStr,
            referenceType: 'order',
            referenceId: String(order.id),
            idempotencyKey: `order_escrow_in:${order.id}`,
          },
        ]);
      }

      order.payment_status = OrderStatus.PAID;
      order.fund_status = 'held';
      order.payment_channel = 'qr_direct';
      await manager.save(Order, order);

      await manager.save(Transaction, manager.create(Transaction, {
        userId: order.buyer_id,
        orderId: order.id,
        walletId: buyerWallet?.id ?? null,
        amount: payload.transferAmount,
        paymentMethod: 'sepay',
        transactionDate: new Date(),
        transactionStatus: OrderStatus.PAID,
        providerTransactionId: sepayId,
      }));

      try {
        if (webSocketService?.io) {
          webSocketService.io.to([`user_${order.buyer_id}`, `order_${order.id}`]).emit('order:paid', {
            orderId: order.id,
            amount: payload.transferAmount,
            paymentCode: `${paymentPrefix}${rawDigits}`,
            status: OrderStatus.PAID,
          });
        }
      } catch (wsErr) {
        logger.error('[SePay Webhook] Failed to emit WebSocket notification:', wsErr);
      }

      logger.info(`[SePay Webhook] Successfully processed payment for order ${order.id}, amount: ${transferAmountStr}`);
      return { success: true, message: 'Payment confirmed successfully', orderId: order.id };
    });
  }

  /**
   * Phase 4A: Buyer pays from wallet balance.
   */
  async payWithWallet(userId: string, orderId: string) {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new AppError('ORDER_NOT_FOUND', 404);
      }

      if (String(order.buyer_id) !== String(userId)) {
        throw new AppError('FORBIDDEN', 403);
      }

      if (order.payment_status !== OrderStatus.PENDING) {
        throw new AppError('ORDER_NOT_PAYABLE', 400);
      }

      const now = VNTimeUtils.getCurrentVNTime().toDate();
      const deadline = this.deadlineOf(order);
      if (now > deadline) {
        throw new AppError('ORDER_PAYMENT_DEADLINE_EXPIRED', 400);
      }

      const buyerWallet = await this.resolveBuyerWallet(manager, order.buyer_id);

      const totalAmount = toDecimal(toMinor(String(order.total_amount ?? order.final_price ?? '0')));
      const negativeTotal = toDecimal(-toMinor(totalAmount));
      const platformWalletId = walletConfig.platformWalletId;

      await this.walletLedgerService.postTransfer(manager, [
        {
          walletId: String(buyerWallet.id),
          type: 'payment',
          amount: negativeTotal,
          referenceType: 'order',
          referenceId: String(order.id),
          idempotencyKey: `order_payment:${order.id}`,
        },
        {
          walletId: platformWalletId,
          type: 'payment_escrow_in',
          amount: totalAmount,
          referenceType: 'order',
          referenceId: String(order.id),
          idempotencyKey: `order_escrow_in:${order.id}`,
        },
      ]);

      order.payment_status = OrderStatus.PAID;
      order.fund_status = 'held';
      order.payment_channel = 'wallet';
      await manager.save(Order, order);

      try {
        if (webSocketService?.io) {
          webSocketService.io.to([`user_${order.buyer_id}`, `order_${order.id}`]).emit('order:paid', {
            orderId: order.id,
            amount: totalAmount,
            status: OrderStatus.PAID,
          });
        }
      } catch (wsErr) {
        logger.error('[OrderService] Failed to emit WebSocket notification for wallet payment:', wsErr);
      }

      return {
        orderId: order.id,
        paymentStatus: order.payment_status,
        fundStatus: order.fund_status,
        paymentChannel: order.payment_channel,
        totalAmount,
      };
    });
  }

  /**
   * Phase 4B: Admin releases escrow to seller.
   */
  async releaseEscrow(adminId: string, orderId: string) {
    let releasedOrder: Order;
    let releasedFee: string;
    let releasedPayout: string;
    let releasedTotal: string;

    await this.dataSource.transaction(async (manager: EntityManager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new AppError('ORDER_NOT_FOUND', 404);
      }

      if (order.fund_status !== 'held') {
        throw new AppError("Order fund status must be 'held' to release", 400);
      }

      const finalPriceMinor = toMinor(String(order.final_price));
      const shippingFeeMinor = toMinor(String(order.shipping_fee ?? '0'));
      const platformFee = platformFeeOf(String(order.final_price));
      const feeMinor = toMinor(platformFee);

      const payoutMinor = finalPriceMinor + shippingFeeMinor - feeMinor;
      const sellerPayout = toDecimal(payoutMinor);

      const totalMinor = finalPriceMinor + shippingFeeMinor;
      const totalAmount = toDecimal(totalMinor);
      const negativeTotal = toDecimal(-totalMinor);

      const sellerWallet = await manager.findOne(Wallet, {
        where: { userId: order.seller_id },
      });

      if (!sellerWallet) {
        throw new AppError('SELLER_WALLET_NOT_FOUND', 404);
      }

      const platformWalletId = walletConfig.platformWalletId;

      await this.walletLedgerService.postTransfer(manager, [
        {
          walletId: platformWalletId,
          type: 'payment_escrow_out',
          amount: negativeTotal,
          referenceType: 'order',
          referenceId: String(order.id),
          idempotencyKey: `order_escrow_out:${order.id}`,
          metadata: { admin_id: adminId },
        },
        {
          walletId: String(sellerWallet.id),
          type: 'payment_release',
          amount: sellerPayout,
          referenceType: 'order',
          referenceId: String(order.id),
          idempotencyKey: `payment_release:${order.id}`,
          metadata: { admin_id: adminId },
        },
        {
          walletId: platformWalletId,
          type: 'platform_fee',
          amount: platformFee,
          referenceType: 'order',
          referenceId: String(order.id),
          idempotencyKey: `platform_fee:${order.id}`,
          metadata: { admin_id: adminId, fee_rate: '0.0500' },
        },
      ]);

      order.fund_status = 'released';
      order.platform_fee = platformFee as any;
      order.seller_payout = sellerPayout as any;
      order.fee_rate = '0.0500' as any;
      order.released_at = new Date();
      order.released_by = adminId;
      await manager.save(Order, order);

      releasedOrder = order;
      releasedFee = platformFee;
      releasedPayout = sellerPayout;
      releasedTotal = totalAmount;
    });

    try {
      await notificationService.createNotification({
        recipient: String(releasedOrder!.seller_id),
        actor: String(adminId),
        type: NotificationType.PAYMENT_RELEASED,
        title: 'Thanh toán đơn hàng đã được giải ngân',
        message: `Khoản thanh toán ${releasedPayout!} VNĐ cho đơn hàng #${releasedOrder!.id} đã được chuyển vào ví của bạn.`,
        category: NotificationCategory.ORDER,
        priority: NotificationPriority.HIGH,
        relatedData: {
          orderId: String(releasedOrder!.id),
          sellerPayout: releasedPayout!,
          platformFee: releasedFee!,
          totalAmount: releasedTotal!,
        },
      });
    } catch (notifErr) {
      logger.error('[OrderService] Failed to send PAYMENT_RELEASED notification:', notifErr);
    }

    try {
      if (webSocketService?.io) {
        webSocketService.io.to(`user_${releasedOrder!.seller_id}`).emit('payment:released', {
          orderId: releasedOrder!.id,
          sellerPayout: releasedPayout!,
          platformFee: releasedFee!,
        });
      }
    } catch (wsErr) {
      logger.error('[OrderService] Failed to emit WebSocket notification for payment release:', wsErr);
    }

    return {
      orderId: releasedOrder!.id,
      fundStatus: releasedOrder!.fund_status,
      platformFee: releasedFee!,
      sellerPayout: releasedPayout!,
      feeRate: '0.0500',
      releasedAt: releasedOrder!.released_at,
      releasedBy: releasedOrder!.released_by,
    };
  }

  /**
   * Phase 4F: Update shipping status. Sets delivered_at = now() when shipping_status becomes 'delivered'.
   */
  async updateShippingStatus(orderId: string, shippingStatus: string, trackingNumber?: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND', 404);
    }
    order.shipping_status = shippingStatus;
    if (trackingNumber !== undefined) {
      order.tracking_number = trackingNumber;
    }
    if (shippingStatus === 'delivered' && !order.delivered_at) {
      order.delivered_at = new Date();
    }
    return await this.orderRepo.save(order);
  }

  /**
   * Phase 4C / 4F: Shared escrow refund logic.
   * If fund_status === 'held', posts payment_escrow_out and payment_refund in a single transfer.
   * Sets fund_status = 'refunded'.
   */
  async refundOrderEscrow(
    manager: EntityManager,
    order: Order,
    actorId: string = 'system',
  ): Promise<{ totalAmount: string }> {
    if (order.fund_status !== 'held') {
      throw new AppError("Order fund status must be 'held' to refund", 400);
    }

    const totalAmountMinor = toMinor(String(order.total_amount ?? order.final_price ?? '0'));
    const totalAmount = toDecimal(totalAmountMinor);
    const negativeTotal = toDecimal(-totalAmountMinor);

    const buyerWallet = await this.resolveBuyerWallet(manager, order.buyer_id);

    const platformWalletId = walletConfig.platformWalletId;

    if (this.walletLedgerService && typeof this.walletLedgerService.postTransfer === 'function') {
      await this.walletLedgerService.postTransfer(manager, [
        {
          walletId: platformWalletId,
          type: 'payment_escrow_out',
          amount: negativeTotal,
          referenceType: 'order',
          referenceId: String(order.id),
          idempotencyKey: `order_escrow_out:${order.id}`,
          metadata: { admin_id: actorId },
        },
        {
          walletId: String(buyerWallet.id),
          type: 'payment_refund',
          amount: totalAmount,
          referenceType: 'order',
          referenceId: String(order.id),
          idempotencyKey: `order_refund:${order.id}`,
          metadata: { admin_id: actorId },
        },
      ]);
    }

    order.fund_status = 'refunded';
    return { totalAmount };
  }

  /**
   * Phase 4C: Admin refunds escrow payment to buyer.
   */
  async refundOrder(adminId: string, orderId: string) {
    let refundedOrder: Order;
    let refundedTotal: string;

    await this.dataSource.transaction(async (manager: EntityManager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new AppError('ORDER_NOT_FOUND', 404);
      }

      const { totalAmount } = await this.refundOrderEscrow(manager, order, adminId);

      order.payment_status = 'refunded';
      await manager.save(Order, order);

      refundedOrder = order;
      refundedTotal = totalAmount;
    });

    try {
      if (webSocketService?.io) {
        webSocketService.io.to([`user_${refundedOrder!.buyer_id}`, `order_${refundedOrder!.id}`]).emit('order:refunded', {
          orderId: refundedOrder!.id,
          amount: refundedTotal!,
          paymentStatus: 'refunded',
          fundStatus: 'refunded',
        });
      }
    } catch (wsErr) {
      logger.error('[OrderService] Failed to emit WebSocket notification for refund:', wsErr);
    }

    return {
      orderId: refundedOrder!.id,
      paymentStatus: refundedOrder!.payment_status,
      fundStatus: refundedOrder!.fund_status,
      totalAmount: refundedTotal!,
    };
  }

  /**
   * Phase 4F: Expire or cancel an order.
   * If fund_status === 'held', refunds escrow back to buyer.
   * Sets payment_status = newPaymentStatus (default 'expired').
   */
  async expireOrder(
    orderId: string,
    actorId: string = 'payment-deadline-job',
    newPaymentStatus: OrderStatus | string = OrderStatus.EXPIRED,
  ) {
    let expiredOrder: Order;
    let refundedTotal: string | null = null;

    await this.dataSource.transaction(async (manager: EntityManager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new AppError('ORDER_NOT_FOUND', 404);
      }

      if (order.fund_status === 'held') {
        const { totalAmount } = await this.refundOrderEscrow(manager, order, actorId);
        refundedTotal = totalAmount;
      }

      order.payment_status = newPaymentStatus;
      await manager.save(Order, order);
      expiredOrder = order;
    });

    if (refundedTotal) {
      try {
        if (webSocketService?.io) {
          webSocketService.io.to([`user_${expiredOrder!.buyer_id}`, `order_${expiredOrder!.id}`]).emit('order:refunded', {
            orderId: expiredOrder!.id,
            amount: refundedTotal,
            paymentStatus: expiredOrder!.payment_status,
            fundStatus: expiredOrder!.fund_status,
          });
        }
      } catch (wsErr) {
        logger.error('[OrderService] Failed to emit WebSocket notification for expired refund:', wsErr);
      }
    }

    return expiredOrder!;
  }
}

/**
 * ROUND(final_price * 0.05, 2), half-up — on final_price ONLY, never on shipping_fee.
 * Uses integer minor arithmetic (BigInt), never float.
 */
export function platformFeeOf(finalPrice: string): string {
  const scaled = toMinor(finalPrice) * 5n; // × 0.05 × 100
  const quotient = scaled / 100n;
  const remainder = scaled % 100n;
  return toDecimal(remainder >= 50n ? quotient + 1n : quotient);
}
