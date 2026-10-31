import express from 'express';
import { rateLimiters } from '../../middlewares/security.middleware.js';
import { isAdmin } from '../../middlewares/authen.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { AdminOverviewController } from './admin-overview.controller.js';
import { StatisticsYearDto } from './dtos/admin-auction.dto.js';

const router = express.Router();
const adminOverviewController = new AdminOverviewController();

/**
 * @swagger
 * components:
 *   schemas:
 *     MonthlyCount:
 *       type: object
 *       properties:
 *         month:
 *           type: string
 *           description: Two-digit month, '01' through '12'.
 *           example: "01"
 *         amount:
 *           type: number
 *           description: Always a number, never a string.
 *           example: 12
 *
 * /api/v1/admin/statistics/auctions:
 *   get:
 *     summary: Auctions created per month (Admin only)
 *     description: >
 *       Always twelve entries, January to December. A month with no auctions reads
 *       as 0 rather than going missing, so a chart keeps a continuous axis.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer, minimum: 2000, maximum: 2100 }
 *         description: Defaults to the current year.
 *     responses:
 *       200:
 *         description: Monthly auction counts returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   minItems: 12
 *                   maxItems: 12
 *                   items:
 *                     $ref: '#/components/schemas/MonthlyCount'
 *       400:
 *         description: Invalid year
 */
router.get(
  '/auctions',
  rateLimiters.general,
  isAdmin,
  dtoValidationMiddleware(StatisticsYearDto, 'query'),
  adminOverviewController.getAuctionsByMonth,
);

/**
 * @swagger
 * /api/v1/admin/statistics/users:
 *   get:
 *     summary: Users registered per month (Admin only)
 *     description: >
 *       Always twelve entries, January to December. A month with no signups reads
 *       as 0 rather than going missing, so a chart keeps a continuous axis.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer, minimum: 2000, maximum: 2100 }
 *         description: Defaults to the current year.
 *     responses:
 *       200:
 *         description: Monthly user counts returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   minItems: 12
 *                   maxItems: 12
 *                   items:
 *                     $ref: '#/components/schemas/MonthlyCount'
 *       400:
 *         description: Invalid year
 */
router.get(
  '/users',
  rateLimiters.general,
  isAdmin,
  dtoValidationMiddleware(StatisticsYearDto, 'query'),
  adminOverviewController.getUsersByMonth,
);

export default router;
