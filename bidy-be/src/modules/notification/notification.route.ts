import express from 'express';
import notificationController from './notification.controller.js';
import { isAuth } from '../../middlewares/authen.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { validationMiddlewares } from '../../middlewares/validation.middleware.js';
import { CreateTestNotificationDto } from '../user/dtos/create-test-notification.dto.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: User notification API
 *
 * components:
 *   schemas:
 *     NotificationType:
 *       type: string
 *       description: >
 *         Mirrors NotificationType in src/modules/notification/enum/notification-type.enum.ts.
 *         Generate client types from this list rather than hardcoding it — the two drifting
 *         apart is what made clients switch on categories that no writer ever produced.
 *       enum:
 *         - auction_started
 *         - auction_ending_soon
 *         - auction_won
 *         - auction_lost
 *         - new_bid
 *         - bid_outbid
 *         - payment_reminder
 *         - account_locked
 *         - account_unlocked
 *         - account_suspended
 *         - account_banned
 *         - system_maintenance
 *         - payment_released
 *         - withdrawal_completed
 *         - withdrawal_rejected
 *         - topup_success
 *         - withdrawal_sla_overdue
 *         - wallet_reconciliation_failed
 *       example: bid_outbid
 *     NotificationCategory:
 *       type: string
 *       description: >
 *         Mirrors NotificationCategory. Payment notifications carry `order`, not `payment`.
 *       enum: [auction, bid, order, account, system]
 *       example: bid
 *     NotificationPriority:
 *       type: string
 *       description: >
 *         Mirrors NotificationPriority. Nothing writes `urgent` yet — it exists because
 *         GET /notifications/stats already reports a count for it. Handle it, do not expect it.
 *       enum: [normal, high, urgent]
 *       example: high
 *     NotificationActor:
 *       type: object
 *       nullable: true
 *       description: >
 *         Who caused the notification. Non-null only for `new_bid` and `bid_outbid`; every
 *         other type is system-generated and leaves this null. Deliberately narrowed to three
 *         columns: the actor is a stranger to the recipient, so the User row behind it (email,
 *         phone, admin status notes) must never reach the client.
 *       properties:
 *         id: { type: string, example: "42" }
 *         username: { type: string, example: "nguyenvana" }
 *         avatarFileId:
 *           type: string
 *           nullable: true
 *           description: Id in the files table, not a URL. Presign it via GET /api/v1/files/:id/url.
 *     Notification:
 *       type: object
 *       description: >
 *         One notification. The socket event `notification` emits this exact shape, so a client
 *         can append a pushed item to the list it fetched without reshaping it.
 *       properties:
 *         id: { type: string, example: "77" }
 *         recipientId: { type: string, example: "9" }
 *         actorId: { type: string, nullable: true, example: "42" }
 *         actor:
 *           $ref: '#/components/schemas/NotificationActor'
 *         title: { type: string, example: "Bạn đã bị trả giá cao hơn" }
 *         message: { type: string }
 *         type:
 *           $ref: '#/components/schemas/NotificationType'
 *         category:
 *           $ref: '#/components/schemas/NotificationCategory'
 *         priority:
 *           $ref: '#/components/schemas/NotificationPriority'
 *         isRead: { type: boolean, example: false }
 *         actionUrl:
 *           type: string
 *           nullable: true
 *           description: >
 *             Relative path, never an absolute URL. Null for `account_locked` and
 *             `account_unlocked`; `/orders` for `auction_won`, `/orders/{orderId}` for
 *             `payment_reminder`, `/product/{auctionId}` for the rest.
 *           example: /product/1
 *         relatedData:
 *           type: object
 *           nullable: true
 *           description: >
 *             Shape depends on `type`. Auction and bid types carry `auction`; `auction_won`
 *             and `auction_lost` carry `finalPrice` where the others carry `currentPrice`, plus
 *             `yourBid`. `new_bid` adds `bidAmount`, `bid_outbid` adds `newBidAmount`.
 *             `payment_reminder` carries orderId/productName/amount/deadline and no auction at
 *             all, so it has no image. `account_locked` carries orderCount/totalAmount,
 *             `account_unlocked` carries nothing, and `account_suspended`/`account_banned`
 *             carry the admin's reason plus suspendedUntil (null for a ban).
 *           properties:
 *             auction:
 *               type: object
 *               properties:
 *                 id: { type: string, example: "1" }
 *                 name: { type: string }
 *                 imageFileId: { type: string, nullable: true }
 *                 currentPrice: { type: number, example: 250000 }
 *                 finalPrice: { type: number, example: 250000 }
 *                 endDate: { type: string, format: date-time }
 *                 image:
 *                   type: string
 *                   nullable: true
 *                   description: >
 *                     Presigned URL, signed per request on both the REST and the socket path.
 *                     Null when the product has no image. Render it, do not persist it.
 *             yourBid: { type: number }
 *             bidAmount: { type: number }
 *             newBidAmount: { type: number }
 *             orderId: { type: string }
 *             productName: { type: string }
 *             amount: { type: number }
 *             deadline: { type: string, format: date-time }
 *             orderCount: { type: integer }
 *             totalAmount: { type: number }
 *             reason: { type: string, description: The admin's stated reason for the suspension or ban. }
 *             suspendedUntil: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 */

router.use(isAuth as any);

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Get the authenticated user's notifications
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         description: Capped at 50 server-side, whatever is sent.
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: category
 *         schema:
 *           $ref: '#/components/schemas/NotificationCategory'
 *       - in: query
 *         name: type
 *         schema:
 *           $ref: '#/components/schemas/NotificationType'
 *       - in: query
 *         name: priority
 *         schema:
 *           $ref: '#/components/schemas/NotificationPriority'
 *       - in: query
 *         name: isRead
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Notifications returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     notifications:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notification'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage: { type: integer }
 *                         totalPages: { type: integer }
 *                         totalCount: { type: integer }
 *                         limit: { type: integer }
 *                         hasMore: { type: boolean }
 *                     unreadCount:
 *                       type: integer
 *                       description: >
 *                         Unread across every category, not just the filtered page.
 */
router.get('/',
  validationMiddlewares.validatePagination as any,
  (req: any, res: any) => notificationController.getNotifications(req, res),
);

/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Count the authenticated user's unread notifications
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Unread count returned
 */
router.get('/unread-count', (req: any, res: any) => notificationController.getUnreadCount(req, res));

/**
 * @swagger
 * /api/v1/notifications/stats:
 *   get:
 *     summary: Get notification statistics by category and priority
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Statistics returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUnread: { type: integer }
 *                     categories:
 *                       type: object
 *                       description: Unread notification counts grouped by category.
 *                       properties:
 *                         auction: { type: integer }
 *                         bid: { type: integer }
 *                         order: { type: integer }
 *                         account: { type: integer }
 *                         system: { type: integer }
 *                     priorities:
 *                       type: object
 *                       description: >
 *                         `urgent` is always 0 today — no notification is written with that
 *                         priority. See NotificationPriority.
 *                       properties:
 *                         urgent: { type: integer }
 *                         high: { type: integer }
 */
router.get('/stats', (req: any, res: any) => notificationController.getNotificationStats(req, res));

/**
 * @swagger
 * /api/v1/notifications/category/{category}:
 *   get:
 *     summary: Get notifications filtered by category
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/NotificationCategory'
 *     responses:
 *       200:
 *         description: Category notifications returned
 *       400:
 *         description: Invalid category
 */
router.get('/category/:category', (req: any, res: any) => notificationController.getNotificationsByCategory(req, res));

/**
 * @swagger
 * /api/v1/notifications/mark-all-read:
 *   put:
 *     summary: Mark all of the authenticated user's notifications as read
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.put('/mark-all-read', (req: any, res: any) => notificationController.markAllAsRead(req, res));

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   put:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.put('/:id/read', (req: any, res: any) => notificationController.markAsRead(req, res));

/**
 * @swagger
 * /api/v1/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification deleted
 *       404:
 *         description: Notification not found
 */
router.delete('/:id', (req: any, res: any) => notificationController.deleteNotification(req, res));

/**
 * @swagger
 * /api/v1/notifications/test:
 *   post:
 *     summary: Create a test notification (blocked in production)
 *     tags: [Notifications]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 $ref: '#/components/schemas/NotificationType'
 *               title: { type: string }
 *               message: { type: string }
 *     responses:
 *       201:
 *         description: Test notification created
 *       403:
 *         description: Not allowed in production
 */
router.post('/test',
  dtoValidationMiddleware(CreateTestNotificationDto) as any,
  (req: any, res: any) => notificationController.createTestNotification(req, res),
);

export default router;
