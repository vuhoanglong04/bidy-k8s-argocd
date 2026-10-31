import { AppDataSource } from '../../database/data-source.js';
import { Order } from './entity/order.entity.js';
import { OrderStatus } from './enum/order-status.enum.js';
import { User } from '../user/entity/user.entity.js';
import { notificationService } from '../notification/notification.service.js';
import { NotificationType } from '../notification/enum/notification-type.enum.js';
import { NotificationCategory } from '../notification/enum/notification-category.enum.js';
import { NotificationPriority } from '../notification/enum/notification-priority.enum.js';
import VNTimeUtils from '../../common/util/vnTimezone.js';
import { logger } from '../../common/util/logger.js';
import { LessThan, In } from 'typeorm';
import { OrderService } from './order.service.js';

class PaymentDeadlineService {
  private isProcessing = false;
  private lastProcessTime: Date | null = null;
  private processedCount = 0;

  async processPaymentDeadlines() {
    if (this.isProcessing) {
      logger.info('[PaymentDeadline] Already processing, skipping');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      logger.info('[PaymentDeadline] Processing payment deadlines');

      const now = VNTimeUtils.getCurrentVNTime().toDate();
      let overdueCount = 0;
      let lockedAccounts = 0;

      const orderRepo = AppDataSource.getRepository(Order);
      const userRepo = AppDataSource.getRepository(User);

      const overdueOrders = await orderRepo.find({
        where: {
          payment_status: OrderStatus.PENDING,
          payment_deadline: LessThan(now),
        },
        relations: { buyer: true, auction: { product: true } }
      });

      logger.info(`[PaymentDeadline] Found ${overdueOrders.length} overdue orders`);

      const userOrdersMap = new Map<string, { user: User, orders: Order[] }>();
      for (const order of overdueOrders) {
        if (!order.buyer) continue;

        const userId = order.buyer_id;
        if (!userOrdersMap.has(userId)) {
          userOrdersMap.set(userId, {
            user: order.buyer,
            orders: [],
          });
        }
        userOrdersMap.get(userId)!.orders.push(order);
      }

      for (const [userId, userData] of userOrdersMap.entries()) {
        const { user, orders } = userData;

        // Phase 4F: go through OrderService.expireOrder rather than a bulk UPDATE. An
        // order sitting at fund_status='held' must have its escrow refunded to the buyer
        // in the same transaction that expires it; a bare payment_status update would
        // strand that money in the platform wallet with nothing to detect it. Today this
        // query only selects PENDING orders, which never hold escrow — routing through
        // the shared path keeps that an invariant of the code rather than of the query.
        const orderService = new OrderService(orderRepo, AppDataSource);
        for (const order of orders) {
          try {
            await orderService.expireOrder(order.id, 'payment-deadline-job', OrderStatus.OVERDUE);
            overdueCount++;
          } catch (expireError) {
            logger.error(`[PaymentDeadline] Failed to expire order ${order.id}`, expireError);
          }
        }

        if (!user.accountLocked) {
          await userRepo.update(userId, {
            accountLocked: true,
          });

          lockedAccounts++;

          try {
            await notificationService.createNotification({
              recipient: userId,
              type: NotificationType.ACCOUNT_LOCKED,
              title: 'Tài khoản đã bị khóa',
              message: `Tài khoản của bạn đã bị khóa do có ${orders.length} đơn hàng quá hạn thanh toán. Vui lòng thanh toán để mở khóa tài khoản.`,
              category: NotificationCategory.ACCOUNT,
              priority: NotificationPriority.HIGH,
              relatedData: {
                orderCount: orders.length,
                totalAmount: orders.reduce((sum, o) => sum + Number(o.final_price || 0), 0),
              },
            });
          } catch (notifError) {
            logger.error('[PaymentDeadline] Error sending notification', notifError);
          }
        }
      }

      const tomorrow = VNTimeUtils.addToCurrentVNTime(24, 'hours');
      
      const upcomingDeadlines = await orderRepo.createQueryBuilder('order')
        .leftJoinAndSelect('order.buyer', 'buyer')
        .leftJoinAndSelect('order.auction', 'auction')
        .leftJoinAndSelect('auction.product', 'product')
        .where('order.payment_status = :status', { status: OrderStatus.PENDING })
        .andWhere('order.payment_deadline >= :now', { now })
        .andWhere('order.payment_deadline < :tomorrow', { tomorrow })
        .getMany();

      logger.info(`[PaymentDeadline] Sending ${upcomingDeadlines.length} payment reminders`);

      for (const order of upcomingDeadlines) {
        if (!order.buyer_id) continue;

        try {
          await notificationService.createNotification({
            recipient: order.buyer_id,
            type: NotificationType.PAYMENT_REMINDER,
            title: 'Sắp hết hạn thanh toán',
            message: `Đơn hàng của bạn sẽ hết hạn thanh toán trong vòng 24 giờ!`,
            category: NotificationCategory.ORDER,
            priority: NotificationPriority.HIGH,
            actionUrl: `/orders/${order.id}`,
            relatedData: {
              orderId: order.id,
              productName: order.auction?.product?.name || 'Sản phẩm đấu giá',
              amount: order.final_price || 0,
              deadline: order.payment_deadline,
            },
          });

        } catch (notifError) {
          logger.error('[PaymentDeadline] Error sending reminder', notifError);
        }
      }

      const duration = Date.now() - startTime;
      this.lastProcessTime = now;
      this.processedCount += overdueCount;

      if (overdueCount > 0 || lockedAccounts > 0) {
        logger.info(`[PaymentDeadline] Marked ${overdueCount} orders as overdue, locked ${lockedAccounts} accounts (${duration}ms)`);
      }

      return {
        overdueOrders: overdueCount,
        lockedAccounts: lockedAccounts,
        reminders: upcomingDeadlines.length,
        duration: duration,
      };

    } catch (error) {
      logger.error('[PaymentDeadline] Error processing payment deadlines', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  async unlockAccountAfterPayment(userId: string) {
    try {
      const orderRepo = AppDataSource.getRepository(Order);
      const userRepo = AppDataSource.getRepository(User);

      const unpaidOrders = await orderRepo.count({
        where: {
          buyer_id: userId,
          payment_status: In([OrderStatus.PENDING, OrderStatus.OVERDUE]),
        },
      });

      if (unpaidOrders === 0) {
        await userRepo.update(userId, {
          accountLocked: false,
        });

        logger.info(`[PaymentDeadline] Unlocked account for user ${userId}`);

        await notificationService.createNotification({
          recipient: userId,
          type: NotificationType.ACCOUNT_UNLOCKED,
          title: 'Tài khoản đã được mở khóa',
          message: 'Tài khoản của bạn đã được mở khóa. Cảm ơn bạn đã thanh toán!',
          category: NotificationCategory.ACCOUNT,
          priority: NotificationPriority.NORMAL,
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('[PaymentDeadline] Error unlocking account', error);
      throw error;
    }
  }

  async getStatus() {
    const tomorrow = VNTimeUtils.addToCurrentVNTime(24, 'hours');
    const orderRepo = AppDataSource.getRepository(Order);
    const userRepo = AppDataSource.getRepository(User);

    const stats = await Promise.all([
      orderRepo.count({ where: { payment_status: OrderStatus.PENDING } }),
      orderRepo.count({ where: { payment_status: OrderStatus.OVERDUE } }),
      orderRepo.count({
        where: {
          payment_status: OrderStatus.PENDING,
          payment_deadline: LessThan(tomorrow),
        }
      }),
      userRepo.count({ where: { accountLocked: true } }),
    ]);

    return {
      pendingOrders: stats[0],
      overdueOrders: stats[1],
      urgentOrders: stats[2],
      lockedAccounts: stats[3],
      lastProcessTime: this.lastProcessTime,
      totalProcessed: this.processedCount,
      isProcessing: this.isProcessing,
    };
  }
}

export default new PaymentDeadlineService();
