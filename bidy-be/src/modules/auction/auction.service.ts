import { DataSource, Repository, EntityManager, In, Not, FindOptionsWhere } from 'typeorm';
import { Auction } from './entity/auctions.entity.js';
import { BidHistory } from './entity/bid-history.entity.js';
import { AutoBidConfig } from './entity/auto-bid-config.entity.js';
import { Product } from '../product/entities/product.entity.js';
import { ProductImage } from '../product/entities/product-image.entity.js';
import { Order } from '../order/entity/order.entity.js';
import { Address } from '../../common/entity/address.entity.js';
import { fileService } from '../file/file.provider.js';
import { AuctionStatus } from './enum/auction-status.enum.js';
import { OrderStatus } from '../order/enum/order-status.enum.js';
import VNTimeUtils from '../../common/util/vnTimezone.js';
import { ProductCondition } from '../product/enums/product-condition.enum.js';
import { ProductStatus } from '../product/enums/product-status.enum.js';
import { CategoryService } from '../category/category.service.js';
import { ProductService } from '../product/product.service.js';
import { AuctionSortField } from './dtos/auction-query.dto.js';
import { escapeLike } from '../../common/util/sql-like.js';
import bidHistoryService from './bid-history.service.js';
import auctionWebSocketService from './auction-websocket.service.js';
import auctionStatusService from './auction-status.service.js';
import { computeMinNextBid } from './auction-pricing.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { notificationService } from '../notification/notification.service.js';
import { logger } from '../../common/util/logger.js';

/**
 * Fields that describe the product rather than the sale. With `product_id` these
 * already have values on the product, so accepting them here would mean either
 * ignoring the caller or editing a product through the auction endpoint.
 */
const PRODUCT_OWNED_FIELDS = ['name', 'category_id', 'description', 'condition'] as const;

/** Filter and ordering carried from AuctionQueryDto into the listing queries. */
export interface AuctionListQuery {
  status?: AuctionStatus;
  sortBy?: AuctionSortField;
  sortOrder?: 'asc' | 'desc';
  /** Narrows the list to one seller's auctions, for a public storefront. */
  sellerId?: string;
  /**
   * Statuses a storefront must never show whatever the caller asks for. Kept on the
   * server rather than left to the client: a public listing whose safety depends on
   * the caller remembering a filter eventually leaks.
   */
  excludeStatuses?: AuctionStatus[];
}

/** Options carried from AuctionBidDto when the bidder arms proxy bidding. */
export interface AutoBidOptions {
  isAuto?: boolean;
  limitBid?: number;
}

/**
 * Turns off every proxy bid a user has running, across all auctions.
 *
 * Disconnecting a banned user's sockets does not stop them bidding: proxy bidding
 * is resolved server-side inside placeBid, so an armed auto-bid keeps countering
 * rivals on behalf of someone who is no longer allowed on the platform — and wins
 * them auctions they cannot pay for. Takes the caller's EntityManager so the ban
 * and the disarming commit or roll back together.
 *
 * Mirrors disableAutoBid: the config rows are deactivated rather than deleted, and
 * every auction that loses its last active config has hasActiveAutoBid recomputed.
 */
export const deactivateUserAutoBids = async (manager: EntityManager, userId: string) => {
  const configs = await manager.find(AutoBidConfig, { where: { userId, isActive: true } });
  if (configs.length === 0) return { deactivated: 0, auctionIds: [] as string[] };

  const auctionIds = [...new Set(configs.map((config) => config.auctionId))];

  await manager
    .createQueryBuilder()
    .update(AutoBidConfig)
    .set({ isActive: false })
    .where('user_id = :userId', { userId })
    .andWhere('is_active = true')
    .execute();

  // The flag is a denormalised cache of "this auction still has an active config",
  // so it has to be recomputed per auction rather than simply cleared.
  for (const auctionId of auctionIds) {
    const remaining = await manager.count(AutoBidConfig, { where: { auctionId, isActive: true } });
    await manager.update(Auction, auctionId, { hasActiveAutoBid: remaining > 0 });
  }

  return { deactivated: configs.length, auctionIds };
};

export class AuctionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auctionRepo: Repository<Auction>,
    private readonly bidHistoryRepo: Repository<BidHistory>,
    private readonly productRepo: Repository<Product>,
    private readonly orderRepo: Repository<Order>,
    private readonly categoryService: CategoryService,
    // Product rules (publishable, has images, not already on the block) live in
    // ProductService; reimplementing them here would let the two paths drift.
    private readonly productService: ProductService,
  ) {}

  /**
   * Phase 3: Product <-> Auction Boundary
   * Atomic listing creation (Product + Auction + Images)
   */
  async listingAuction(productData: any, userId: string, role: string = 'user') {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const now = VNTimeUtils.getCurrentVNTime().toDate();
      const startDate = productData.start_date ? new Date(productData.start_date) : now;
      const endDate = productData.end_date ? new Date(productData.end_date) : VNTimeUtils.createEndDateFromDuration(startDate, productData.durationDays || 7);
      
      const status = startDate <= now ? AuctionStatus.HAPPENING : AuctionStatus.PENDING;

      // 1. Resolve the product being auctioned.
      //
      // `product_id` lets a seller auction something already curated under
      // /me/products — description, images and category are managed there, so
      // nothing is re-entered here and no duplicate product row is created.
      // Omitting it keeps the original one-shot path, where the auction form
      // carries the product fields itself.
      let product: Product;

      if (productData.product_id) {
        // Sending a product field alongside product_id means the caller expected it
        // to take effect. Ignoring it would let a seller "rename" their listing here
        // and then see the old name everywhere — the same silent-drop trap the
        // controller's images check avoids, refused the same way rather than
        // swallowed.
        const conflicting = PRODUCT_OWNED_FIELDS.filter(
          (field) => productData[field] !== undefined && String(productData[field]).trim() !== '',
        );
        if (conflicting.length > 0) {
          throw new AppError(
            `These fields belong to the product and cannot be set here: ${conflicting.join(', ')}. ` +
              'Edit them via PATCH /api/v1/products/:id.',
            400,
          );
        }

        product = await this.productService.assertAuctionable(
          String(productData.product_id),
          userId,
          role,
        );
      } else {
        // Generate a simple slug for the product to satisfy the entity constraint
        const rawName = productData.name || 'Untitled';
        const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

        product = manager.create(Product, {
          ownerId: userId,
          categoryId: productData.category_id,
          name: rawName,
          slug: slug,
          description: productData.description || '',
          condition: productData.condition || ProductCondition.NEW,
          status: ProductStatus.ACTIVE,
        });
        await manager.save(Product, product);
      }

      // 2. Create Auction
      const auction = manager.create(Auction, {
        productId: product.id,
        startingPrice: productData.starting_price,
        currentPrice: productData.starting_price,
        buyNowPrice: productData.buy_now_price || null,
        reservePrice: productData.reserve_price || null,
        bidIncrement: productData.bid_increment || 1.00,
        quantity: productData.quantity ?? 1,
        status,
        startDate: startDate,
        endDate: endDate
      });
      await manager.save(Auction, auction);

      // 3. Attach uploaded images. The controller registers the uploads and passes
      // file ids; this used to receive object keys and write them into image_url,
      // which is how that column ended up holding keys for auction-created products.
      //
      // Skipped for an existing product: its images are managed through
      // /products/:id/images, and the controller rejects uploads sent alongside
      // product_id rather than silently dropping them.
      if (!productData.product_id && productData.images && Array.isArray(productData.images)) {
        const imagesToSave = productData.images.map((fileId: string, index: number) => {
          return manager.create(ProductImage, {
            productId: product.id,
            fileId,
            isPrimary: index === 0,
            displayOrder: index
          });
        });
        await manager.save(ProductImage, imagesToSave);
      }

      return auction;
    });
  }

  /**
   * Attaches a freshly signed `imageUrl` to every product image in a payload.
   *
   * `product_images` stopped carrying a URL when images moved behind the `files`
   * table, and only the auction detail endpoint was updated at the time — every
   * list endpoint kept returning rows with a `fileId` and nothing renderable. This
   * is the one place that repairs them, so a new listing query cannot forget again.
   *
   * Signing is local crypto, and the whole page is signed in one pass.
   */
  private async attachImageUrls<T>(auctions: T[]): Promise<T[]> {
    const images = auctions.flatMap((auction: any) => (auction?.product?.images ?? []) as any[]);
    const urls = await fileService.urlsOf(images.map((image) => image.file));

    // Mutated rather than rebuilt: these payloads carry the whole auction entity and
    // reshaping them here would silently drop fields callers already read.
    images.forEach((image, index) => { image.imageUrl = urls[index]; });

    return auctions;
  }

  /**
   * Takes the pessimistic row lock on an auction, then loads it with its product.
   *
   * Split into two statements on purpose: TypeORM renders `relations` as LEFT JOINs,
   * and Postgres rejects `FOR UPDATE` against the nullable side of an outer join
   * ("FOR UPDATE cannot be applied to the nullable side of an outer join"). Locking
   * the bare auction row first keeps the guarantee while letting the second query
   * join freely — both run in the same transaction, so nothing can slip in between.
   * Only the auction row is locked; products stay free for concurrent seller edits.
   */
  private async lockAuction(manager: EntityManager, auctionId: string) {
    const locked = await manager.query(
      'SELECT id FROM auctions WHERE id = $1 FOR UPDATE',
      [auctionId],
    );
    if (locked.length === 0) return null;

    return await manager.findOne(Auction, {
      where: { id: auctionId },
      relations: { product: true },
    });
  }

  /**
   * Phase 6: Atomic Bidding Transaction
   *
   * Arming proxy bidding, placing the bid and letting rival proxies counter all
   * happen under the same pessimistic row lock, so two concurrent bidders can
   * never resolve against a stale current_price.
   */
  async auctionBid(auctionId: string, userId: string, amount: number, autoBid: AutoBidOptions = {}) {
    const result = await this.dataSource.transaction((manager: EntityManager) =>
      this.placeBid(manager, auctionId, userId, amount, autoBid));

    await this.notifyBidPlaced(auctionId, result);
    return result;
  }

  /**
   * Arms proxy bidding without the caller naming a price.
   *
   * Runs the ordinary bid path at exactly the current minimum, so the ceiling is
   * the only thing the client sends and the server alone decides the amount —
   * the client cannot compute it in advance without racing whoever bids next.
   */
  async enableAutoBid(auctionId: string, userId: string, limitBid: number) {
    const result = await this.dataSource.transaction((manager: EntityManager) =>
      this.placeBid(manager, auctionId, userId, null, { isAuto: true, limitBid }));

    await this.notifyBidPlaced(auctionId, result);
    return result;
  }

  /**
   * Bid, proxy arming and rival counter-bids all resolve under one row lock, so
   * two concurrent bidders can never settle against a stale current_price.
   *
   * `amount` of null means "whatever the minimum is right now", read inside the
   * lock — that is what lets enableAutoBid avoid a client-side price calculation.
   */
  private async placeBid(
    manager: EntityManager,
    auctionId: string,
    userId: string,
    requestedAmount: number | null,
    autoBid: AutoBidOptions = {},
  ) {
      const auction = await this.lockAuction(manager, auctionId);

      if (!auction) throw new Error('Auction not found');
      if (auction.product.ownerId === userId) throw new Error('Seller cannot bid on their own auction');
      if (auction.status !== AuctionStatus.HAPPENING) throw new Error('Auction is not currently active');

      const now = new Date();
      if (now < auction.startDate) throw new Error('Auction has not started yet');
      if (now >= auction.endDate) throw new Error('Auction has ended');

      // Same helper the detail response and socket payload render, so a client can
      // never be shown a minimum the server then rejects.
      const minNextBid = computeMinNextBid(auction);
      const amount = requestedAmount ?? minNextBid;
      if (amount < minNextBid) {
         throw new Error(`Bid must be at least ${minNextBid}`);
      }

      // Arm/refresh this bidder's proxy config before resolving, so their own
      // ceiling defends them in the very same round.
      let ownConfig: AutoBidConfig | null = null;
      if (autoBid.isAuto) {
        if (!autoBid.limitBid || Number(autoBid.limitBid) < amount) {
          throw new Error('Auto-bid limit must be greater than or equal to the bid amount');
        }
        ownConfig = await this.upsertAutoBidConfig(manager, auctionId, userId, Number(autoBid.limitBid));
      }

      // Read before this bid lands, under the same lock: whoever led until now is
      // who gets told they were outbid. After the insert the answer is always the
      // new bidder.
      const [previousLeader] = await manager.query(
        `SELECT user_id FROM bid_history WHERE auction_id = $1
         ORDER BY amount DESC, created_at ASC LIMIT 1`,
        [auctionId],
      );
      const previousLeaderId = previousLeader?.user_id ? String(previousLeader.user_id) : null;

      // The bid the user actually asked for.
      const bid = manager.create(BidHistory, {
        auctionId: auctionId,
        userId: userId,
        amount: amount,
        actionType: 'place_bid',
        position: 1,
      });
      await manager.save(BidHistory, bid);

      const settlement = await this.resolveAutoBids(manager, auction, userId, amount, ownConfig);

      auction.currentPrice = settlement.price;

      // Extend time if bid in last 30 seconds
      const thirtySecondsBefore = new Date(auction.endDate.getTime() - 30 * 1000);
      if (now >= thirtySecondsBefore) {
        auction.endDate = new Date(auction.endDate.getTime() + 30 * 1000);
      }

      auction.hasActiveAutoBid = await manager.count(AutoBidConfig, {
        where: { auctionId, isActive: true }
      }) > 0;

      // Recomputed rather than incremented: resolveAutoBids above may have written
      // any number of proxy counter-bids, and the row lock makes this exact.
      const [counters] = await manager.query(
        `SELECT COUNT(*)::int AS total_bids, COUNT(DISTINCT user_id)::int AS bidder_count
         FROM bid_history WHERE auction_id = $1`,
        [auctionId],
      );
      auction.totalBids = counters.total_bids;
      auction.bidderCount = counters.bidder_count;

      await manager.save(Auction, auction);

      // Broadcasting should happen AFTER transaction commits
      return {
        success: true,
        auction,
        bid,
        leaderId: settlement.leaderId,
        previousLeaderId,
        autoBid: settlement.autoBid,
      };
  }

  /**
   * Post-commit, so a rolled-back bid never notifies anyone — the same reason the
   * socket broadcast waits. Failure here must not fail the bid: the money decision
   * is already durable, and a missing notification is not worth undoing it.
   */
  private async notifyBidPlaced(auctionId: string, result: any) {
    try {
      const bidNotifications = notificationService.createBidNotifications();
      const winning = result.autoBid ?? result.bid;
      const leaderId = String(result.leaderId ?? winning.userId);
      const amount = Number(winning.amount);

      if (result.previousLeaderId && result.previousLeaderId !== leaderId) {
        await bidNotifications.bidOutbid(auctionId, result.previousLeaderId, amount, leaderId);
      }
      await bidNotifications.newBidReceived(auctionId, { amount }, leaderId);
    } catch (error: any) {
      logger.warn('[Auction] Bid placed but notifications failed: ' + error.message);
    }
  }

  /** Proxy state for the asking user only — a rival's ceiling must never leak. */
  async getAutoBid(auctionId: string, userId: string) {
    const [auction, config] = await Promise.all([
      this.auctionRepo.findOne({ where: { id: auctionId } }),
      this.dataSource.getRepository(AutoBidConfig).findOne({ where: { auctionId, userId } }),
    ]);

    if (!auction) throw new Error('Auction not found');

    return {
      isActive: config?.isActive ?? false,
      limitBid: config ? Number(config.limitBid) : null,
      currentAmount: Number(auction.currentPrice) || Number(auction.startingPrice),
      minNextBid: computeMinNextBid(auction),
    };
  }

  /** One proxy config per (auction, user) — re-arming updates the ceiling in place. */
  private async upsertAutoBidConfig(manager: EntityManager, auctionId: string, userId: string, limitBid: number) {
    const repo = manager.getRepository(AutoBidConfig);
    const existing = await repo.findOne({ where: { auctionId, userId } });

    if (existing) {
      existing.limitBid = limitBid;
      existing.isActive = true;
      return await repo.save(existing);
    }

    return await repo.save(repo.create({ auctionId, userId, limitBid, isActive: true }));
  }

  /**
   * Settles proxy bidding for a freshly placed bid and returns the resulting price
   * and leader.
   *
   * The winner is decided in one step rather than by replaying the increment ladder
   * bid-by-bid: the highest ceiling wins at one increment above the runner-up's
   * ceiling (capped at its own), which is the price the ladder would converge on
   * anyway. Ties go to the older config — the standard proxy-auction rule.
   */
  private async resolveAutoBids(
    manager: EntityManager,
    auction: Auction,
    challengerId: string,
    amount: number,
    ownConfig: AutoBidConfig | null,
  ) {
    const increment = Number(auction.bidIncrement);

    // Highest ceiling among *other* bidders — the partial index on
    // (auction_id, limit_bid, created_at) WHERE is_active serves this directly.
    const rival = await manager.getRepository(AutoBidConfig)
      .createQueryBuilder('config')
      .where('config.auction_id = :auctionId', { auctionId: auction.id })
      .andWhere('config.is_active = true')
      .andWhere('config.user_id != :challengerId', { challengerId })
      .orderBy('config.limit_bid', 'DESC')
      .addOrderBy('config.created_at', 'ASC')
      .limit(1)
      .getOne();

    if (!rival || Number(rival.limitBid) <= amount) {
      // Nobody can counter. Any rival that can no longer reach the price is spent.
      await this.deactivateOutrangedConfigs(manager, auction.id, amount, challengerId);
      return { price: amount, leaderId: challengerId, autoBid: null as BidHistory | null };
    }

    const rivalLimit = Number(rival.limitBid);
    const challengerCeiling = ownConfig ? Math.max(amount, Number(ownConfig.limitBid)) : amount;

    if (rivalLimit >= challengerCeiling) {
      // Rival's proxy takes the lead at one increment over what the challenger can reach.
      const price = Math.min(rivalLimit, challengerCeiling + increment);
      const autoBid = await this.postAutoBid(manager, auction.id, rival, price);
      if (ownConfig) {
        ownConfig.isActive = false;
        await manager.save(AutoBidConfig, ownConfig);
      }
      return { price, leaderId: rival.userId, autoBid };
    }

    // Challenger's own proxy defends and stays on top.
    const price = Math.min(challengerCeiling, rivalLimit + increment);
    const autoBid = ownConfig && price > amount
      ? await this.postAutoBid(manager, auction.id, ownConfig, price)
      : null;

    rival.isActive = false;
    await manager.save(AutoBidConfig, rival);

    return { price, leaderId: challengerId, autoBid };
  }

  private async postAutoBid(manager: EntityManager, auctionId: string, config: AutoBidConfig, price: number) {
    const autoBid = manager.create(BidHistory, {
      auctionId,
      userId: config.userId,
      amount: price,
      actionType: 'auto_bid',
      position: 1,
      metadata: { auto_bid_config_id: config.id, limit_bid: Number(config.limitBid) },
    });
    return await manager.save(BidHistory, autoBid);
  }

  /** A config whose ceiling no longer clears the current price can never win again. */
  private async deactivateOutrangedConfigs(manager: EntityManager, auctionId: string, price: number, exceptUserId: string) {
    await manager.getRepository(AutoBidConfig)
      .createQueryBuilder()
      .update(AutoBidConfig)
      .set({ isActive: false })
      .where('auction_id = :auctionId', { auctionId })
      .andWhere('is_active = true')
      .andWhere('user_id != :exceptUserId', { exceptUserId })
      .andWhere('limit_bid <= :price', { price })
      .execute();
  }

  /** Lets a bidder stop proxy bidding without losing their existing manual bids. */
  async disableAutoBid(auctionId: string, userId: string) {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const config = await manager.findOne(AutoBidConfig, { where: { auctionId, userId } });
      if (!config || !config.isActive) throw new Error('No active auto-bid on this auction');

      config.isActive = false;
      await manager.save(AutoBidConfig, config);

      const remaining = await manager.count(AutoBidConfig, { where: { auctionId, isActive: true } });
      await manager.update(Auction, auctionId, { hasActiveAutoBid: remaining > 0 });

      return { success: true };
    });
  }

  /**
   * Phase 8: Order Creation & Address Resolution
   */
  async buyNow(auctionId: string, userId: string) {
    const order = await this.dataSource.transaction(async (manager: EntityManager) => {
      const auction = await this.lockAuction(manager, auctionId);

      if (!auction) throw new Error('AUCTION_NOT_FOUND');
      if (!auction.buyNowPrice) throw new Error('BUY_NOW_NOT_AVAILABLE');
      if (auction.status !== AuctionStatus.HAPPENING) throw new Error('AUCTION_NOT_ACTIVE');
      if (auction.product.ownerId === userId) throw new Error('SELLER_CANNOT_BUY');

      // Bidding past the buy-now price makes the offer stale: honouring it would hand
      // the item over below what the auction has already been bid up to, and would rank
      // the buyer below the standing bidders in the auction's own history.
      if (Number(auction.buyNowPrice) < Number(auction.currentPrice)) {
        throw new Error('BUY_NOW_PRICE_EXCEEDED');
      }

      // Resolve Address
      // Entity property names, not column names — `user_id`/`is_default` do not exist
      // at the property level and made TypeORM reject the query outright.
      const address = await manager.findOne(Address, {
        where: { userId, isDefault: true }
      });
      // Never invented: the order ships somewhere real or it is not created.
      // Addresses are managed through /api/v1/users/addresses.
      if (!address) throw new Error('MISSING_SHIPPING_ADDRESS');

      auction.status = AuctionStatus.ENDED as any;
      auction.endDate = new Date();
      // The auction is closed, so no proxy can bid again; the flag must agree with that.
      auction.hasActiveAutoBid = false;
      await manager.save(Auction, auction);

      const order = manager.create(Order, {
        auction_id: auction.id,
        buyer_id: userId,
        seller_id: auction.product.ownerId, // Strict seller mapping
        shipping_address_id: address.id,
        final_price: auction.buyNowPrice,
        total_amount: auction.buyNowPrice,
        shipping_fee: 0,
        payment_status: 'pending',
        shipping_status: 'pending',
        payment_deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      });
      await manager.save(Order, order);

      return order;
    });

    // Logged after commit: logBuyNow writes on its own connection, so running it
    // inside the transaction would block on the auction row lock held above.
    // It must also land before finalize, which ranks the buyer from this very row.
    await bidHistoryService.logBuyNow(userId, auctionId, Number(order.final_price));

    // A buy-now ends the auction for everyone else too. Same terminal side effects the
    // scheduled ending performs — losing rows, notifications, proxy shutdown, and the
    // socket event that tells watching clients the auction is closed.
    await auctionStatusService.finalizeEndedAuction(auctionId, userId);

    return order;
  }

  /**
   * Phase 5: Core Queries
   */
  async getProductById(id: string) {
    const auction = await this.auctionRepo.findOne({
      where: { id },
      relations: { product: { category: true, images: { file: true } }, bids: { user: true } }
    });
    
    if (!auction) return null;

    // `bids` is deliberately not returned. The relation carries a full User per row —
    // email, phone, account state — and this route is public and polled, so it was
    // publishing every bidder's contact details. top_ownerships below is the mapped,
    // safe view of the same rows, and it is what clients actually read.
    const { bids, ...auctionFields } = auction;

    // Formatting for backward compatibility if needed by frontend
    const top_ownerships = bids.map(bid => ({
      user_id: bid.userId,
      user_name: bid.user?.username,
      amount: bid.amount,
      createdAt: bid.createdAt
    })).sort((a, b) => Number(b.amount) - Number(a.amount));

    return {
      ...auctionFields,
      _id: auction.id,
      name: auction.product?.name,
      description: auction.product?.description,
      price: auction.startingPrice,
      priceBuyNow: auction.buyNowPrice,
      category: auction.product?.category,
      image: await fileService.urlsOf(auction.product?.images?.map(img => img.file) ?? []),
      // Parallel to `image`: every presigned URL ships with the id that re-signs it,
      // so a client holding a stale URL never has to refetch the whole auction.
      imageFileIds: auction.product?.images?.map(img => img.fileId) ?? [],
      owner: { _id: auction.product?.ownerId },
      // Snapshot, not a promise: a rival bid moments later moves it. The client uses
      // it to prefill and pre-validate; auctionBid() re-checks with the row locked.
      minNextBid: computeMinNextBid(auction),
      top_ownerships
    };
  }

  async getProductByCategory(categoryId: string, query: AuctionListQuery = {}, pageNumber: number = 1, limitNumber: number = 15) {
    const skip = (pageNumber - 1) * limitNumber;

    // A parent category covers its whole subtree — products hang off the leaves.
    const categoryIds = await this.categoryService.findDescendantIds(categoryId);
    if (categoryIds.length === 0) return { items: [], total: 0 };

    const [data, totalCount] = await this.auctionRepo.findAndCount({
      where: { ...(query.status ? { status: query.status } : {}), product: { categoryId: In(categoryIds) } } as any,
      relations: { product: { category: true, images: { file: true } } },
      skip,
      take: limitNumber,
      order: this.buildListOrder(query)
    });

    return { items: await this.attachImageUrls(data), total: totalCount };
  }

  async getMyAuction(userId: string, pageNumber: number = 1, limitNumber: number = 15) {
    const skip = (pageNumber - 1) * limitNumber;

    // Phase 5 rule: Seller ownership qua auction.product.ownerId
    const [data, totalCount] = await this.auctionRepo.findAndCount({
      where: { product: { ownerId: userId } } as any,
      relations: { product: { category: true, images: { file: true } } },
      skip,
      take: limitNumber,
      order: { createdAt: 'DESC' }
    });

    return {
      auction: await this.attachImageUrls(data),
      totalAuctions: totalCount,
      totalPages: Math.ceil(totalCount / limitNumber),
      currentPage: pageNumber
    };
  }

  // --- Restored Legacy Endpoints ---

  /**
   * Lets a seller withdraw their own auction — but only while nobody has bid.
   *
   * Bidders commit against the closing time the listing advertised, so letting a
   * seller cut a contested auction short would hand them the choice of when to stop
   * the price. With no bids there is nobody to disadvantage, and a seller who listed
   * by mistake needs a way out. Ended and already-cancelled auctions are not
   * withdrawable at all.
   *
   * Admins go through the admin route instead, which has no bid precondition.
   */
  async cancelMyAuction(auctionId: string, userId: string) {
    const auction = await this.auctionRepo.findOne({
      where: { id: auctionId },
      relations: { product: true },
    });

    if (!auction) throw new Error('AUCTION_NOT_FOUND');

    // Not-owner reads as not-found: whether an auction id exists is not something a
    // stranger needs confirmed.
    if (String(auction.product?.ownerId) !== String(userId)) throw new Error('AUCTION_NOT_FOUND');

    if (auction.status !== AuctionStatus.PENDING && auction.status !== AuctionStatus.HAPPENING) {
      throw new Error('AUCTION_NOT_CANCELLABLE');
    }

    // totalBids is a denormalised counter, so the bid rows are the authority here —
    // cancelling a contested auction because a counter drifted is not recoverable.
    const bids = await this.bidHistoryRepo.count({ where: { auctionId: auction.id } });
    if (bids > 0) throw new Error('AUCTION_HAS_BIDS');

    auction.status = AuctionStatus.CANCELLED;
    await this.auctionRepo.save(auction);

    return { id: auction.id, status: auction.status };
  }

  async deleteMyAuction(auctionId: string, userId: string) {
    const auction = await this.auctionRepo.findOne({
      where: { id: auctionId, product: { ownerId: userId } },
      relations: { product: true }
    });

    if (!auction) return null;
    
    // Only allow deletion if pending or happening with no bids
    if (auction.status === AuctionStatus.ENDED || auction.status === AuctionStatus.CANCELLED) {
      throw new Error('Cannot delete ended or cancelled auction');
    }

    if (auction.status === AuctionStatus.HAPPENING) {
      const bids = await this.bidHistoryRepo.count({ where: { auctionId: auction.id } });
      if (bids > 0) throw new Error('Cannot delete auction with active bids');
    }

    await this.auctionRepo.delete(auction.id);
    if (auction.product) {
      await this.productRepo.delete(auction.product.id);
    }
    return true;
  }

  async updateProduct(auctionId: string, productData: any, userId: string) {
    const auction = await this.auctionRepo.findOne({
      where: { id: auctionId, product: { ownerId: userId } },
      relations: { product: true }
    });

    if (!auction || !auction.product) return null;

    if (auction.status !== AuctionStatus.PENDING) {
      throw new Error('Can only update pending auctions');
    }

    if (productData.name) auction.product.name = productData.name;
    if (productData.description) auction.product.description = productData.description;
    if (productData.category_id) auction.product.categoryId = productData.category_id;
    if (productData.condition) auction.product.condition = productData.condition;

    if (productData.starting_price !== undefined) {
      auction.startingPrice = productData.starting_price;
      auction.currentPrice = productData.starting_price;
    }
    if (productData.buy_now_price !== undefined) auction.buyNowPrice = productData.buy_now_price;
    if (productData.reserve_price !== undefined) auction.reservePrice = productData.reserve_price;
    if (productData.bid_increment !== undefined) auction.bidIncrement = productData.bid_increment;
    // Only reachable while the auction is still PENDING (guarded above), so no one
    // has bid on the old lot size yet — changing it later would be a bait-and-switch.
    //
    // This route has no DTO validation, so the check is here rather than left to the
    // chk_auctions_quantity_positive constraint: the constraint keeps the table
    // correct, but surfaces as an opaque driver error instead of a usable message.
    if (productData.quantity !== undefined) {
      const quantity = Number(productData.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error('quantity must be a whole number of at least 1');
      }
      auction.quantity = quantity;
    }
    if (productData.start_date) auction.startDate = new Date(productData.start_date);
    if (productData.end_date) auction.endDate = new Date(productData.end_date);

    await this.productRepo.save(auction.product);
    await this.auctionRepo.save(auction);
    return auction;
  }

  async viewCart(userId: string) {
    const orders = await this.orderRepo.find({
      where: { buyer_id: userId, payment_status: OrderStatus.PENDING },
      relations: { auction: { product: true } }
    });
    return orders;
  }

  /**
   * Snapshot behind `GET /auctions/{id}/bidders`, and the same payload the
   * `bidderUpdate` socket event pushes — one shape, one parser on the client.
   * Works for ended auctions too: it reads bid history, not auction status.
   */
  async getBidders(auctionId: string) {
    const stats = await bidHistoryService.getBidderStats(auctionId);
    return { ...stats, watcherCount: auctionWebSocketService.getWatcherCount(auctionId) };
  }

  /**
   * Explicit sortBy wins; otherwise finished auctions read as a history — newest
   * first — and live or upcoming ones as a queue, closing soonest first. sortBy is
   * whitelisted by AUCTION_SORT_FIELDS, so it can never inject an arbitrary column.
   */
  private buildListOrder({ status, sortBy, sortOrder }: AuctionListQuery) {
    if (sortBy) {
      return { [sortBy]: (sortOrder ?? 'desc').toUpperCase() as 'ASC' | 'DESC' };
    }

    return status === AuctionStatus.ENDED
      ? { endDate: 'DESC' as const }
      : { endDate: 'ASC' as const };
  }

  async getAuctions(query: AuctionListQuery = {}, pageNumber: number = 1, limitNumber: number = 15) {
    const skip = (pageNumber - 1) * limitNumber;

    const where: FindOptionsWhere<Auction> = {};

    if (query.status) {
      where.status = query.excludeStatuses?.includes(query.status)
        ? // Asking for an excluded status explicitly must return nothing rather than
          // quietly widening the list to every status.
          In([] as AuctionStatus[])
        : query.status;
    } else if (query.excludeStatuses?.length) {
      where.status = Not(In(query.excludeStatuses));
    }

    if (query.sellerId) {
      where.product = { ownerId: query.sellerId };
    }

    const [auctions, total] = await this.auctionRepo.findAndCount({
      where,
      relations: { product: { owner: true, images: { file: true } } },
      order: this.buildListOrder(query),
      take: limitNumber,
      skip: skip,
    });

    // The owner row is joined only so the card can show the seller's name. It is
    // narrowed to id + username here because the full User entity carries email,
    // phone and address, and this endpoint is public.
    auctions.forEach((auction) => {
      if (auction.product?.owner) {
        auction.product.owner = { id: auction.product.owner.id, username: auction.product.owner.username } as any;
      }
    });

    return { items: await this.attachImageUrls(auctions), total };
  }

  /**
   * Feeds the header search dropdown, so it returns a small capped slice rather
   * than a page: `total` exists only so the client can offer "see all N results".
   */
  async getProductBySearch(keyword: string, status?: AuctionStatus, limitNumber: number = 10) {
    // Binding stops injection but not wildcards — an unescaped '%' would match every
    // product in the table.
    const pattern = `%${escapeLike(keyword.trim())}%`;

    const query = this.auctionRepo.createQueryBuilder('auction')
      .leftJoinAndSelect('auction.product', 'product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('images.file', 'imagesFile')
      .where('(product.name ILIKE :keyword OR product.description ILIKE :keyword)', { keyword: pattern });

    if (status) {
      query.andWhere('auction.status = :status', { status });
    } else {
      // A suggestion is only useful if the user can still bid on it.
      query.andWhere('auction.status IN (:...statuses)', {
        statuses: [AuctionStatus.HAPPENING, AuctionStatus.PENDING],
      });
    }

    const [auctions, total] = await query
      .orderBy('auction.endDate', 'ASC')
      .take(limitNumber)
      .getManyAndCount();

    return { items: await this.attachImageUrls(auctions), total };
  }

  async getAuctionUserBought(userId: string, pageNumber: number = 1, limitNumber: number = 15) {
    const skip = (pageNumber - 1) * limitNumber;
    const [orders, total] = await this.orderRepo.findAndCount({
      where: { buyer_id: userId },
      relations: { auction: { product: { images: { file: true } } } },
      order: { created_at: 'DESC' },
      take: limitNumber,
      skip: skip,
    });
    // Orders nest the auction, so the images sit one level deeper.
    await this.attachImageUrls(orders.map((order: any) => order.auction).filter(Boolean));
    return { data: orders, total, page: pageNumber, limit: limitNumber };
  }

  async getAuctionUserSold(userId: string, pageNumber: number = 1, limitNumber: number = 15) {
    const skip = (pageNumber - 1) * limitNumber;
    const [orders, total] = await this.orderRepo.findAndCount({
      where: { seller_id: userId },
      relations: { auction: { product: { images: { file: true } } } },
      order: { created_at: 'DESC' },
      take: limitNumber,
      skip: skip,
    });
    // Orders nest the auction, so the images sit one level deeper.
    await this.attachImageUrls(orders.map((order: any) => order.auction).filter(Boolean));
    return { data: orders, total, page: pageNumber, limit: limitNumber };
  }

  async getUserAuctionByStatus(userId: string, status: string, pageNumber: number = 1, limitNumber: number = 15) {
    const skip = (pageNumber - 1) * limitNumber;
    const [auctions, total] = await this.auctionRepo.findAndCount({
      where: { 
        status: status as any,
        product: { ownerId: userId }
      },
      relations: { product: { images: { file: true } } },
      order: { createdAt: 'DESC' },
      take: limitNumber,
      skip: skip,
    });
    return { data: await this.attachImageUrls(auctions), total, page: pageNumber, limit: limitNumber };
  }
}
