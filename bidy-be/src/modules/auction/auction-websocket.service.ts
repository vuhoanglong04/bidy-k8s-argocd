import VNTimeUtils from '../../common/util/vnTimezone.js';
import webSocketHelper from '../../common/util/webSocketHelper.js';
import { logger } from '../../common/util/logger.js';
import { AppDataSource } from '../../database/data-source.js';
import { Auction } from './entity/auctions.entity.js';
import bidHistoryService from './bid-history.service.js';
import { computeMinNextBid } from './auction-pricing.js';

class AuctionWebSocketService {
  public io: any = null;
  private auctionRooms = new Map<string, Set<string>>();
  private userAuctionSockets = new Map<string, Set<string>>();
  /** Reverse of userAuctionSockets, so watcher counting can dedupe a user's tabs. */
  private socketUsers = new Map<string, string>();
  private lastBroadcast = new Map<string, number>();

  private metrics = {
    totalBroadcasts: 0,
    activeRooms: 0,
    connectedUsers: 0,
  };

  initialize(io: any) {
    this.io = io;
    logger.info('🏛️ [AuctionWS] Service initialized');
  }

  addUser(socketId: string, userId: string) {
    try {
      webSocketHelper.validateSocketParams(socketId, userId, 'addAuctionUser');

      if (!this.userAuctionSockets.has(userId)) {
        this.userAuctionSockets.set(userId, new Set());
      }
      this.userAuctionSockets.get(userId)!.add(socketId);

      this.metrics.connectedUsers = this.userAuctionSockets.size;
      logger.info(`🏛️ [AuctionWS] User ${userId} added to auction system`);

      return true;
    } catch (error) {
      logger.error('❌ [AuctionWS] Error adding user:', error);
      return false;
    }
  }

  removeUser(socketId: string, userId: string) {
    try {
      if (userId && this.userAuctionSockets.has(userId)) {
        this.userAuctionSockets.get(userId)!.delete(socketId);
        if (this.userAuctionSockets.get(userId)!.size === 0) {
          this.userAuctionSockets.delete(userId);
        }
      }

      // Keyed by socket, so it is cleared on disconnect rather than on leaving a
      // single room — the same socket may still be watching another auction.
      this.socketUsers.delete(socketId);

      for (const [auctionId, socketSet] of this.auctionRooms.entries()) {
        if (socketSet.has(socketId)) {
          socketSet.delete(socketId);
          if (socketSet.size === 0) {
            this.auctionRooms.delete(auctionId);
          }
        }
      }

      this.metrics.connectedUsers = this.userAuctionSockets.size;
      this.metrics.activeRooms = this.auctionRooms.size;

      logger.info(`🏛️ [AuctionWS] User ${userId || 'unknown'} removed from auction system`);
      return true;
    } catch (error) {
      logger.error('❌ [AuctionWS] Error removing user:', error);
      return false;
    }
  }

  joinAuctionRoom(socketId: string, auctionId: string, userId: string | null = null) {
    try {
      webSocketHelper.validateSocketParams(socketId, auctionId, 'joinAuctionRoom');

      const roomName = `auction_${auctionId}`;
      const success = webSocketHelper.safeJoinRoom(this.io, socketId, roomName, userId, 'Auction');

      if (success) {
        if (!this.auctionRooms.has(auctionId)) {
          this.auctionRooms.set(auctionId, new Set());
        }
        this.auctionRooms.get(auctionId)!.add(socketId);
        if (userId) this.socketUsers.set(socketId, userId);

        this.metrics.activeRooms = this.auctionRooms.size;

        this.sendCurrentAuctionStatus(socketId, auctionId);
        this.sendCurrentBidderStats(socketId, auctionId);

        logger.info(`🏛️ [AuctionWS] User ${userId || 'anonymous'} joined auction ${auctionId}`);
      }

      return success;
    } catch (error) {
      logger.error('❌ [AuctionWS] Error joining auction room:', error);
      return false;
    }
  }

  leaveAuctionRoom(socketId: string, auctionId: string) {
    try {
      const roomName = `auction_${auctionId}`;
      const success = webSocketHelper.safeLeaveRoom(this.io, socketId, roomName, null, 'Auction');

      if (success) {
        if (this.auctionRooms.has(auctionId)) {
          this.auctionRooms.get(auctionId)!.delete(socketId);
          if (this.auctionRooms.get(auctionId)!.size === 0) {
            this.auctionRooms.delete(auctionId);
          }
        }

        this.metrics.activeRooms = this.auctionRooms.size;
        logger.info(`🏛️ [AuctionWS] Socket ${socketId} left auction ${auctionId}`);
      }

      return success;
    } catch (error) {
      logger.error('❌ [AuctionWS] Error leaving auction room:', error);
      return false;
    }
  }

  broadcastAuctionStatusUpdate(auctionData: any) {
    try {
      const auctionId = auctionData.auctionId || auctionData._id || auctionData.id;
      const endDate = auctionData.endDate || auctionData.end_date || auctionData.finishedTime;

      const updateData = {
        type: 'auction_status_update',
        auctionId,
        status: auctionData.status,
        endDate,
        timeRemaining: this.calculateTimeRemaining(endDate),
        auctionName: auctionData.name || auctionData.auctionName,
        serverTime: Date.now(),
        timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
      };

      const lastBroadcast = this.lastBroadcast.get(auctionId) || 0;
      if (Date.now() - lastBroadcast < 1000) {
        logger.debug(`🏛️ [AuctionWS] Duplicate broadcast prevented for auction ${auctionId}`);
        return true;
      }

      const roomName = `auction_${auctionId}`;
      const success = webSocketHelper.safeBroadcastToRoom(
        this.io,
        roomName,
        'auctionStatusUpdate',
        updateData,
      );

      if (success) {
        this.lastBroadcast.set(auctionId, Date.now());
        this.metrics.totalBroadcasts++;

        this.io.emit('auctionUpdate', updateData);

        logger.info(`🏛️ [AuctionWS] Status update broadcasted for auction ${auctionId} (${auctionData.status})`);
      }

      return success;
    } catch (error) {
      logger.error('❌ [AuctionWS] Error broadcasting auction status:', error);
      return false;
    }
  }

  // broadcastNewBid removed with its 'newBid'/'bidUpdate' events. Its only caller was
  // a socket listener that rebroadcast whatever a client sent, so the payload was
  // never trustworthy. Bids are announced by broadcastBidderUpdate after the bid
  // transaction commits, from data the server read back itself.

  broadcastAutoBidStatusUpdate(autoBidData: any) {
    try {
      const updateData = {
        type: 'auto_bid_status_update',
        auctionId: autoBidData.auctionId,
        userId: autoBidData.userId,
        action: autoBidData.action,
        userBid: autoBidData.userBid,
        serverTime: Date.now(),
        timestamp: autoBidData.timestamp || VNTimeUtils.getCurrentVNTime().toISOString(),
      };

      const roomName = `auction_${autoBidData.auctionId}`;
      const success = webSocketHelper.safeBroadcastToRoom(
        this.io,
        roomName,
        'autoBidStatusUpdate',
        updateData,
      );

      if (success) {
        this.metrics.totalBroadcasts++;
        this.io.emit('autoBidUpdate', updateData);

        logger.info(`🏛️ [AuctionWS] Auto-bid ${autoBidData.action} broadcasted for auction ${autoBidData.auctionId}`);
      }

      return success;
    } catch (error) {
      logger.error('❌ [AuctionWS] Error broadcasting auto-bid status:', error);
      return false;
    }
  }

  async sendCurrentAuctionStatus(socketId: string, auctionId: string) {
    try {
      const auction = await AppDataSource.getRepository(Auction).findOne({
        where: { id: auctionId },
        relations: { product: true }
      });

      if (auction) {
        const endDate = auction.endDate;
        const timeRemaining = this.calculateTimeRemaining(endDate);

        const statusData = {
          type: 'current_auction_status',
          auctionId,
          auctionName: auction.product?.name || 'Unknown',
          status: auction.status,
          endDate,
          timeRemaining: Math.max(0, timeRemaining),
          timeRemainingFormatted: VNTimeUtils.formatTimeRemaining(Math.max(0, timeRemaining)),
          serverTime: Date.now(),
          timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
        };

        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('currentAuctionStatus', statusData);
          logger.debug(`🏛️ [AuctionWS] Current status sent to socket ${socketId}`);
        }
      }
    } catch (error) {
      logger.error('❌ [AuctionWS] Error sending current auction status:', error);
    }
  }

  /**
   * How many sockets are currently in the auction room — "people watching", as
   * distinct from the bidder count, which only counts those who actually bid.
   *
   * ponytail: this Map lives in the process, so the number is per-instance and
   * only correct while the API runs as a single instance. Behind more than one
   * replica each would report its own share; move the room registry to the
   * Redis socket.io adapter before scaling out.
   */
  getWatcherCount(auctionId: string) {
    const sockets = this.auctionRooms.get(String(auctionId));
    if (!sockets) return 0;

    // A user with two tabs holds two sockets but is one watcher. Anonymous
    // visitors have no id to dedupe by, so they still count per socket.
    const identified = new Set<string>();
    let anonymous = 0;

    for (const socketId of sockets) {
      const userId = this.socketUsers.get(socketId);
      if (userId) identified.add(userId);
      else anonymous++;
    }

    return identified.size + anonymous;
  }

  /**
   * The one bidder payload pushed to clients. Used both for the snapshot a socket
   * gets on joining and for the broadcast after each bid, so the client keeps a
   * single parser. `lastBid` names who moved, letting the UI animate that row.
   */
  async buildBidderPayload(auctionId: string, lastBid: any = null) {
    const bidderStats = await bidHistoryService.getBidderStats(auctionId);
    const auction = await AppDataSource.getRepository(Auction).findOne({
      where: { id: auctionId },
      select: { currentPrice: true, startingPrice: true, bidIncrement: true, status: true },
    });

    // The bidder who just moved always sorts to rank 1 — a bid only lands if it
    // beats the current price — so their display name is already in this payload.
    const resolvedLastBid = lastBid
      ? {
          ...lastBid,
          userName: bidderStats.uniqueBidders.find(b => b.userId === String(lastBid.userId))?.userName ?? null,
        }
      : null;

    return {
      type: 'bidder_update',
      auctionId,
      ...bidderStats,
      watcherCount: this.getWatcherCount(auctionId),
      // Carried here so a bid costs the room zero HTTP requests: without it every
      // viewer refetched the auction just to redraw the price, turning one bid into
      // one request per watcher. Numbers, not the raw decimal strings the ORM
      // returns, so a client reads one type throughout this payload.
      currentPrice: auction ? Number(auction.currentPrice) || Number(auction.startingPrice) : null,
      status: auction?.status ?? null,
      minNextBid: auction ? computeMinNextBid(auction) : null,
      lastBid: resolvedLastBid,
      serverTime: Date.now(),
      timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
    };
  }

  /** Snapshot for a single socket that just joined the room. */
  async sendCurrentBidderStats(socketId: string, auctionId: string) {
    try {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) return;

      socket.emit('bidderUpdate', await this.buildBidderPayload(auctionId));
      logger.debug(`🏛️ [AuctionWS] Bidder stats sent to socket ${socketId}`);
    } catch (error) {
      logger.error('❌ [AuctionWS] Error sending bidder stats:', error);
    }
  }

  async broadcastBidderUpdate(auctionId: string, lastBid: any = null) {
    try {
      const updateData = await this.buildBidderPayload(auctionId, lastBid);

      const roomName = `auction_${auctionId}`;
      const success = webSocketHelper.safeBroadcastToRoom(
        this.io,
        roomName,
        'bidderUpdate',
        updateData,
      );

      if (success) {
        this.metrics.totalBroadcasts++;
        logger.info(`🏛️ [AuctionWS] Bidder update broadcasted for auction ${auctionId} (${updateData.totalBidders} bidders)`);
      }
    } catch (error) {
      logger.error('❌ [AuctionWS] Error broadcasting bidder update:', error);
    }
  }

  broadcastCountdownSync(auctionId: string, timeRemaining: number) {
    try {
      const syncData = {
        type: 'countdown_sync',
        auctionId,
        timeRemaining,
        timeRemainingFormatted: VNTimeUtils.formatTimeRemaining(timeRemaining),
        serverTime: Date.now(),
        timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
      };

      const roomName = `auction_${auctionId}`;
      const success = webSocketHelper.safeBroadcastToRoom(
        this.io,
        roomName,
        'countdownSync',
        syncData,
      );

      if (success) {
        this.metrics.totalBroadcasts++;
        logger.debug(`🏛️ [AuctionWS] Countdown sync for auction ${auctionId}`);
      }
    } catch (error) {
      logger.error('❌ [AuctionWS] Error broadcasting countdown sync:', error);
    }
  }

  calculateTimeRemaining(endDate: any) {
    if (!endDate) return 0;
    return VNTimeUtils.calculateTimeRemaining(endDate);
  }

  getStats() {
    return {
      ...this.metrics,
      activeRooms: this.auctionRooms.size,
      connectedUsers: this.userAuctionSockets.size,
      totalUserSockets: Array.from(this.userAuctionSockets.values())
        .reduce((sum, socketSet) => sum + socketSet.size, 0),
    };
  }

  healthCheck() {
    const stats = this.getStats();
    return {
      status: this.io ? 'healthy' : 'not_initialized',
      stats,
      auction: {
        status: this.auctionRooms.size > 0 ? 'active' : 'idle',
        activeAuctions: this.auctionRooms.size,
        totalBroadcasts: this.metrics.totalBroadcasts,
      },
      timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
    };
  }
}

export default new AuctionWebSocketService();
