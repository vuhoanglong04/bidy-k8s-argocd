import express from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { Review } from './entity/review.entity.js';
import { ReviewReply } from './entity/review-reply.entity.js';
import { Order } from '../order/entity/order.entity.js';
import { ReviewService } from './review.service.js';
import { ReviewController } from './review.controller.js';
import { rateLimiters } from '../../middlewares/security.middleware.js';
import { isAdmin } from '../../middlewares/authen.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { AdminReviewQueryDto, UpdateReviewStatusDto } from './dtos/admin-review.dto.js';

const router = express.Router();

const reviewController = new ReviewController(
  new ReviewService(
    AppDataSource,
    AppDataSource.getRepository(Review),
    AppDataSource.getRepository(ReviewReply),
    AppDataSource.getRepository(Order),
  ),
);

/**
 * @swagger
 * /api/v1/admin/reviews:
 *   get:
 *     summary: List reviews for moderation (Admin only)
 *     description: >
 *       Unlike the public reads this does NOT filter on `published` — an admin who
 *       cannot see hidden reviews cannot tell a moderated one from a deleted one,
 *       nor put it back. Anonymous reviews keep their author here for the same
 *       reason: moderation may need to act on the person, not just the text.
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
 *           enum: [published, hidden]
 *         description: Omit to list both.
 *       - in: query
 *         name: revieweeId
 *         schema: { type: string }
 *       - in: query
 *         name: reviewerId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated reviews returned
 *       400:
 *         description: Invalid query parameters
 */
router.get(
  '/',
  rateLimiters.general,
  isAdmin,
  dtoValidationMiddleware(AdminReviewQueryDto, 'query'),
  reviewController.getForAdmin,
);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}/status:
 *   patch:
 *     summary: Hide or restore a review (Admin only)
 *     description: >
 *       Reviews are published as soon as they are written — there is no
 *       pre-moderation queue — and an author can neither edit nor delete their own,
 *       so this is the only way to take a bad review down.
 *
 *       Hiding removes it from every public read INCLUDING the seller's rating
 *       summary, because those all filter on `published`. Restoring puts it back and
 *       the rating returns with it.
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
 *             $ref: '#/components/schemas/UpdateReviewStatusDto'
 *     responses:
 *       200:
 *         description: Status updated
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
 *                     status: { type: string, enum: [published, hidden] }
 *       400:
 *         description: Invalid payload
 *       404:
 *         description: Review not found (error_code REVIEW_NOT_FOUND)
 */
router.patch(
  '/:id/status',
  rateLimiters.general,
  isAdmin,
  dtoValidationMiddleware(UpdateReviewStatusDto, 'body'),
  reviewController.updateStatus,
);

export default router;
