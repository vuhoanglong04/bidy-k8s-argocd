import { DataSource, Repository } from 'typeorm';
import { Review } from './entity/review.entity.js';
import { ReviewMedia } from './entity/review-media.entity.js';
import { ReviewReply } from './entity/review-reply.entity.js';
import { Order } from '../order/entity/order.entity.js';
import { OrderStatus } from '../order/enum/order-status.enum.js';
import { CreateReviewDto } from './dtos/create-review.dto.js';
import { CreateReviewReplyDto } from './dtos/create-review-reply.dto.js';
import { ReviewQueryDto } from './dtos/review-query.dto.js';
import { REVIEW_MESSAGE } from '../../common/messages/review/review.message.js';
import { ReviewStatus } from './enum/review-status.enum.js';
import { AdminReviewQueryDto } from './dtos/admin-review.dto.js';

const MAX_PAGE_SIZE = 50;
const UNIQUE_VIOLATION = '23505';

export interface RatingSummary {
  totalReviews: number;
  averageProductRating: number;
  averageShippingRating: number | null;
  averageServiceRating: number | null;
  breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export class ReviewService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly reviewRepository: Repository<Review>,
    private readonly replyRepository: Repository<ReviewReply>,
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * A review is only meaningful once money has changed hands, so the order must
   * be paid and the caller must be the buyer on it. The one-review-per-order rule
   * is enforced by the unique index on reviews.order_id — the pre-check here is
   * only for a friendly error; the constraint is what makes it race-safe.
   */
  async createReview(reviewerId: string, dto: CreateReviewDto): Promise<Review> {
    const order = await this.orderRepository.findOne({ where: { id: dto.orderId } });

    if (!order) {
      throw new Error(REVIEW_MESSAGE.ORDER_NOT_FOUND);
    }

    if (order.buyer_id !== reviewerId) {
      throw new Error(REVIEW_MESSAGE.NOT_ORDER_BUYER);
    }

    if (order.payment_status !== OrderStatus.PAID) {
      throw new Error(REVIEW_MESSAGE.ORDER_NOT_PAID);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const review = manager.getRepository(Review).create({
          orderId: order.id,
          reviewerId,
          revieweeId: order.seller_id,
          productRating: dto.productRating,
          shippingRating: dto.shippingRating ?? null,
          serviceRating: dto.serviceRating ?? null,
          comment: dto.comment ?? null,
          isAnonymous: dto.isAnonymous ?? false,
          status: ReviewStatus.PUBLISHED,
        });

        const saved = await manager.getRepository(Review).save(review);

        if (dto.mediaFileIds?.length) {
          // Files are uploaded first via POST /api/v1/files; the FK is what proves
          // the id refers to a real object rather than an arbitrary number.
          const media = dto.mediaFileIds.map((fileId, index) =>
            manager.getRepository(ReviewMedia).create({
              reviewId: saved.id,
              fileId,
              mediaType: 'image',
              displayOrder: index,
            }),
          );
          await manager.getRepository(ReviewMedia).save(media);
        }

        return saved;
      });
    } catch (error: any) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new Error(REVIEW_MESSAGE.REVIEW_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id, status: ReviewStatus.PUBLISHED },
      relations: { reviewer: true },
    });

    if (!review) {
      throw new Error(REVIEW_MESSAGE.REVIEW_NOT_FOUND);
    }

    return this.stripAnonymous(review);
  }

  /** Public review list for a seller's profile page. */
  async findByRevieweeId(revieweeId: string, query: ReviewQueryDto) {
    const page = query.page ? Number(query.page) : 1;
    const limit = Math.min(query.limit ? Number(query.limit) : 20, MAX_PAGE_SIZE);
    const sortOrder = (query.sortOrder || 'desc').toUpperCase() as 'ASC' | 'DESC';

    const qb = this.reviewRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.reviewer', 'reviewer')
      .where('review.reviewee_id = :revieweeId', { revieweeId })
      .andWhere('review.status = :status', { status: ReviewStatus.PUBLISHED });

    if (query.rating) {
      qb.andWhere('review.product_rating = :rating', { rating: Number(query.rating) });
    }

    qb.orderBy('review.created_at', sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, totalItems] = await qb.getManyAndCount();

    return {
      items: items.map((review) => this.stripAnonymous(review)),
      totalItems,
      page,
      limit,
    };
  }

  /**
   * Back-office listing. Unlike findByRevieweeId this does NOT filter on
   * `published` — an admin who cannot see hidden reviews cannot tell a moderated one
   * from a deleted one, and cannot put it back. It also skips stripAnonymous: an
   * anonymous review still has an author the admin may need to act on.
   */
  async findForAdmin(query: AdminReviewQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, MAX_PAGE_SIZE);

    const qb = this.reviewRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.reviewer', 'reviewer')
      .leftJoinAndSelect('review.reviewee', 'reviewee');

    if (query.status) {
      qb.andWhere('review.status = :status', { status: query.status });
    }

    if (query.revieweeId) {
      qb.andWhere('review.reviewee_id = :revieweeId', { revieweeId: query.revieweeId });
    }

    if (query.reviewerId) {
      qb.andWhere('review.reviewer_id = :reviewerId', { reviewerId: query.reviewerId });
    }

    qb.orderBy('review.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, totalItems] = await qb.getManyAndCount();

    return { items, totalItems, page, limit };
  }

  /**
   * Hides or restores a review. Hiding drops it out of every public read, including
   * the seller's rating summary, because those all filter on `published`.
   */
  async updateStatus(id: string, status: ReviewStatus) {
    const review = await this.reviewRepository.findOne({ where: { id } });
    if (!review) throw new Error(REVIEW_MESSAGE.REVIEW_NOT_FOUND);

    review.status = status;
    await this.reviewRepository.save(review);

    return { id: review.id, status: review.status };
  }

  /** Aggregate ratings for a seller, computed in the database rather than in memory. */
  async getSummaryByRevieweeId(revieweeId: string): Promise<RatingSummary> {
    const row = await this.reviewRepository
      .createQueryBuilder('review')
      .select('COUNT(*)', 'total')
      .addSelect('AVG(review.product_rating)', 'avg_product')
      .addSelect('AVG(review.shipping_rating)', 'avg_shipping')
      .addSelect('AVG(review.service_rating)', 'avg_service')
      .addSelect('COUNT(*) FILTER (WHERE review.product_rating = 1)', 'r1')
      .addSelect('COUNT(*) FILTER (WHERE review.product_rating = 2)', 'r2')
      .addSelect('COUNT(*) FILTER (WHERE review.product_rating = 3)', 'r3')
      .addSelect('COUNT(*) FILTER (WHERE review.product_rating = 4)', 'r4')
      .addSelect('COUNT(*) FILTER (WHERE review.product_rating = 5)', 'r5')
      .where('review.reviewee_id = :revieweeId', { revieweeId })
      .andWhere('review.status = :status', { status: ReviewStatus.PUBLISHED })
      .getRawOne();

    const round = (value: string | null) =>
      value === null ? null : Math.round(Number(value) * 100) / 100;

    return {
      totalReviews: Number(row.total),
      averageProductRating: round(row.avg_product) ?? 0,
      averageShippingRating: round(row.avg_shipping),
      averageServiceRating: round(row.avg_service),
      breakdown: {
        '1': Number(row.r1),
        '2': Number(row.r2),
        '3': Number(row.r3),
        '4': Number(row.r4),
        '5': Number(row.r5),
      },
    };
  }

  /**
   * Only the reviewed seller may reply, and only once — the unique index on
   * review_replies.review_id is what actually prevents a double reply.
   */
  async createReply(reviewId: string, userId: string, dto: CreateReviewReplyDto): Promise<ReviewReply> {
    const review = await this.reviewRepository.findOne({ where: { id: reviewId } });

    if (!review) {
      throw new Error(REVIEW_MESSAGE.REVIEW_NOT_FOUND);
    }

    if (review.revieweeId !== userId) {
      throw new Error(REVIEW_MESSAGE.NOT_REVIEWEE);
    }

    const reply = this.replyRepository.create({
      reviewId: review.id,
      userId,
      comment: dto.comment,
    });

    try {
      return await this.replyRepository.save(reply);
    } catch (error: any) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new Error(REVIEW_MESSAGE.REPLY_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /** Anonymous reviews keep their content but must never leak the reviewer. */
  private stripAnonymous(review: Review): Review {
    if (review.isAnonymous) {
      review.reviewer = undefined as never;
      review.reviewerId = undefined as never;
    }
    return review;
  }
}
