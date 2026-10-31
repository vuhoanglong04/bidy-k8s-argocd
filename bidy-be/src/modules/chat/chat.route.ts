import express from 'express';
import * as chatController from './chat.controller.js';
import { isAuth } from '../../middlewares/authen.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { CreateMessageDto } from './dtos/create-message.dto.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: User-to-admin conversation API
 */

router.use(isAuth as any);

/**
 * @swagger
 * /api/v1/chat/conversations:
 *   get:
 *     summary: List the authenticated user's conversations
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: Conversations returned
 */
router.get('/conversations', (req: any, res: any) => chatController.getMyConversation(req, res));

/**
 * @swagger
 * /api/v1/chat/conversations:
 *   post:
 *     summary: Start (or reuse) a conversation with support
 *     tags: [Chat]
 *     responses:
 *       201:
 *         description: Conversation created or returned
 */
router.post('/conversations', (req: any, res: any) => chatController.createConversation(req, res));

/**
 * @swagger
 * /api/v1/chat/conversations/{id}:
 *   get:
 *     summary: Get a single conversation by id
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation returned
 *       404:
 *         description: Conversation not found
 */
router.get('/conversations/:id', (req: any, res: any) => chatController.getConversationById(req, res));

/**
 * @swagger
 * /api/v1/chat/conversations/{id}/messages:
 *   get:
 *     summary: List messages in a conversation
 *     description: >
 *       Newest first and paged. Messages are no longer pushed over the socket when
 *       a client joins a conversation room — this is the only history source.
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
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
 *           default: 50
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Messages returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage: { type: integer }
 *                         totalPages: { type: integer }
 *                         totalCount: { type: integer }
 *                         limit: { type: integer }
 *                         hasMore: { type: boolean }
 *       403:
 *         description: Not a member of this conversation
 */
router.get('/conversations/:id/messages', (req: any, res: any) => chatController.getAllMessageByConversationId(req, res));

/**
 * @swagger
 * /api/v1/chat/messages:
 *   get:
 *     summary: List the authenticated user's messages with support
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: Messages returned
 */
router.get('/messages', (req: any, res: any) => chatController.getAllMessageByUserId(req, res));

/**
 * @swagger
 * /api/v1/chat/messages:
 *   post:
 *     summary: Send a message into a conversation
 *     tags: [Chat]
 *     responses:
 *       201:
 *         description: Message created
 *       403:
 *         description: Not a member of this conversation
 */
router.post('/messages',
  dtoValidationMiddleware(CreateMessageDto) as any,
  (req: any, res: any) => chatController.createMessage(req, res),
);

export default router;
