import express from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { Review } from './entity/review.entity.js';
import { ReviewReply } from './entity/review-reply.entity.js';
import { Order } from '../order/entity/order.entity.js';
import { ReviewService } from './review.service.js';
import { ReviewController } from './review.controller.js';
import { isAuth } from '../../middlewares/authen.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { CreateReviewDto } from './dtos/create-review.dto.js';
import { CreateReviewReplyDto } from './dtos/create-review-reply.dto.js';
import { ReviewQueryDto } from './dtos/review-query.dto.js';

const router = express.Router();

const reviewService = new ReviewService(
  AppDataSource,
  AppDataSource.getRepository(Review),
  AppDataSource.getRepository(ReviewReply),
  AppDataSource.getRepository(Order),
);
const reviewController = new ReviewController(reviewService);

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Order review and seller rating API
 */

// ===== PUBLIC =====

/**
 * @swagger
 * /api/v1/reviews/user/{userId}:
 *   get:
 *     summary: List published reviews received by a seller
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the reviewed seller
 *       - in: query
 *         name: page
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: string
 *         description: Page size, capped at 50
 *       - in: query
 *         name: rating
 *         schema:
 *           type: string
 *           enum: ['1', '2', '3', '4', '5']
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 */
router.get('/user/:userId',
  dtoValidationMiddleware(ReviewQueryDto, 'query'),
  reviewController.getByUser,
);

/**
 * @swagger
 * /api/v1/reviews/user/{userId}/summary:
 *   get:
 *     summary: Get a seller's aggregate rating summary
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalReviews:
 *                   type: integer
 *                 averageProductRating:
 *                   type: number
 *                 averageShippingRating:
 *                   type: number
 *                   nullable: true
 *                 averageServiceRating:
 *                   type: number
 *                   nullable: true
 *                 breakdown:
 *                   type: object
 *                   description: Review count per star rating
 */
router.get('/user/:userId/summary', reviewController.getSummaryByUser);

/**
 * @swagger
 * /api/v1/reviews/{id}:
 *   get:
 *     summary: Get a single published review
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review retrieved successfully
 *       404:
 *         description: Review not found
 */
router.get('/:id', reviewController.getById);

// ===== AUTHENTICATED =====
router.use(isAuth as any);

/**
 * @swagger
 * /api/v1/reviews:
 *   post:
 *     summary: Review a paid order you bought
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReviewDto'
 *     responses:
 *       201:
 *         description: Review created successfully
 *       403:
 *         description: Caller is not the buyer on this order
 *       404:
 *         description: Order not found
 *       409:
 *         description: Order not paid, or already reviewed
 */
router.post('/',
  dtoValidationMiddleware(CreateReviewDto) as any,
  reviewController.createReview,
);

/**
 * @swagger
 * /api/v1/reviews/{id}/reply:
 *   post:
 *     summary: Reply to a review of you as a seller (one reply per review)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReviewReplyDto'
 *     responses:
 *       201:
 *         description: Reply created successfully
 *       403:
 *         description: Only the reviewed seller can reply
 *       404:
 *         description: Review not found
 *       409:
 *         description: This review has already been replied to
 */
router.post('/:id/reply',
  dtoValidationMiddleware(CreateReviewReplyDto) as any,
  reviewController.createReply,
);

export default router;
