import { AppDataSource } from '../../database/data-source.js';
import { Notification } from './entity/notification.entity.js';
import { User } from '../user/entity/user.entity.js';
import { Auction } from '../auction/entity/auctions.entity.js';
import { UserStatus } from '../user/enum/user.enum.js';
import { NotificationType } from './enum/notification-type.enum.js';
import { NotificationCategory } from './enum/notification-category.enum.js';
import { NotificationPriority } from './enum/notification-priority.enum.js';
import { logger } from '../../common/util/logger.js';
import { fileService } from '../file/file.provider.js';
import webSocketService from '../common/websocket.service.js';

/**
 * The only actor columns that may leave the server. A notification's actor is a
 * stranger to its recipient — `new_bid` shows a bidder to the seller and
 * `bid_outbid` shows rival bidders to each other — while the full User row carries
 * email, phone and the admin-written statusReason. Selected explicitly here, on
 * both the REST and the socket path, so that PII never leaves the database.
 */
const ACTOR_PUBLIC_FIELDS = ['actor.id', 'actor.username', 'actor.avatarFileId'];

class NotificationService {
  /**
   * Resolves `relatedData.auction.imageFileId` into a usable `image` URL.
   *
   * relatedData stores the file id, never a URL: a notification outlives any
   * signature, so a persisted URL would be dead long before the row is read. That
   * means every path that hands a notification to a client has to sign it — the
   * list endpoint and the realtime push alike, or the same notification arrives
   * with an image over REST and without one over the socket.
   */
  private async attachAuctionImages(notifications: (Notification | null)[]) {
    const auctions = notifications
      .map((n) => n?.relatedData?.auction as any)
      .filter(Boolean);

    const urls = await fileService.urlsByIds(auctions.map((auction) => auction.imageFileId));
    for (const auction of auctions) {
      auction.image = urls.get(auction.imageFileId ?? '') ?? null;
    }
    return notifications;
  }

  async createNotification(data: any) {
    try {
      const repo = AppDataSource.getRepository(Notification);
      const notification = repo.create({
        recipientId: data.recipient,
        actorId: data.actor || null,
        type: data.type,
        title: data.title,
        message: data.message,
        category: data.category,
        priority: data.priority,
        actionUrl: data.actionUrl,
        relatedData: data.relatedData,
      });
      await repo.save(notification);

      // Reloaded so the pushed payload carries the actor, narrowed to ACTOR_PUBLIC_FIELDS.
      // Not findOne({ relations }): that selects every User column, and User.avatarFile is
      // eager, so it would pull the whole row plus its avatar back out on this path.
      const populated = await repo
        .createQueryBuilder('notification')
        .leftJoin('notification.actor', 'actor')
        .addSelect(ACTOR_PUBLIC_FIELDS)
        .where('notification.id = :id', { id: notification.id })
        .getOne();

      await this.attachAuctionImages([populated]);

      // Pushed here rather than at each call site so every notification is realtime
      // by construction — the badge stops needing a poll, and a new notification kind
      // cannot forget to deliver itself. The row is already committed above, so a
      // socket failure must not fail creation.
      try {
        webSocketService.io
          ?.to(`user_${notification.recipientId}`)
          .emit('notification', populated);
      } catch (socketError: any) {
        logger.warn('Notification created but not pushed: ' + socketError.message);
      }

      logger.info('Notification created', {
        notificationId: notification.id,
        type: notification.type,
        recipient: notification.recipientId,
      });

      return populated;
    } catch (error: any) {
      logger.error('Error creating notification', { error: error.message, data });
      throw new Error('Failed to create notification');
    }
  }

  createAuctionNotifications() {
    return {
      auctionStarted: async (auctionId: string, auctionOwnerId: string) => {
        try {
          const auction = await AppDataSource.getRepository(Auction).findOne({ 
            where: { id: auctionId },
            relations: { product: { images: true } }
          });
          if (!auction) throw new Error('Auction not found');

          return await this.createNotification({
            recipient: auctionOwnerId,
            type: NotificationType.AUCTION_STARTED,
            title: 'Đấu giá đã bắt đầu',
            message: `Phiên đấu giá "${auction.product?.name}" của bạn đã bắt đầu. Chúc bạn bán được giá cao!`,
            category: NotificationCategory.AUCTION,
            priority: NotificationPriority.NORMAL,
            actionUrl: `/product/${auctionId}`,
            relatedData: {
              auction: {
                id: auctionId,
                name: auction.product?.name,
                imageFileId: auction.product?.images?.[0]?.fileId ?? null,
                currentPrice: Number(auction.currentPrice) || 0, // Simplified for now
                endDate: auction.endDate,
              },
            },
          });
        } catch (error: any) {
          logger.error('Error creating auction started notification', { error: error.message, auctionId });
          throw error;
        }
      },
      /**
       * Warns the seller and everyone who has bid that the auction is about to
       * close. `bidderIds` is the distinct set of bidders — the caller reads it,
       * because it already holds the row and knows the window it is sweeping.
       */
      auctionEndingSoon: async (auctionId: string, minutesRemaining: number, bidderIds: string[] = []) => {
        const { auction, related } = await this.auctionContext(auctionId);
        const ownerId = auction.product?.ownerId;
        const closing = `Phiên đấu giá "${related.name}" sẽ kết thúc trong khoảng ${minutesRemaining} phút.`;

        const ownerNotification = ownerId
          ? await this.createNotification({
              recipient: ownerId,
              type: NotificationType.AUCTION_ENDING_SOON,
              title: 'Phiên đấu giá sắp kết thúc',
              message: `${closing} Giá hiện tại là ${related.currentPrice}đ.`,
              category: NotificationCategory.AUCTION,
              priority: NotificationPriority.NORMAL,
              actionUrl: `/product/${auctionId}`,
              relatedData: { auction: related },
            })
          : null;

        const bidderNotifications = await Promise.all(
          bidderIds
            .filter((bidderId) => String(bidderId) !== String(ownerId))
            .map((bidderId) =>
              this.createNotification({
                recipient: bidderId,
                type: NotificationType.AUCTION_ENDING_SOON,
                title: 'Phiên đấu giá sắp kết thúc',
                message: `${closing} Trả giá ngay nếu bạn vẫn muốn sở hữu.`,
                category: NotificationCategory.AUCTION,
                priority: NotificationPriority.HIGH,
                actionUrl: `/product/${auctionId}`,
                relatedData: { auction: related },
              }),
            ),
        );

        logger.info('Auction ending soon notifications created', {
          auctionId,
          recipients: bidderNotifications.length + (ownerNotification ? 1 : 0),
        });

        return { ownerNotification, bidderNotifications };
      },
      /**
       * One notification per bidder once an auction closes: won for the winner,
       * lost for everyone else. `participants` is the same ranked list that
       * bidHistoryService.logAuctionEnded writes its terminal rows from.
       */
      auctionEnded: async (
        auctionId: string,
        winnerId: string | null,
        participants: { userId: string; amount: number }[],
      ) => {
        try {
          if (participants.length === 0) return [];

          const auction = await AppDataSource.getRepository(Auction).findOne({
            where: { id: auctionId },
            relations: { product: { images: true } },
          });
          if (!auction) throw new Error('Auction not found');

          const productName = auction.product?.name ?? 'phiên đấu giá';
          const imageFileId = auction.product?.images?.[0]?.fileId ?? null;
          const finalPrice = Number(auction.currentPrice) || 0;

          const notifications = await Promise.all(
            participants.map((participant) => {
              const isWinner = winnerId !== null && String(participant.userId) === String(winnerId);

              return this.createNotification({
                recipient: participant.userId,
                type: isWinner ? NotificationType.AUCTION_WON : NotificationType.AUCTION_LOST,
                title: isWinner ? 'Chúc mừng! Bạn đã thắng đấu giá' : 'Phiên đấu giá đã kết thúc',
                message: isWinner
                  ? `Bạn đã thắng phiên đấu giá "${productName}". Vui lòng thanh toán trong vòng 3 ngày.`
                  : `Phiên đấu giá "${productName}" đã kết thúc. Rất tiếc, bạn không phải người thắng cuộc.`,
                category: NotificationCategory.AUCTION,
                priority: isWinner ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
                actionUrl: isWinner ? '/orders' : `/product/${auctionId}`,
                relatedData: {
                  auction: {
                    id: auctionId,
                    name: productName,
                    imageFileId,
                    finalPrice,
                    endDate: auction.endDate,
                  },
                  yourBid: participant.amount,
                },
              });
            }),
          );

          logger.info('Auction ended notifications created', {
            auctionId,
            winnerId,
            recipients: notifications.length,
          });

          return notifications;
        } catch (error: any) {
          logger.error('Error creating auction ended notifications', { error: error.message, auctionId });
          throw error;
        }
      }
    };
  }

  /** The auction and the fields every bid/auction notification embeds. */
  private async auctionContext(auctionId: string) {
    const auction = await AppDataSource.getRepository(Auction).findOne({
      where: { id: auctionId },
      relations: { product: { images: true } },
    });
    if (!auction) throw new Error('Auction not found');

    return {
      auction,
      related: {
        id: auctionId,
        name: auction.product?.name ?? 'phiên đấu giá',
        imageFileId: auction.product?.images?.[0]?.fileId ?? null,
        currentPrice: Number(auction.currentPrice) || 0,
        endDate: auction.endDate,
      },
    };
  }

  /**
   * An admin's ruling on a request to list a product.
   *
   * Sent from the request service rather than broadcast, because only the seller who
   * filed it has any use for it. Rejection always carries the reason: a "no" with no
   * reason leaves the seller to guess what to change, and they will simply refile
   * the same thing.
   */
  createAuctionRequestNotifications() {
    return {
      approved: async (sellerId: string, productName: string, auctionId: string, adminId: string) =>
        await this.createNotification({
          recipient: sellerId,
          actor: adminId,
          type: NotificationType.AUCTION_REQUEST_APPROVED,
          title: 'Yêu cầu đăng phiên đã được duyệt',
          message: `Sản phẩm "${productName}" đã được duyệt và phiên đấu giá đã được tạo.`,
          category: NotificationCategory.AUCTION,
          priority: NotificationPriority.NORMAL,
          actionUrl: `/product/${auctionId}`,
          relatedData: { auctionId },
        }),

      rejected: async (sellerId: string, productName: string, reason: string, adminId: string) =>
        await this.createNotification({
          recipient: sellerId,
          actor: adminId,
          type: NotificationType.AUCTION_REQUEST_REJECTED,
          title: 'Yêu cầu đăng phiên bị từ chối',
          message: `Sản phẩm "${productName}" chưa được duyệt. Lý do: ${reason}`,
          category: NotificationCategory.AUCTION,
          priority: NotificationPriority.NORMAL,
          actionUrl: '/profile/auction-requests',
          relatedData: { reason },
        }),
    };
  }

  createBidNotifications() {
    return {
      /** Tells the seller their auction drew a bid. */
      newBidReceived: async (auctionId: string, bidData: any, bidderId: string) => {
        const { auction, related } = await this.auctionContext(auctionId);
        const ownerId = auction.product?.ownerId;

        // Sellers cannot bid on their own auction, so owner and bidder never match;
        // the guard is for auctions whose product row lost its owner.
        if (!ownerId || String(ownerId) === String(bidderId)) return null;

        return await this.createNotification({
          recipient: ownerId,
          actor: bidderId,
          type: NotificationType.NEW_BID,
          title: 'Có lượt trả giá mới',
          message: `Phiên đấu giá "${related.name}" của bạn vừa nhận một lượt trả giá ${Number(bidData?.amount) || related.currentPrice}đ.`,
          category: NotificationCategory.BID,
          priority: NotificationPriority.NORMAL,
          actionUrl: `/product/${auctionId}`,
          relatedData: { auction: related, bidAmount: Number(bidData?.amount) || related.currentPrice },
        });
      },

      /**
       * Tells the previous leader they no longer lead. This is the one notification
       * the bidding loop depends on — without it a bidder only learns they lost by
       * coming back to look, which is usually after the auction has closed.
       */
      bidOutbid: async (
        auctionId: string,
        outbidUserId: string,
        newBidAmount: number,
        newBidderId: string,
      ) => {
        if (String(outbidUserId) === String(newBidderId)) return null;

        const { related } = await this.auctionContext(auctionId);

        return await this.createNotification({
          recipient: outbidUserId,
          actor: newBidderId,
          type: NotificationType.BID_OUTBID,
          title: 'Bạn đã bị trả giá cao hơn',
          message: `Có người vừa trả giá cao hơn bạn ở phiên "${related.name}". Giá hiện tại là ${newBidAmount}đ.`,
          category: NotificationCategory.BID,
          priority: NotificationPriority.HIGH,
          actionUrl: `/product/${auctionId}`,
          relatedData: { auction: related, newBidAmount },
        });
      },
    };
  }

  async getUserNotifications(userId: string, options: any = {}) {
    try {
      const { page = 1, limit = 20, category = null, isRead = null, priority = null, type = null } = options;
      
      const repo = AppDataSource.getRepository(Notification);
      const query = repo.createQueryBuilder('notification')
        .where('notification.recipient_id = :userId', { userId })
        .leftJoin('notification.actor', 'actor')
        .addSelect(ACTOR_PUBLIC_FIELDS);

      if (category) query.andWhere('notification.category = :category', { category });
      if (isRead !== null) query.andWhere('notification.is_read = :isRead', { isRead });
      if (priority) query.andWhere('notification.priority = :priority', { priority });
      if (type) query.andWhere('notification.type = :type', { type });

      const [notifications, totalCount] = await query
        .orderBy('notification.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      await this.attachAuctionImages(notifications);

      const unreadCount = await repo.count({ where: { recipientId: userId, isRead: false } });

      return {
        notifications,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit,
          hasMore: page < Math.ceil(totalCount / limit),
        },
        unreadCount,
      };
    } catch (error: any) {
      logger.error('Error getting user notifications', { error: error.message, userId });
      throw new Error('Failed to get notifications');
    }
  }

  async markAsRead(notificationId: string, userId: string) {
    try {
      const repo = AppDataSource.getRepository(Notification);
      const notification = await repo.findOne({ where: { id: notificationId, recipientId: userId } });
      if (!notification) throw new Error('Notification not found');

      notification.isRead = true;
      await repo.save(notification);
      return notification;
    } catch (error: any) {
      logger.error('Error marking notification as read', { error: error.message, notificationId, userId });
      throw error;
    }
  }

  async markAllAsRead(userId: string) {
    try {
      const repo = AppDataSource.getRepository(Notification);
      const result = await repo.update({ recipientId: userId, isRead: false }, { isRead: true });
      logger.info('Marked all notifications as read', { userId, modifiedCount: result.affected });
      return result;
    } catch (error: any) {
      logger.error('Error marking all notifications as read', { error: error.message, userId });
      throw new Error('Failed to mark all notifications as read');
    }
  }

  async getUnreadCount(userId: string) {
    try {
      return await AppDataSource.getRepository(Notification).count({ where: { recipientId: userId, isRead: false } });
    } catch (error: any) {
      logger.error('Error getting unread count', { error: error.message, userId });
      throw new Error('Failed to get unread count');
    }
  }

  async deleteNotification(notificationId: string, userId: string) {
    try {
      const result = await AppDataSource.getRepository(Notification).delete({ id: notificationId, recipientId: userId });
      if (result.affected === 0) throw new Error('Notification not found');
      
      logger.info('Notification deleted', { notificationId, userId });
      return result;
    } catch (error: any) {
      logger.error('Error deleting notification', { error: error.message, notificationId, userId });
      throw error;
    }
  }

  async createSystemNotification(data: any) {
    try {
      const users = await AppDataSource.getRepository(User).find({ where: { status: UserStatus.ACTIVE }, select: { id: true } });
      const notifications = [];

      for (const user of users) {
        const notification = await this.createNotification({
          ...data,
          recipient: user.id,
          category: NotificationCategory.SYSTEM,
        });
        notifications.push(notification);
      }

      logger.info('System notification created for all users', { count: notifications.length, type: data.type });
      return notifications;
    } catch (error: any) {
      logger.error('Error creating system notification', { error: error.message, data });
      throw new Error('Failed to create system notification');
    }
  }
}

export const notificationService = new NotificationService();
export const createNotification = notificationService.createNotification.bind(notificationService);
export const getUserNotifications = notificationService.getUserNotifications.bind(notificationService);
export const markAsRead = notificationService.markAsRead.bind(notificationService);
export const markAllAsRead = notificationService.markAllAsRead.bind(notificationService);
export const getUnreadCount = notificationService.getUnreadCount.bind(notificationService);
export const deleteNotification = notificationService.deleteNotification.bind(notificationService);
export const createSystemNotification = notificationService.createSystemNotification.bind(notificationService);
