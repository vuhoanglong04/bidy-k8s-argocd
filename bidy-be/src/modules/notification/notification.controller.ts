import { Response } from 'express';
import { CustomRequest } from '../user/user.controller.js';
import { CreateTestNotificationDto } from '../user/dtos/create-test-notification.dto.js';
import { notificationService } from './notification.service.js';
import { NotificationType } from './enum/notification-type.enum.js';
import { NotificationCategory } from './enum/notification-category.enum.js';
import { NotificationPriority } from './enum/notification-priority.enum.js';
import { apiResponse } from '../../common/util/api-response.js';
import { logger } from '../../common/util/logger.js';

class NotificationController {
  /**
   * Get user notifications with pagination and filters
   * GET /api/notifications
   */
  async getNotifications(req: CustomRequest, res: Response) {
    try {
      const userId = req.idUser!;
      const {
        page = 1,
        limit = 20,
        category,
        isRead,
        priority,
        type,
      } = req.query as any;

      // Validate and convert query parameters
      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50), // Max 50 notifications per request
        category: category || null,
        isRead: isRead !== undefined ? isRead === 'true' : null,
        priority: priority || null,
        type: type || null,
      };

      const result = await notificationService.getUserNotifications(userId, options);

      return res.status(200).json(apiResponse('success', 'Notifications retrieved successfully', result));
    } catch (error: any) {
      logger.error('Error in getNotifications controller', {
        error: error.message,
        userId: req.idUser,
      });
      return res.status(500).json(apiResponse('fail', 'Failed to get notifications'));
    }
  }

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(req: CustomRequest, res: Response) {
    try {
      const userId = req.idUser!;
      const count = await notificationService.getUnreadCount(userId);

      return res.status(200).json(apiResponse('success', 'Unread count retrieved successfully', { count }));
    } catch (error: any) {
      logger.error('Error in getUnreadCount controller', {
        error: error.message,
        userId: req.idUser,
      });
      return res.status(500).json(apiResponse('fail', 'Failed to get unread count'));
    }
  }

  /**
   * Mark notification as read
   * PUT /api/notifications/:id/read
   */
  async markAsRead(req: CustomRequest, res: Response) {
    try {
      const userId = req.idUser!;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json(apiResponse('fail', 'Notification ID is required'));
      }

      const notification = await notificationService.markAsRead(id, userId);

      return res.status(200).json(apiResponse('success', 'Notification marked as read', notification));
    } catch (error: any) {
      logger.error('Error in markAsRead controller', {
        error: error.message,
        notificationId: req.params.id,
        userId: req.idUser,
      });

      if (error.message === 'Notification not found') {
        return res.status(404).json(apiResponse('fail', 'Notification not found'));
      }

      return res.status(500).json(apiResponse('fail', 'Failed to mark notification as read'));
    }
  }

  /**
   * Mark all notifications as read
   * PUT /api/notifications/mark-all-read
   */
  async markAllAsRead(req: CustomRequest, res: Response) {
    try {
      const userId = req.idUser!;
      const result = await notificationService.markAllAsRead(userId);

      return res.status(200).json(apiResponse('success', 'All notifications marked as read', {
        modifiedCount: result.affected,
      }));
    } catch (error: any) {
      logger.error('Error in markAllAsRead controller', {
        error: error.message,
        userId: req.idUser,
      });
      return res.status(500).json(apiResponse('fail', 'Failed to mark all notifications as read'));
    }
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  async deleteNotification(req: CustomRequest, res: Response) {
    try {
      const userId = req.idUser!;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json(apiResponse('fail', 'Notification ID is required'));
      }

      const result = await notificationService.deleteNotification(id, userId);

      return res.status(200).json(apiResponse('success', 'Notification deleted successfully', {
        deletedCount: result.affected,
      }));
    } catch (error: any) {
      logger.error('Error in deleteNotification controller', {
        error: error.message,
        notificationId: req.params.id,
        userId: req.idUser,
      });

      if (error.message === 'Notification not found') {
        return res.status(404).json(apiResponse('fail', 'Notification not found'));
      }

      return res.status(500).json(apiResponse('fail', 'Failed to delete notification'));
    }
  }

  /**
   * Get notifications by category
   * GET /api/notifications/category/:category
   */
  async getNotificationsByCategory(req: CustomRequest, res: Response) {
    try {
      const userId = req.idUser!;
      const { category } = req.params;
      const {
        page = 1,
        limit = 20,
        includeRead = true,
      } = req.query as any;

      // Read straight off the enum: this list was hand-maintained and had drifted to
      // ['auction','bid','payment','system','social','security'], which rejected the two
      // categories that exist (order, account) and accepted three that nothing writes.
      const validCategories = Object.values(NotificationCategory) as string[];
      if (!validCategories.includes(category)) {
        return res.status(400).json(apiResponse('fail', 'Invalid category'));
      }

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50),
        includeRead: includeRead === 'true' || includeRead === true,
      };

      const notifications = await notificationService.getUserNotifications(
        userId,
        { ...options, category }
      );

      return res.status(200).json(apiResponse('success', 'Category notifications retrieved successfully', {
        notifications: notifications.notifications,
        category,
        pagination: notifications.pagination,
      }));
    } catch (error: any) {
      logger.error('Error in getNotificationsByCategory controller', {
        error: error.message,
        category: req.params.category,
        userId: req.idUser,
      });
      return res.status(500).json(apiResponse('fail', 'Failed to get category notifications'));
    }
  }

  /**
   * Create test notification (development only)
   * POST /api/notifications/test
   */
  async createTestNotification(req: CustomRequest<CreateTestNotificationDto>, res: Response) {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json(apiResponse('fail', 'Test notifications not allowed in production'));
      }

      const userId = req.idUser!;
      const { type = NotificationType.SYSTEM_MAINTENANCE, title, message } = req.body;

      const testNotification = await notificationService.createNotification({
        recipient: userId,
        type,
        title: title || 'Test Notification',
        message: message || 'This is a test notification for development purposes.',
        category: NotificationCategory.SYSTEM,
        priority: NotificationPriority.NORMAL,
        actionUrl: '/profile/notifications',
      });

      return res.status(201).json(apiResponse('success', 'Test notification created', testNotification));
    } catch (error: any) {
      logger.error('Error in createTestNotification controller', {
        error: error.message,
        userId: req.idUser,
      });
      return res.status(500).json(apiResponse('fail', 'Failed to create test notification'));
    }
  }

  /**
   * Get notification statistics
   * GET /api/notifications/stats
   */
  async getNotificationStats(req: CustomRequest, res: Response) {
    try {
      const userId = req.idUser!;

      // Get stats for different categories and priorities
      const stats = await Promise.all([
        notificationService.getUnreadCount(userId),
        notificationService.getUserNotifications(userId, { limit: 1, category: NotificationCategory.AUCTION, isRead: false }),
        notificationService.getUserNotifications(userId, { limit: 1, category: NotificationCategory.BID, isRead: false }),
        notificationService.getUserNotifications(userId, { limit: 1, category: NotificationCategory.ORDER, isRead: false }),
        notificationService.getUserNotifications(userId, { limit: 1, category: NotificationCategory.ACCOUNT, isRead: false }),
        notificationService.getUserNotifications(userId, { limit: 1, category: NotificationCategory.SYSTEM, isRead: false }),
        notificationService.getUserNotifications(userId, { limit: 1, priority: NotificationPriority.URGENT, isRead: false }),
        notificationService.getUserNotifications(userId, { limit: 1, priority: NotificationPriority.HIGH, isRead: false }),
      ]);

      const [
        totalUnread,
        auctionUnread,
        bidUnread,
        orderUnread,
        accountUnread,
        systemUnread,
        urgentUnread,
        highUnread,
      ] = stats;

      const result = {
        totalUnread,
        categories: {
          auction: auctionUnread.pagination.totalCount,
          bid: bidUnread.pagination.totalCount,
          order: orderUnread.pagination.totalCount,
          account: accountUnread.pagination.totalCount,
          system: systemUnread.pagination.totalCount,
        },
        priorities: {
          urgent: urgentUnread.pagination.totalCount,
          high: highUnread.pagination.totalCount,
        },
      };

      return res.status(200).json(apiResponse('success', 'Notification statistics retrieved', result));
    } catch (error: any) {
      logger.error('Error in getNotificationStats controller', {
        error: error.message,
        userId: req.idUser,
      });
      return res.status(500).json(apiResponse('fail', 'Failed to get notification statistics'));
    }
  }
}

export default new NotificationController();