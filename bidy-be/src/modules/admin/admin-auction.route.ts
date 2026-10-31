import express from 'express';
import { rateLimiters } from '../../middlewares/security.middleware.js';
import { isAdmin } from '../../middlewares/authen.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { AdminAuctionController } from './admin-auction.controller.js';
import { AdminAuctionQueryDto } from './dtos/admin-auction.dto.js';

const router = express.Router();
const adminAuctionController = new AdminAuctionController();

/**
 * @swagger
 * /api/v1/admin/auctions:
 *   get:
 *     summary: List every auction (Admin only)
 *     description: >
 *       Back-office listing, so unlike the public GET /auctions it covers every
 *       status including `cancelled`, and the seller carries an email so an admin
 *       can act on a listing. Same paginated envelope as the rest of the API.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches the product name, case-insensitively.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, happening, ended, cancelled]
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *       - in: query
 *         name: sellerId
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, startDate, endDate, currentPrice, startingPrice, bidderCount, totalBids]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Paginated auctions returned
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
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, example: "42" }
 *                           status:
 *                             type: string
 *                             enum: [pending, happening, ended, cancelled]
 *                           startingPrice: { type: number }
 *                           currentPrice: { type: number }
 *                           buyNowPrice: { type: number, nullable: true }
 *                           reservePrice: { type: number, nullable: true }
 *                           bidIncrement: { type: number }
 *                           quantity: { type: integer }
 *                           bidderCount: { type: integer }
 *                           totalBids: { type: integer }
 *                           startDate: { type: string, format: date-time }
 *                           endDate: { type: string, format: date-time }
 *                           createdAt: { type: string, format: date-time }
 *                           product:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id: { type: string }
 *                               name: { type: string }
 *                               primaryImage:
 *                                 type: string
 *                                 nullable: true
 *                                 description: Presigned URL, valid for 1 hour. Render it, do not persist it.
 *                           category:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id: { type: string }
 *                               name: { type: string }
 *                           seller:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id: { type: string }
 *                               username: { type: string }
 *                               fullname: { type: string }
 *                               email: { type: string }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         totalItems: { type: integer }
 *                         totalPages: { type: integer }
 *                         hasNextPage: { type: boolean }
 *                         hasPreviousPage: { type: boolean }
 *       400:
 *         description: Invalid query parameters
 */
router.get(
  '/',
  rateLimiters.general,
  isAdmin,
  dtoValidationMiddleware(AdminAuctionQueryDto, 'query'),
  adminAuctionController.getAuctions,
);

/**
 * @swagger
 * /api/v1/admin/auctions/{id}/cancel:
 *   patch:
 *     summary: Cancel an auction (Admin only)
 *     description: >
 *       Bidding holds no money — escrow only exists once an order is created — so
 *       cancelling refunds nothing. It sets the auction to `cancelled`, which takes
 *       it out of every public listing.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Auction cancelled
 *       404:
 *         description: Auction not found (error_code AUCTION_NOT_FOUND)
 *       409:
 *         description: >
 *           Auction is already ended or cancelled
 *           (error_code AUCTION_NOT_CANCELLABLE)
 */
router.patch('/:id/cancel', rateLimiters.general, isAdmin, adminAuctionController.cancelAuction);

export default router;
