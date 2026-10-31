import { Request, Response } from 'express';
import { ReviewService } from './review.service.js';
import { CustomRequest } from '../user/user.controller.js';
import { CreateReviewDto } from './dtos/create-review.dto.js';
import { CreateReviewReplyDto } from './dtos/create-review-reply.dto.js';
import { ReviewQueryDto } from './dtos/review-query.dto.js';
import { AdminReviewQueryDto, UpdateReviewStatusDto } from './dtos/admin-review.dto.js';
import { apiResponse, paginatedResponse } from '../../common/util/api-response.js';
import { REVIEW_MESSAGE } from '../../common/messages/review/review.message.js';

export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * Stable, machine-readable reasons a review call can fail. The code goes out in
   * `error_code` so clients branch on it instead of on an HTTP status two different
   * failures can share — REVIEW_ALREADY_EXISTS and REPLY_ALREADY_EXISTS are both 409.
   * Clients map these to their own copy: add to this table, never rename an entry.
   */
  private static readonly ERRORS: Record<string, { status: number; message: string }> = {
    [REVIEW_MESSAGE.ORDER_NOT_FOUND]: { status: 404, message: 'Order not found' },
    [REVIEW_MESSAGE.REVIEW_NOT_FOUND]: { status: 404, message: REVIEW_MESSAGE.NOT_FOUND },
    [REVIEW_MESSAGE.NOT_ORDER_BUYER]: { status: 403, message: 'Only the buyer on this order can review it' },
    [REVIEW_MESSAGE.NOT_REVIEWEE]: { status: 403, message: 'Only the reviewed seller can reply' },
    [REVIEW_MESSAGE.ORDER_NOT_PAID]: { status: 409, message: 'This order has not been paid yet' },
    [REVIEW_MESSAGE.REVIEW_ALREADY_EXISTS]: { status: 409, message: 'This order has already been reviewed' },
    [REVIEW_MESSAGE.REPLY_ALREADY_EXISTS]: { status: 409, message: 'This review has already been replied to' },
  };

  /** Maps a thrown service error onto its response, or a 500 when it is not ours. */
  private static fail(res: Response, error: Error) {
    const known = ReviewController.ERRORS[error.message];
    if (known) {
      return res.status(known.status).json(apiResponse('fail', known.message, error.message));
    }
    return res.status(500).json(apiResponse('error', 'Internal server error'));
  }

  createReview = async (req: CustomRequest<CreateReviewDto>, res: Response) => {
    try {
      const review = await this.reviewService.createReview(req.idUser!, req.body);
      return res.status(201).json(
        apiResponse('success', REVIEW_MESSAGE.CREATE_SUCCESS, review),
      );
    } catch (error: any) {
      return ReviewController.fail(res, error);
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const review = await this.reviewService.findById(req.params.id as string);
      return res.status(200).json(
        apiResponse('success', REVIEW_MESSAGE.GET_BY_ID_SUCCESS, review),
      );
    } catch (error: any) {
      return ReviewController.fail(res, error);
    }
  };

  getByUser = async (req: Request, res: Response) => {
    try {
      const query = req.query as unknown as ReviewQueryDto;
      const { items, totalItems, page, limit } = await this.reviewService.findByRevieweeId(
        req.params.userId as string,
        query,
      );
      return res.status(200).json(
        paginatedResponse(REVIEW_MESSAGE.GET_ALL_SUCCESS, items, page, limit, totalItems),
      );
    } catch (error: any) {
      return ReviewController.fail(res, error);
    }
  };

  getSummaryByUser = async (req: Request, res: Response) => {
    try {
      const summary = await this.reviewService.getSummaryByRevieweeId(req.params.userId as string);
      return res.status(200).json(
        apiResponse('success', REVIEW_MESSAGE.GET_SUMMARY_SUCCESS, summary),
      );
    } catch (error: any) {
      return ReviewController.fail(res, error);
    }
  };

  getForAdmin = async (req: Request, res: Response) => {
    try {
      const query = req.query as unknown as AdminReviewQueryDto;
      const { items, totalItems, page, limit } = await this.reviewService.findForAdmin(query);
      return res.status(200).json(
        paginatedResponse(REVIEW_MESSAGE.GET_ALL_SUCCESS, items, page, limit, totalItems),
      );
    } catch (error: any) {
      return ReviewController.fail(res, error);
    }
  };

  updateStatus = async (req: CustomRequest<UpdateReviewStatusDto>, res: Response) => {
    try {
      const result = await this.reviewService.updateStatus(req.params.id as string, req.body.status);
      return res.status(200).json(apiResponse('success', 'Review status updated', result));
    } catch (error: any) {
      return ReviewController.fail(res, error);
    }
  };

  createReply = async (req: CustomRequest<CreateReviewReplyDto>, res: Response) => {
    try {
      const reply = await this.reviewService.createReply(
        req.params.id as string,
        req.idUser!,
        req.body,
      );
      return res.status(201).json(
        apiResponse('success', REVIEW_MESSAGE.REPLY_SUCCESS, reply),
      );
    } catch (error: any) {
      return ReviewController.fail(res, error);
    }
  };
}
