import express from 'express';
import { rateLimiters } from '../../middlewares/security.middleware.js';
import { isAdmin } from '../../middlewares/authen.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { buildAuctionRequestController } from './auction-request.route.js';
import {
  AuctionRequestQueryDto,
  RejectAuctionRequestDto,
  UpdateAuctionRequestDto,
} from './dtos/auction-request.dto.js';

const router = express.Router();
const controller = buildAuctionRequestController();

router.use(rateLimiters.general, isAdmin);

/**
 * @swagger
 * /api/v1/admin/auction-requests:
 *   get:
 *     summary: The approval queue (Admin only)
 *     description: >
 *       Oldest first — a review queue is worked front to back, so the request that
 *       has waited longest comes first.
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, cancelled]
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches the product name, case-insensitively.
 *     responses:
 *       200:
 *         description: Paginated requests returned
 */
router.get('/', dtoValidationMiddleware(AuctionRequestQueryDto, 'query'), controller.findForAdmin);

/**
 * @swagger
 * /api/v1/admin/auction-requests/{id}:
 *   patch:
 *     summary: Adjust a request's terms before approving it (Admin only)
 *     description: >
 *       Approve takes no body on purpose, so an admin who wants different terms
 *       edits them here first. That keeps exactly one path from stored terms to a
 *       live auction, and leaves the row saying what was actually approved.
 *     tags: [Admin]
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
 *         description: Request not found (error_code REQUEST_NOT_FOUND)
 *       409:
 *         description: The request is no longer pending (error_code REQUEST_NOT_PENDING)
 */
router.patch(
  '/:id',
  dtoValidationMiddleware(UpdateAuctionRequestDto, 'body'),
  controller.adminUpdate,
);

/**
 * @swagger
 * /api/v1/admin/auction-requests/{id}/approve:
 *   post:
 *     summary: Approve a request and create its auction (Admin only)
 *     description: >
 *       Takes NO body. The auction is created from the terms stored on the request,
 *       in the same transaction — an approved request without its auction would be a
 *       listing the seller believes is live and nobody can find.
 *
 *       The product rules are re-checked here, not trusted from filing time: between
 *       the two the product may have been unpublished, deleted, or auctioned through
 *       another route, and approving on a stale check is what would produce two live
 *       auctions for one item.
 *
 *       A request whose start date has already passed opens immediately rather than
 *       waiting for a moment that is gone. If its END date has passed, approval is
 *       refused with `REQUEST_SCHEDULE_EXPIRED` — edit the dates first.
 *
 *       The seller is notified with `auction_request_approved`, carrying the new
 *       auction id.
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
 *         description: Approved, auction created
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
 *                     id: { type: string }
 *                     status: { type: string, example: approved }
 *                     auctionId:
 *                       type: string
 *                       description: The auction this approval created.
 *       404:
 *         description: Request not found
 *       409:
 *         description: >
 *           `REQUEST_NOT_PENDING`, `REQUEST_SCHEDULE_EXPIRED`, or
 *           `PRODUCT_HAS_LIVE_AUCTION` when the product was auctioned meanwhile
 *       422:
 *         description: PRODUCT_NOT_AUCTIONABLE (unpublished or lost its images meanwhile)
 */
router.post('/:id/approve', controller.approve);

/**
 * @swagger
 * /api/v1/admin/auction-requests/{id}/reject:
 *   post:
 *     summary: Reject a request (Admin only)
 *     description: >
 *       `reason` is required and is shown to the seller. A "no" with no reason
 *       leaves them guessing what to change, and they will refile the same thing.
 *       The seller is notified with `auction_request_rejected`.
 *     tags: [Admin]
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
 *             $ref: '#/components/schemas/RejectAuctionRequestDto'
 *     responses:
 *       200:
 *         description: Rejected
 *       400:
 *         description: reason is missing or empty
 *       404:
 *         description: Request not found
 *       409:
 *         description: The request is no longer pending (error_code REQUEST_NOT_PENDING)
 */
router.post(
  '/:id/reject',
  dtoValidationMiddleware(RejectAuctionRequestDto, 'body'),
  controller.reject,
);

export default router;
