import express from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { User } from './entity/user.entity.js';
import { Auction } from '../auction/entity/auctions.entity.js';
import { BidHistory } from '../auction/entity/bid-history.entity.js';
import { Product } from '../product/entities/product.entity.js';
import { Order } from '../order/entity/order.entity.js';
import { Category } from '../category/category.entity.js';
import { CategoryService } from '../category/category.service.js';
import { ProductService } from '../product/product.service.js';
import { AuctionService } from '../auction/auction.service.js';
import { SellerService } from './seller.service.js';
import { SellerController } from './seller.controller.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { SellerAuctionQueryDto } from './dtos/seller-auction-query.dto.js';

const router = express.Router();

const sellerController = new SellerController(
  new SellerService(AppDataSource.getRepository(User), AppDataSource.getRepository(Auction)),
  new AuctionService(
    AppDataSource,
    AppDataSource.getRepository(Auction),
    AppDataSource.getRepository(BidHistory),
    AppDataSource.getRepository(Product),
    AppDataSource.getRepository(Order),
    new CategoryService(AppDataSource.getRepository(Category)),
    new ProductService(
      AppDataSource.getRepository(Product),
      AppDataSource.getRepository(Category),
      AppDataSource,
    ),
  ),
);

/**
 * @swagger
 * /api/v1/sellers/{sellerId}:
 *   get:
 *     summary: Public profile of one seller
 *     description: >
 *       Unauthenticated, so it carries no email and no phone number. `avatarUrl` is
 *       presigned and valid for 1 hour — render it, do not persist it; re-sign an
 *       expired one via GET /api/v1/files/{id}/url using `avatarFileId`.
 *
 *       `auctionCounts` never counts `cancelled` auctions, so the three status counts
 *       always add up to `total` and match what GET /sellers/{sellerId}/auctions lists.
 *       Ratings are not included here — read them from
 *       GET /api/v1/reviews/user/{sellerId}/summary.
 *     tags: [Seller]
 *     parameters:
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Seller profile returned
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
 *                     id: { type: string, example: "30" }
 *                     username: { type: string }
 *                     fullname: { type: string }
 *                     avatarFileId: { type: string, nullable: true }
 *                     avatarUrl:
 *                       type: string
 *                       nullable: true
 *                       description: Presigned URL, valid for 1 hour.
 *                     createdAt: { type: string, format: date-time }
 *                     auctionCounts:
 *                       type: object
 *                       properties:
 *                         pending: { type: integer }
 *                         happening: { type: integer }
 *                         ended: { type: integer }
 *                         total:
 *                           type: integer
 *                           description: pending + happening + ended. Excludes cancelled.
 *       404:
 *         description: Seller not found (error_code SELLER_NOT_FOUND)
 */
router.get('/:sellerId', sellerController.getProfile);

/**
 * @swagger
 * /api/v1/sellers/{sellerId}/auctions:
 *   get:
 *     summary: Public storefront — one seller's auctions
 *     description: >
 *       Unauthenticated. Omitting `status` lists `pending`, `happening` and `ended`;
 *       `cancelled` is filtered out server-side and returns nothing even when asked
 *       for explicitly, so a client can never surface a cancelled listing by
 *       forgetting a parameter.
 *
 *       Note this differs from GET /api/v1/auctions, which does list every status
 *       when none is given. Items carry the same shape as that endpoint, with the
 *       seller narrowed to `{ id, username }`.
 *     tags: [Seller]
 *     parameters:
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, happening, ended]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [endDate, createdAt, currentPrice, bidderCount, totalBids]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Paginated auctions returned
 *       400:
 *         description: Invalid query parameters
 *       404:
 *         description: Seller not found (error_code SELLER_NOT_FOUND)
 */
router.get(
  '/:sellerId/auctions',
  dtoValidationMiddleware(SellerAuctionQueryDto, 'query'),
  sellerController.getAuctions,
);

export default router;
