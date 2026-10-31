import { AppDataSource } from '../../database/data-source.js';
import { fileService } from '../file/file.provider.js';
import { PRESIGN_TTL_SECONDS } from '../file/file.service.js';
import { getPresignedUrl } from '../../config/r2.config.js';
import { BidHistory } from './entity/bid-history.entity.js';
import { AuctionStatus } from './enum/auction-status.enum.js';
import { logger } from '../../common/util/logger.js';
import { escapeLike } from '../../common/util/sql-like.js';

/** Bidders carried in a stats payload. Agreed with the client; the totals stay uncapped. */
export const BIDDER_LIST_LIMIT = 20;

export interface AuctionParticipant {
  userId: string;
  amount: number;
}


/**
 * Turns the inclusive `dateTo` a client sends into the exclusive upper bound the
 * query uses.
 *
 * A bare `YYYY-MM-DD` parses to midnight, so comparing `<= dateTo` would drop every
 * bid placed during that day — the user asks for "up to the 20th" and loses the
 * 20th. A full timestamp is honoured as given.
 */
function exclusiveEnd(value: string): Date {
  const parsed = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    parsed.setDate(parsed.getDate() + 1);
  }
  return parsed;
}

class BidHistoryService {
  private async logAction(data: {
    userId: string;
    auctionId: string;
    actionType: string;
    amount: number;
    position?: number | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const repo = AppDataSource.getRepository(BidHistory);
    const history = repo.create({
      userId: data.userId,
      auctionId: data.auctionId,
      actionType: data.actionType,
      amount: data.amount,
      position: data.position ?? null,
      metadata: data.metadata ?? null,
    });
    return await repo.save(history);
  }

  async logManualBid(userId: string, auctionId: string, amount: number, position: number, metadata: Record<string, unknown> = {}) {
    try {
      const history = await this.logAction({
        userId,
        auctionId,
        actionType: 'place_bid',
        amount,
        position,
        metadata,
      });

      logger.info(`[BidHistory] Logged manual bid for user ${userId} on auction ${auctionId}`);
      return history;
    } catch (error) {
      logger.error('[BidHistory] Error logging manual bid:', error);
      return null;
    }
  }

  async logAutoBid(userId: string, auctionId: string, amount: number, position: number, limitBid: number, autoBidConfigId: string) {
    try {
      const history = await this.logAction({
        userId,
        auctionId,
        actionType: 'auto_bid',
        amount,
        position,
        metadata: {
          auto_bid_config_id: autoBidConfigId,
          limit_bid: limitBid,
        },
      });

      logger.info(`[BidHistory] Logged auto bid for user ${userId} on auction ${auctionId}`);
      return history;
    } catch (error) {
      logger.error('[BidHistory] Error logging auto bid:', error);
      return null;
    }
  }

  async logOutbid(userId: string, auctionId: string, previousAmount: number, newPosition: number, outbidBy: string) {
    try {
      const history = await this.logAction({
        userId,
        auctionId,
        actionType: 'outbid',
        amount: previousAmount,
        position: newPosition,
        metadata: {
          outbid_by: outbidBy,
          previous_position: newPosition - 1,
        },
      });

      logger.info(`[BidHistory] Logged outbid for user ${userId} on auction ${auctionId}`);
      return history;
    } catch (error) {
      logger.error('[BidHistory] Error logging outbid:', error);
      return null;
    }
  }

  async logWin(userId: string, auctionId: string, finalAmount: number, totalBidders: number) {
    try {
      const history = await this.logAction({
        userId,
        auctionId,
        actionType: 'won',
        amount: finalAmount,
        position: 1,
        metadata: { total_bidders: totalBidders },
      });

      logger.info(`[BidHistory] Logged win for user ${userId} on auction ${auctionId}`);
      return history;
    } catch (error) {
      logger.error('[BidHistory] Error logging win:', error);
      return null;
    }
  }

  async logLoss(userId: string, auctionId: string, finalAmount: number, finalPosition: number, totalBidders: number) {
    try {
      const history = await this.logAction({
        userId,
        auctionId,
        actionType: 'lost',
        amount: finalAmount,
        position: finalPosition,
        metadata: { total_bidders: totalBidders },
      });

      logger.info(`[BidHistory] Logged loss for user ${userId} on auction ${auctionId}`);
      return history;
    } catch (error) {
      logger.error('[BidHistory] Error logging loss:', error);
      return null;
    }
  }

  async logBuyNow(userId: string, auctionId: string, price: number) {
    try {
      const history = await this.logAction({
        userId,
        auctionId,
        actionType: 'buy_now',
        amount: price,
        position: 1,
      });

      logger.info(`[BidHistory] Logged buy now for user ${userId} on auction ${auctionId}`);
      return history;
    } catch (error) {
      logger.error('[BidHistory] Error logging buy now:', error);
      return null;
    }
  }

  /**
   * Writes the terminal won/lost row for every distinct bidder of an auction.
   * `participants` must already be ranked highest-amount-first.
   */
  async logAuctionEnded(auctionId: string, winnerId: string | null, participants: AuctionParticipant[]) {
    try {
      const promises: Promise<unknown>[] = [];

      participants.forEach((participant, index) => {
        if (winnerId && String(participant.userId) === String(winnerId)) {
          promises.push(this.logWin(winnerId, auctionId, participant.amount, participants.length));
        } else {
          promises.push(this.logLoss(
            participant.userId,
            auctionId,
            participant.amount,
            index + 1,
            participants.length,
          ));
        }
      });

      await Promise.all(promises);
      logger.info(`[BidHistory] Logged auction ended for ${auctionId}`);
    } catch (error) {
      logger.error('[BidHistory] Error logging auction ended:', error);
    }
  }

  /**
   * One page of a bidder's own history, plus stats.
   *
   * The stats are deliberately computed over the WHOLE history, not the page: a
   * "won: 3" that changed as you paged would be describing the page, which is not
   * what the number claims to be.
   *
   * `actionType` and `auctionStatus` are separate filters on purpose. They look like
   * one dropdown in the UI, but they are not the same axis — won/lost/buy_now are
   * values of the bid row's action_type, while "active" is a property of the auction
   * the bid belongs to. Merging them into one parameter made "active" silently
   * unmatchable.
   */
  async getUserHistoryWithStats(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      actionType?: string;
      auctionStatus?: AuctionStatus;
      sortBy?: 'createdAt' | 'amount';
      sortOrder?: 'asc' | 'desc';
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ) {
    try {
      const repo = AppDataSource.getRepository(BidHistory);
      const page = options.page ?? 1;
      const limit = options.limit ?? 20;

      const query = repo
        .createQueryBuilder('history')
        .innerJoinAndSelect('history.auction', 'auction')
        .leftJoinAndSelect('auction.product', 'product')
        .where('history.user_id = :userId', { userId });

      if (options.actionType) {
        query.andWhere('history.action_type = :actionType', { actionType: options.actionType });
      }

      if (options.auctionStatus) {
        query.andWhere('auction.status = :auctionStatus', { auctionStatus: options.auctionStatus });
      }

      if (options.search?.trim()) {
        // Binding stops injection but not wildcards — an unescaped '%' would match
        // every product the bidder has ever touched.
        query.andWhere('product.name ILIKE :search', {
          search: `%${escapeLike(options.search.trim())}%`,
        });
      }

      // The range is on the BID's timestamp, not the auction's: the user is looking
      // through what they did, not through when auctions happened to run.
      if (options.dateFrom) {
        query.andWhere('history.created_at >= :dateFrom', { dateFrom: new Date(options.dateFrom) });
      }

      if (options.dateTo) {
        query.andWhere('history.created_at < :dateTo', { dateTo: exclusiveEnd(options.dateTo) });
      }

      const sortColumn = options.sortBy === 'amount' ? 'history.amount' : 'history.created_at';
      query
        .orderBy(sortColumn, (options.sortOrder ?? 'desc').toUpperCase() as 'ASC' | 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      query.leftJoinAndSelect('product.images', 'primaryImage', 'primaryImage.isPrimary = TRUE');
      query.leftJoinAndSelect('primaryImage.file', 'primaryImageFile');

      const [rows, totalItems] = await query.getManyAndCount();
      const history = await this.presentHistoryRows(rows);

      return { history, stats: await this.getUserHistoryStats(userId), totalItems, page, limit };
    } catch (error) {
      logger.error('[BidHistory] Error getting user history with stats:', error);
      throw error;
    }
  }

  /**
   * Turns the loaded rows into the response shape.
   *
   * Two things the raw entity gets wrong for a client: Postgres hands decimals back
   * as strings, so `amount` and every auction price would arrive as "34443444.00"
   * while the rest of the API returns numbers; and the product carries its image
   * rows rather than a URL anyone can render.
   */
  private async presentHistoryRows(rows: BidHistory[]) {
    const images = rows.map((row) => (row.auction?.product as any)?.images?.[0]?.file);
    const urls = await fileService.urlsOf(images);

    return rows.map((row, index) => {
      const auction: any = row.auction;
      const product: any = auction?.product;

      return {
        ...row,
        amount: Number(row.amount),
        auction: auction
          ? {
              ...auction,
              startingPrice: Number(auction.startingPrice),
              currentPrice: Number(auction.currentPrice),
              buyNowPrice: auction.buyNowPrice === null ? null : Number(auction.buyNowPrice),
              reservePrice: auction.reservePrice === null ? null : Number(auction.reservePrice),
              bidIncrement: Number(auction.bidIncrement),
              product: product
                ? { ...product, images: undefined, primaryImage: urls[index] }
                : null,
            }
          : null,
      };
    });
  }

  /**
   * Counters over a bidder's entire history — two grouped queries, never a fetch of
   * every row to count in JS. `active` counts distinct live auctions rather than bid
   * rows, because three bids on one auction is one auction still in play.
   */
  private async getUserHistoryStats(userId: string) {
    const repo = AppDataSource.getRepository(BidHistory);

    const rows = await repo
      .createQueryBuilder('history')
      .select('history.action_type', 'actionType')
      .addSelect('COUNT(*)', 'count')
      .where('history.user_id = :userId', { userId })
      .groupBy('history.action_type')
      .getRawMany<{ actionType: string; count: string }>();

    const activeAuctions = await repo
      .createQueryBuilder('history')
      .innerJoin('history.auction', 'auction')
      .where('history.user_id = :userId', { userId })
      .andWhere('auction.status = :status', { status: AuctionStatus.HAPPENING })
      .select('COUNT(DISTINCT history.auction_id)', 'count')
      .getRawOne();

    const countOf = (actionType: string) =>
      Number(rows.find((row) => row.actionType === actionType)?.count ?? 0);

    return {
      total: rows.reduce((sum, row) => sum + Number(row.count), 0),
      won: countOf('won'),
      lost: countOf('lost'),
      active: Number.parseInt(activeAuctions?.count || '0', 10),
      buy_now: countOf('buy_now'),
      // Both bidding kinds are counted so a filter chip can show its own number.
      // `place_bid` is a manual bid; `auto_bid` is one the proxy resolver placed.
      place_bid: countOf('place_bid'),
      auto_bid: countOf('auto_bid'),
    };
  }

  async getUserHistory(userId: string, filters: Record<string, unknown> = {}) {
    try {
      const repo = AppDataSource.getRepository(BidHistory);
      return await repo.find({
        where: { userId, ...filters },
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      logger.error('[BidHistory] Error getting user history:', error);
      return [];
    }
  }

  /**
   * Live participation stats for an auction, derived from the bid rows.
   * Only actual bid actions count — terminal won/lost rows are excluded.
   *
   * Single source of the bidder payload: both `GET /auctions/{id}/bidders` and the
   * `bidderUpdate` socket event render this, so the client parses one shape.
   *
   * Selects named user columns rather than joining the whole entity — this feeds a
   * public endpoint, and `leftJoinAndSelect('bid.user')` previously shipped every
   * bidder's email, phone and password hash to anyone who asked.
   *
   * `uniqueBidders` is capped, but `totalBidders`/`totalBids` count the full set —
   * the UI shows "X people bidding" from those, so capping them would understate it.
   */
  async getBidderStats(auctionId: string, limit: number = BIDDER_LIST_LIMIT) {
    try {
      const rows = await AppDataSource.getRepository(BidHistory)
        .createQueryBuilder('history')
        .innerJoin('history.user', 'user')
        .leftJoin('user.avatarFile', 'avatarFile')
        .select('history.user_id', 'userId')
        .addSelect('user.username', 'userName')
        .addSelect('avatarFile.id', 'avatarFileId')
        .addSelect('avatarFile.s3_key', 'avatarKey')
        .addSelect('COUNT(*)', 'bidCount')
        .addSelect('MAX(history.amount)', 'highestAmount')
        .addSelect('MAX(history.created_at)', 'latestBidTime')
        .where('history.auction_id = :auctionId', { auctionId })
        .andWhere('history.action_type IN (:...types)', { types: ['place_bid', 'auto_bid'] })
        .groupBy('history.user_id')
        .addGroupBy('user.username')
        .addGroupBy('avatarFile.id')
        .addGroupBy('avatarFile.s3_key')
        .orderBy('MAX(history.amount)', 'DESC')
        .addOrderBy('MAX(history.created_at)', 'ASC')
        .getRawMany();

      // Rank is assigned here, before the cap, so the client never re-sorts and can
      // never disagree with the server about who leads.
      // Signed from the key the join returned; the raw query never sees a URL.
      const avatarUrls = await Promise.all(
        rows.map((row) => (row.avatarKey ? getPresignedUrl(row.avatarKey, PRESIGN_TTL_SECONDS) : null)),
      );

      const ranked = rows.map((row, index) => ({
        userId: String(row.userId),
        userName: row.userName,
        avatarFileId: row.avatarFileId ?? null,
        avatarUrl: avatarUrls[index] ?? null,
        bidCount: Number(row.bidCount),
        highestAmount: Number(row.highestAmount),
        latestBidTime: row.latestBidTime,
        rank: index + 1,
      }));

      return {
        totalBidders: ranked.length,
        totalBids: ranked.reduce((sum, bidder) => sum + bidder.bidCount, 0),
        uniqueBidders: ranked.slice(0, limit),
        truncated: ranked.length > limit,
      };
    } catch (error) {
      logger.error('[BidHistory] Error getting bidder stats:', error);
      return { totalBidders: 0, totalBids: 0, uniqueBidders: [], truncated: false };
    }
  }

  /**
   * Public endpoint, so the bidder is reduced to what a bid history needs to show.
   * The raw relation is a full User — email, phone, account state — which this was
   * handing to anyone who asked.
   */
  async getAuctionHistory(auctionId: string) {
    try {
      const repo = AppDataSource.getRepository(BidHistory);
      const rows = await repo.find({
        where: { auctionId },
        relations: { user: true },
        order: { createdAt: 'DESC' }
      });

      return await Promise.all(rows.map(async ({ user, ...bid }) => ({
        ...bid,
        user: user
          ? {
              id: user.id,
              username: user.username,
              avatarFileId: user.avatarFileId ?? null,
              avatarUrl: await fileService.urlOf(user.avatarFile),
            }
          : null,
      })));
    } catch (error) {
      logger.error('[BidHistory] Error getting auction history:', error);
      return [];
    }
  }
}

export default new BidHistoryService();
