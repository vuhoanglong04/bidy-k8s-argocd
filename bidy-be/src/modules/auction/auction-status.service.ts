import { AppDataSource } from '../../database/data-source.js';
import { Auction } from './entity/auctions.entity.js';
import { AutoBidConfig } from './entity/auto-bid-config.entity.js';
import { BidHistory } from './entity/bid-history.entity.js';
import { Order } from '../order/entity/order.entity.js';
import { notificationService } from '../notification/notification.service.js';
import bidHistoryService, { AuctionParticipant } from './bid-history.service.js';
import { logger } from '../../common/util/logger.js';
import webSocketService from '../common/websocket.service.js';
import { Between, LessThanOrEqual, MoreThan } from 'typeorm';

/** How far ahead the closing warning goes out. */
const ENDING_SOON_WINDOW_MINUTES = 15;

class AuctionStatusService {
  public isProcessing = false;
  public errorCount = 0;
  public processedCount = 0;

  async processAuctionLifecycle() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date();

      const startedCount = await this.startPendingAuctions(now);
      const endedCount = await this.endHappeningAuctions(now);
      const endingSoonCount = await this.notifyEndingSoonAuctions(now);

      this.processedCount += startedCount + endedCount;

      if (startedCount > 0 || endedCount > 0 || endingSoonCount > 0) {
        logger.info('[AuctionStatus] Lifecycle processed', { startedCount, endedCount, endingSoonCount });
      }

      return { started: startedCount, ended: endedCount, endingSoon: endingSoonCount };
    } catch (error) {
      this.errorCount++;
      logger.error('[AuctionStatus] Lifecycle error', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Warns participants of auctions closing within the window below, once each.
   *
   * The flag is written before the notifications are sent, not after: this cron
   * fires every 10 seconds, so a failure between sending and flagging would replay
   * the whole fan-out on the next tick. Losing one warning beats sending ninety.
   */
  async notifyEndingSoonAuctions(currentTime: Date) {
    const repo = AppDataSource.getRepository(Auction);
    const windowEnd = new Date(currentTime.getTime() + ENDING_SOON_WINDOW_MINUTES * 60 * 1000);

    const due = await repo.find({
      where: {
        status: 'happening' as any,
        endingSoonNotified: false,
        endDate: Between(currentTime, windowEnd),
      },
      relations: { product: true },
    });

    if (due.length === 0) return 0;

    await repo.update(due.map((auction) => auction.id), { endingSoonNotified: true });

    for (const auction of due) {
      try {
        const bidderRows = await AppDataSource.getRepository(BidHistory)
          .createQueryBuilder('bid')
          .select('DISTINCT bid.user_id', 'userId')
          .where('bid.auction_id = :auctionId', { auctionId: auction.id })
          .getRawMany();

        await notificationService
          .createAuctionNotifications()
          .auctionEndingSoon(auction.id, ENDING_SOON_WINDOW_MINUTES, bidderRows.map((row) => String(row.userId)));
      } catch (error: any) {
        logger.warn('[AuctionStatus] Failed to send ending-soon notifications: ' + error.message);
      }
    }

    return due.length;
  }

  async startPendingAuctions(currentTime: Date) {
    const repo = AppDataSource.getRepository(Auction);
    
    // Find 'pending' auctions that should have started
    const auctionsToStart = await repo.find({
      where: {
        status: 'pending' as any,
        startDate: LessThanOrEqual(currentTime),
        endDate: MoreThan(currentTime)
      },
      relations: { product: true }
    });

    if (auctionsToStart.length === 0) return 0;

    await repo.update(
      auctionsToStart.map(a => a.id),
      { status: 'happening' as any }
    );

    for (const auction of auctionsToStart) {
      const statusUpdate = {
        auctionId: auction.id.toString(),
        status: 'happening',
        timestamp: new Date().toISOString(),
      };
      
      // Broadcast to WS
      if (webSocketService && webSocketService.io) {
        webSocketService.io.to('auction_status_sync').emit('auctionStatusUpdate', statusUpdate);
      }
    }

    try {
      const auctionNotifications = await notificationService.createAuctionNotifications();
      for (const auction of auctionsToStart) {
        if (auction.product?.ownerId) {
          await auctionNotifications.auctionStarted(auction.id, auction.product.ownerId);
        }
      }
    } catch (notificationError: any) {
      logger.warn('[AuctionStatus] Failed to send auction started notifications: ' + notificationError.message);
    }

    return auctionsToStart.length;
  }

  async endHappeningAuctions(currentTime: Date) {
    const repo = AppDataSource.getRepository(Auction);
    const orderRepo = AppDataSource.getRepository(Order);
    
    // Find 'happening' auctions that should end
    const auctionsToEnd = await repo.find({
      where: {
        status: 'happening' as any,
        endDate: LessThanOrEqual(currentTime),
      },
      relations: { bids: true, product: true }
    });

    if (auctionsToEnd.length === 0) return 0;

    const endedIds = auctionsToEnd.map(a => a.id);

    await repo.update(endedIds, { status: 'ended' as any, hasActiveAutoBid: false });

    for (const auction of auctionsToEnd) {
      // Find winner
      let winner: any = null;
      if (auction.bids && auction.bids.length > 0) {
        auction.bids.sort((a, b) => Number(b.amount) - Number(a.amount));
        winner = auction.bids[0];
      }

      if (winner) {
        // Prevent duplicate orders for the same auction
        const existingOrder = await orderRepo.findOne({
          where: { auction_id: auction.id }
        });

        if (!existingOrder) {
          // Resolve buyer address logic should ideally go here,
          // but for an automated worker, we might have to defer address selection
          // or pick their default address. If this fails, we log it and keep going.
          try {
            // Fetch buyer's default address via query builder to avoid explicit Address entity import if missing
            const address = await AppDataSource.query(`SELECT id FROM addresses WHERE user_id = $1 AND is_default = true LIMIT 1`, [winner.userId]);
            
            if (address && address.length > 0) {
              const order = orderRepo.create({
                auction_id: auction.id,
                buyer_id: winner.userId,
                seller_id: auction.product.ownerId,
                shipping_address_id: address[0].id,
                final_price: winner.amount,
                total_amount: winner.amount,
                shipping_fee: 0,
                payment_status: 'pending',
                shipping_status: 'pending',
                payment_deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
              });
              await orderRepo.save(order);
            } else {
              logger.warn(`[AuctionStatus] No default address for user ${winner.userId}, skipping order creation for auction ${auction.id}`);
            }
          } catch (err) {
            logger.error(`[AuctionStatus] Failed to create order for auction ${auction.id}`, err);
          }
        }
      }

      await this.finalizeEndedAuction(auction.id, winner ? winner.userId : null);
    }

    return auctionsToEnd.length;
  }

  /**
   * The terminal side effects every ended auction owes its participants, whichever
   * way it ended — the scheduled end above, or a buy-now that closes it early.
   * The caller has already flipped the status and committed; this only records and
   * announces. Best-effort throughout: an auction that is already ended in the
   * database must not be left half-finalized because a notification failed.
   *
   * Bids are re-read rather than passed in so a buy-now caller, which locks the bare
   * auction row, does not have to load the relation just to hand it back.
   */
  async finalizeEndedAuction(auctionId: string, winnerId: string | null) {
    // An ended auction can never trigger a proxy bid again.
    await AppDataSource.getRepository(AutoBidConfig).update(
      { auctionId, isActive: true },
      { isActive: false },
    );

    const bids = await AppDataSource.getRepository(BidHistory).find({ where: { auctionId } });
    const participants = this.rankParticipants(bids);

    if (participants.length > 0) {
      // Terminal won/lost rows for every bidder — the auction's final record and what
      // the "my bids" screen reads.
      await bidHistoryService.logAuctionEnded(auctionId, winnerId, participants);

      // Same winner/participant data drives the won/lost notifications, so they can
      // never disagree with the terminal bid-history rows written just above.
      try {
        const auctionNotifications = notificationService.createAuctionNotifications();
        await auctionNotifications.auctionEnded(auctionId, winnerId, participants);
      } catch (notificationError: any) {
        logger.warn('[AuctionStatus] Failed to send auction ended notifications: ' + notificationError.message);
      }
    }

    if (webSocketService && webSocketService.io) {
      webSocketService.io.to('auction_status_sync').emit('auctionStatusUpdate', {
        auctionId: auctionId.toString(),
        status: 'ended',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /** One entry per bidder holding their best bid, ranked highest first. */
  private rankParticipants(bids: BidHistory[]): AuctionParticipant[] {
    const best = new Map<string, number>();

    for (const bid of bids) {
      const amount = Number(bid.amount);
      if (amount > (best.get(bid.userId) ?? -Infinity)) {
        best.set(bid.userId, amount);
      }
    }

    return [...best.entries()]
      .map(([userId, amount]) => ({ userId, amount }))
      .sort((a, b) => b.amount - a.amount);
  }
}

export default new AuctionStatusService();
