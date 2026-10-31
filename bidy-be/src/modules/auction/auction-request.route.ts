import express from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { AuctionRequest } from './entity/auction-request.entity.js';
import { Product } from '../product/entities/product.entity.js';
import { Category } from '../category/category.entity.js';
import { ProductService } from '../product/product.service.js';
import { AuctionRequestService } from './auction-request.service.js';
import { AuctionRequestController } from './auction-request.controller.js';
import { isAuth } from '../../middlewares/authen.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import {
  AuctionRequestQueryDto,
  CreateAuctionRequestDto,
  UpdateAuctionRequestDto,
} from './dtos/auction-request.dto.js';

const router = express.Router();

export const buildAuctionRequestController = () =>
  new AuctionRequestController(
    new AuctionRequestService(
      AppDataSource,
      AppDataSource.getRepository(AuctionRequest),
      new ProductService(
        AppDataSource.getRepository(Product),
        AppDataSource.getRepository(Category),
        AppDataSource,
      ),
    ),
  );

const controller = buildAuctionRequestController();

router.use(['/auction-requests', '/me/auction-requests'], isAuth as any);

/**
 * @swagger
 * /api/v1/auction-requests:
 *   post:
 *     summary: Ask for a product to be put up for auction
 *     description: >
 *       Sellers no longer create auctions directly — POST /api/v1/auctions is admin
 *       only now. This files a request an admin approves, and the auction is created
 *       by that approval.
 *
 *       The product must already be published with at least one image and must not
 *       already be on the block; those are the same rules POST /auctions enforced,
 *       checked here AND again at approval, because the product can change while the
 *       request waits in the queue.
 *
 *       JSON, camelCase — unlike the old multipart auction form, which only existed
 *       because it carried image uploads. Images belong to the product.
 *     tags: [AuctionRequest]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAuctionRequestDto'
 *     responses:
 *       201:
 *         description: Request submitted, awaiting review
 *       400:
 *         description: Invalid payload, or endDate not after startDate (error_code INVALID_DATE_RANGE)
 *       403:
 *         description: The product belongs to someone else
 *       409:
 *         description: >
 *           `REQUEST_ALREADY_PENDING` (this product is already queued) or
 *           `PRODUCT_HAS_LIVE_AUCTION`
 *       422:
 *         description: PRODUCT_NOT_AUCTIONABLE (not published, or has no image)
 */
router.post(
  '/auction-requests',
  dtoValidationMiddleware(CreateAuctionRequestDto, 'body'),
  controller.create,
);

/**
 * @swagger
 * /api/v1/me/auction-requests:
 *   get:
 *     summary: List your own auction requests
 *     tags: [AuctionRequest]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, cancelled]
 *     responses:
 *       200:
 *         description: Paginated requests returned
 */
router.get(
  '/me/auction-requests',
  dtoValidationMiddleware(AuctionRequestQueryDto, 'query'),
  controller.findMine,
);

/**
 * @swagger
 * /api/v1/auction-requests/{id}:
 *   get:
 *     summary: Read one auction request
 *     description: >
 *       A seller can only read their own; someone else's answers 404 rather than
 *       403, because whether a request id exists is not a stranger's business.
 *       Admins can read any.
 *     tags: [AuctionRequest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Request returned
 *       404:
 *         description: Not found, or not yours (error_code REQUEST_NOT_FOUND)
 *   patch:
 *     summary: Change the terms of a request you filed
 *     description: >
 *       Allowed while `pending` only — an approved request is the record of what was
 *       agreed, and a rejected one is a closed decision. The product cannot be
 *       swapped: withdraw and file a new request instead.
 *     tags: [AuctionRequest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAuctionRequestDto'
 *     responses:
 *       200:
 *         description: Request updated
 *       404:
 *         description: Not found, or not yours
 *       409:
 *         description: The request is no longer pending (error_code REQUEST_NOT_PENDING)
 *   delete:
 *     summary: Withdraw a request you filed
 *     description: >
 *       Sets it to `cancelled` rather than deleting the row, so the queue keeps a
 *       record of what was asked for and withdrawn. Pending requests only.
 *     tags: [AuctionRequest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Request withdrawn
 *       404:
 *         description: Not found, or not yours
 *       409:
 *         description: The request is no longer pending (error_code REQUEST_NOT_PENDING)
 */
router.get('/auction-requests/:id', controller.findOne);
router.patch(
  '/auction-requests/:id',
  dtoValidationMiddleware(UpdateAuctionRequestDto, 'body'),
  controller.update,
);
router.delete('/auction-requests/:id', controller.cancel);

export default router;
