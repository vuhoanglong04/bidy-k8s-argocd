import express from 'express';
import { rateLimiters } from '../../middlewares/security.middleware';
import { isAdmin } from '../../middlewares/authen.middleware';
import { AdminOverviewController } from './admin-overview.controller';

const router = express.Router();
const adminOverviewController = new AdminOverviewController();

/**
 * @swagger
 * /api/v1/admin/overview/users:
 *   get:
 *     summary: Get user overview counters (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUser:
 *                       type: integer
 *                     activeUser:
 *                       type: integer
 *                     suspendedUser:
 *                       type: integer
 */
router.get('/users', rateLimiters.general, isAdmin, adminOverviewController.getUserOverview);

/**
 * @swagger
 * /api/v1/admin/overview/auctions:
 *   get:
 *     summary: Get auction overview counters (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Auction overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalAuction:
 *                       type: integer
 *                     happeningAuction:
 *                       type: integer
 *                     endedAuction:
 *                       type: integer
 */
router.get('/auctions', rateLimiters.general, isAdmin, adminOverviewController.getAuctionOverview);

/**
 * @swagger
 * /api/v1/admin/overview/categories:
 *   get:
 *     summary: Get category overview counters (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCategories:
 *                       type: integer
 *                     activeCategories:
 *                       type: integer
 *                     inactiveCategories:
 *                       type: integer
 */
router.get('/categories', rateLimiters.general, isAdmin, adminOverviewController.getCategoryOverview);

export default router;
