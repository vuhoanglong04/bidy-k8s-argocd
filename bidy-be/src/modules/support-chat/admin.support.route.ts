import express from 'express';
import * as adminSupportController from './admin.support.controller.js';
import * as chatController from '../chat/chat.controller.js';
import { isAdmin } from '../../middlewares/authen.middleware.js';
import { validationMiddlewares } from '../../middlewares/validation.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { UpdateChatStatusDto } from './dtos/update-chat-status.dto.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin Support
 *   description: >
 *     Admin-side support chat API.
 *
 *
 *     **REST is for loading the chat list and history only. Replies go over Socket.IO.**
 *     `GET /chats` for the list, `GET /chats/:chatId/messages` once when opening a chat,
 *     then stay on the socket. `POST /chats/:chatId/messages` still works and is kept
 *     for non-interactive callers (scripts, integrations), but an admin panel that
 *     POSTs every reply hits the rate limiter for no benefit — the socket path saves
 *     through the same service before broadcasting.
 *
 *
 *     Admin emits: `admin_join_all` (once after connect, for the notification rooms) ·
 *     `admin_join_chat` {chatId} · `admin_send_message` {chatId, message,
 *     clientMessageId, messageType} · `admin_typing` {chatId, isTyping} ·
 *     `admin_status_update` {chatId, status}.
 *
 *
 *     Server emits: `admin_notification` {type: support_chat_created, chat} ·
 *     `new_support_message` · `support_message_ack` {clientMessageId, status:
 *     saved|failed, messageId, createdAt, code} · `support_chat_typing` ·
 *     `support_chat_read_receipt` · `support_chat_status_update`.
 *
 *
 *     `admin_send_message` and `admin_status_update` both persist before they
 *     broadcast, so the socket path is not a fire-and-forget shortcut around the
 *     database. Reconcile optimistic bubbles on `support_message_ack` by
 *     `clientMessageId`, and dedupe `new_support_message` by `messageId`.
 */

router.use(isAdmin as any);

/**
 * @swagger
 * /api/v1/admin/support/chats:
 *   get:
 *     summary: List all support chats (Admin only)
 *     description: >
 *       Each row is a SupportTicket plus two derived fields the entity does not carry:
 *       `lastMessageAt` (null when the ticket has no message yet — do not fall back to
 *       `updatedAt`, which also moves on a status change) and `unreadByAdmin` (messages
 *       from the ticket's own user that are still unread). `statusCounts` maps each
 *       status to `{ count, unread }` across ALL tickets, not just this page — summing
 *       the page's `unreadByAdmin` is only correct while everything fits on one page.
 *     tags: [Admin Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Support chats returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     chats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           subject: { type: string }
 *                           status: { type: string }
 *                           createdAt: { type: string, format: date-time }
 *                           updatedAt: { type: string, format: date-time }
 *                           lastMessageAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           unreadByAdmin: { type: integer }
 *                     totalPages: { type: integer }
 *                     currentPage: { type: integer }
 *                     totalChats: { type: integer }
 *                     statusCounts:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           count: { type: integer }
 *                           unread: { type: integer }
 *                       example:
 *                         open: { count: 3, unread: 7 }
 *                         closed: { count: 12, unread: 0 }
 */
router.get('/chats',
  validationMiddlewares.validatePagination as any,
  (req: any, res: any) => adminSupportController.getAllSupportChats(req, res),
);

/**
 * @swagger
 * /api/v1/admin/support/chats/unread-count:
 *   get:
 *     summary: Count unread support messages across all chats (Admin only)
 *     tags: [Admin Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count returned
 */
router.get('/chats/unread-count', (req: any, res: any) => adminSupportController.getUnreadCount(req, res));

/**
 * @swagger
 * /api/v1/admin/support/chats/{chatId}:
 *   get:
 *     summary: Get a support chat's details (Admin only)
 *     tags: [Admin Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat details returned
 */
router.get('/chats/:chatId', (req: any, res: any) => adminSupportController.getSupportChatDetails(req, res));

/**
 * @swagger
 * /api/v1/admin/support/chats/{chatId}/messages:
 *   get:
 *     summary: List messages in a support chat, newest page first (Admin only)
 *     description: >
 *       Page 1 is the MOST RECENT messages; within a page rows are oldest-first.
 *       `hasMore` says whether an older page exists. Each row carries `senderType`
 *       ('user' | 'admin'), derived from the ticket owner server-side.
 *     tags: [Admin Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages returned
 */
router.get('/chats/:chatId/messages',
  validationMiddlewares.validatePagination as any,
  (req: any, res: any) => adminSupportController.getChatMessages(req, res),
);

/**
 * @swagger
 * /api/v1/admin/support/chats/{chatId}/messages:
 *   post:
 *     summary: Reply to a user in a support chat (Admin only)
 *     tags: [Admin Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Reply sent
 */
router.post('/chats/:chatId/messages', (req: any, res: any) => adminSupportController.replyToUser(req, res));

/**
 * @swagger
 * /api/v1/admin/support/chats/{chatId}/read:
 *   patch:
 *     summary: Mark a support chat's messages as read (Admin only)
 *     tags: [Admin Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat marked as read
 */
router.patch('/chats/:chatId/read', (req: any, res: any) => adminSupportController.markChatAsRead(req, res));

/**
 * @swagger
 * /api/v1/admin/support/chats/{chatId}/status:
 *   patch:
 *     summary: Update a support chat's status (Admin only)
 *     tags: [Admin Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateChatStatusDto'
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: status is not one of open, in_progress, resolved, closed
 */
router.patch('/chats/:chatId/status',
  dtoValidationMiddleware(UpdateChatStatusDto) as any,
  (req: any, res: any) => adminSupportController.updateChatStatus(req, res),
);

/**
 * @swagger
 * /api/v1/admin/support/conversations:
 *   get:
 *     summary: List all user conversations (Admin only)
 *     tags: [Admin Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations returned
 */
router.get('/conversations', (req: any, res: any) => chatController.getAllConversation(req, res));

export default router;
