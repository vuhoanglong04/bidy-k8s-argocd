import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuctionRequest } from './entity/auction-request.entity.js';
import { Auction } from './entity/auctions.entity.js';
import { AuctionRequestStatus } from './enum/auction-request-status.enum.js';
import { AuctionStatus } from './enum/auction-status.enum.js';
import { ProductService } from '../product/product.service.js';
import { escapeLike } from '../../common/util/sql-like.js';
import { fileService } from '../file/file.provider.js';
import {
  AuctionRequestQueryDto,
  CreateAuctionRequestDto,
  UpdateAuctionRequestDto,
} from './dtos/auction-request.dto.js';

/**
 * The approval queue between a seller and a live auction.
 *
 * Requests live in their own table rather than as an extra AuctionStatus because the
 * lifecycle cron drives auction statuses off the clock: a `pending_approval` auction
 * would be flipped to `happening` the moment its start date passed, and every public
 * query would have to remember to exclude it. A request that is not an auction until
 * approved cannot leak onto the site that way.
 */

/**
 * Postgres returns numeric columns as strings, so an untouched entity would send
 * `"150000.00"` where the rest of the API sends `150000`. The product's image rows
 * are likewise not something a client can render, so they collapse into one signed
 * URL. Every read goes through here — that is what keeps the two shapes from
 * drifting apart.
 */
async function present(request: AuctionRequest | null): Promise<any> {
  if (!request) return request;

  const product: any = request.product;

  return {
    ...request,
    startingPrice: Number(request.startingPrice),
    buyNowPrice: request.buyNowPrice === null ? null : Number(request.buyNowPrice),
    reservePrice: request.reservePrice === null ? null : Number(request.reservePrice),
    bidIncrement: Number(request.bidIncrement),
    product: product
      ? {
          ...product,
          images: undefined,
          primaryImage: await fileService.urlOf(
            product.images?.find((image: any) => image.isPrimary)?.file ?? product.images?.[0]?.file,
          ),
        }
      : null,
  };
}

const presentMany = (requests: AuctionRequest[]) => Promise.all(requests.map(present));

export class AuctionRequestService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly requestRepo: Repository<AuctionRequest>,
    private readonly productService: ProductService,
  ) {}

  /**
   * Files a request. The product rules are checked here AND again at approval: the
   * product can be edited, deleted or auctioned through another route while the
   * request sits in the queue, so a check at filing time alone proves nothing by the
   * time an admin clicks approve.
   */
  async create(sellerId: string, role: string, dto: CreateAuctionRequestDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) throw new Error('INVALID_DATE_RANGE');

    await this.productService.assertAuctionable(dto.productId, sellerId, role);

    const existing = await this.requestRepo.findOne({
      where: { productId: dto.productId, status: AuctionRequestStatus.PENDING },
    });
    if (existing) throw new Error('REQUEST_ALREADY_PENDING');

    const request = this.requestRepo.create({
      productId: dto.productId,
      sellerId,
      status: AuctionRequestStatus.PENDING,
      quantity: dto.quantity ?? 1,
      startingPrice: dto.startingPrice,
      buyNowPrice: dto.buyNowPrice ?? null,
      reservePrice: dto.reservePrice ?? null,
      bidIncrement: dto.bidIncrement ?? 1.0,
      startDate,
      endDate,
    });

    return await present(await this.requestRepo.save(request));
  }

  async findMine(sellerId: string, query: AuctionRequestQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const [items, totalItems] = await this.requestRepo.findAndCount({
      where: {
        sellerId,
        ...(query.status ? { status: query.status } : {}),
      },
      relations: { product: { images: { file: true } } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items: await presentMany(items), totalItems, page, limit };
  }

  async findForAdmin(query: AuctionRequestQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.requestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.product', 'product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('images.file', 'imagesFile')
      .leftJoinAndSelect('request.seller', 'seller');

    if (query.status) {
      qb.andWhere('request.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      qb.andWhere('product.name ILIKE :search', {
        search: `%${escapeLike(query.search.trim())}%`,
      });
    }

    // Oldest first: a review queue is worked front to back, so the request that has
    // been waiting longest is the one an admin should see first.
    qb.orderBy('request.created_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, totalItems] = await qb.getManyAndCount();

    return { items: await presentMany(items), totalItems, page, limit };
  }

  /** `requesterId` undefined means an admin is reading; a seller sees only their own. */
  async findById(id: string, requesterId?: string) {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: { product: { images: { file: true } }, seller: true },
    });

    if (!request) throw new Error('REQUEST_NOT_FOUND');

    // Not-yours reads as not-found: whether a request id exists is not something a
    // stranger needs confirmed.
    if (requesterId !== undefined && String(request.sellerId) !== String(requesterId)) {
      throw new Error('REQUEST_NOT_FOUND');
    }

    return request;
  }

  /**
   * Read for a response. Separate from findById, which hands back the live entity
   * that update() mutates and saves — presenting that one would break the save.
   */
  async getOne(id: string, requesterId?: string) {
    return await present(await this.findById(id, requesterId));
  }

  /**
   * Edits the terms. Allowed while `pending` only — an approved request is the
   * record of what was agreed, and a rejected one is a closed decision.
   *
   * An admin edits through the same method (requesterId undefined) so that the terms
   * they approve are the terms stored on the row.
   */
  async update(id: string, dto: UpdateAuctionRequestDto, requesterId?: string) {
    const request = await this.findById(id, requesterId);
    if (request.status !== AuctionRequestStatus.PENDING) throw new Error('REQUEST_NOT_PENDING');

    if (dto.quantity !== undefined) request.quantity = dto.quantity;
    if (dto.startingPrice !== undefined) request.startingPrice = dto.startingPrice;
    if (dto.buyNowPrice !== undefined) request.buyNowPrice = dto.buyNowPrice;
    if (dto.reservePrice !== undefined) request.reservePrice = dto.reservePrice;
    if (dto.bidIncrement !== undefined) request.bidIncrement = dto.bidIncrement;
    if (dto.startDate !== undefined) request.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) request.endDate = new Date(dto.endDate);

    if (request.endDate <= request.startDate) throw new Error('INVALID_DATE_RANGE');

    return await present(await this.requestRepo.save(request));
  }

  /** The seller withdraws their own request before anyone has ruled on it. */
  async cancel(id: string, sellerId: string) {
    const request = await this.findById(id, sellerId);
    if (request.status !== AuctionRequestStatus.PENDING) throw new Error('REQUEST_NOT_PENDING');

    request.status = AuctionRequestStatus.CANCELLED;
    await this.requestRepo.save(request);

    return { id: request.id, status: request.status };
  }

  /**
   * Approves a request and creates the auction it described, in one transaction —
   * an approved request without its auction would be a listing the seller believes
   * is live and nobody can find.
   *
   * Takes no body on purpose: an admin who wants different terms edits the request
   * first, so there is exactly one path from stored terms to a live auction, and the
   * row always says what was approved.
   */
  async approve(id: string, adminId: string) {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const request = await manager.findOne(AuctionRequest, { where: { id } });
      if (!request) throw new Error('REQUEST_NOT_FOUND');
      if (request.status !== AuctionRequestStatus.PENDING) throw new Error('REQUEST_NOT_PENDING');

      // Re-checked here, not just at filing time: between the two the product may
      // have been unpublished, deleted, or put on the block through another route.
      // Approving on a stale check is what would produce two live auctions for one
      // item.
      await this.productService.assertAuctionable(request.productId, request.sellerId, 'user');

      const now = new Date();
      const startDate = request.startDate <= now ? now : request.startDate;

      if (request.endDate <= startDate) throw new Error('REQUEST_SCHEDULE_EXPIRED');

      const auction = manager.create(Auction, {
        productId: request.productId,
        startingPrice: request.startingPrice,
        currentPrice: request.startingPrice,
        buyNowPrice: request.buyNowPrice,
        reservePrice: request.reservePrice,
        bidIncrement: request.bidIncrement,
        quantity: request.quantity,
        // A request whose start date has already passed opens immediately rather
        // than sitting pending forever waiting for a moment that is gone.
        status: startDate <= now ? AuctionStatus.HAPPENING : AuctionStatus.PENDING,
        startDate,
        endDate: request.endDate,
      });
      await manager.save(Auction, auction);

      request.status = AuctionRequestStatus.APPROVED;
      request.auctionId = auction.id;
      request.reviewedBy = adminId;
      request.reviewedAt = now;
      await manager.save(AuctionRequest, request);

      return { id: request.id, status: request.status, auctionId: auction.id };
    });
  }

  async reject(id: string, adminId: string, reason: string) {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new Error('REQUEST_NOT_FOUND');
    if (request.status !== AuctionRequestStatus.PENDING) throw new Error('REQUEST_NOT_PENDING');

    request.status = AuctionRequestStatus.REJECTED;
    request.rejectReason = reason;
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    await this.requestRepo.save(request);

    return { id: request.id, status: request.status, rejectReason: request.rejectReason };
  }
}
