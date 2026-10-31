import VNTimeUtils from '../../common/util/vnTimezone.js';
import { logger } from '../../common/util/logger.js';

import auctionWebSocketService from '../auction/auction-websocket.service.js';
import chatWebSocketService from '../chat/chat-websocket.service.js';
import supportChatWebSocketService from '../support-chat/support-chat-websocket.service.js';

class WebSocketService {
  public io: any = null;
  public isInitialized = false;

  private readonly globalConnections = new Map<string, { userId: string, services: Set<string> }>();

  public services: Record<string, any> = {
    auction: auctionWebSocketService,
    chat: chatWebSocketService,
    supportChat: supportChatWebSocketService,
  };

  private readonly metrics = {
    totalConnections: 0,
    initializationTime: null as Date | null,
    servicesActive: 0,
  };

  initialize(io: any) {
    try {
      this.io = io;

      this.services.auction.initialize(io);
      this.services.chat.initialize(io);
      this.services.supportChat.initialize(io);

      this.isInitialized = true;
      this.metrics.initializationTime = new Date();
      this.metrics.servicesActive = Object.keys(this.services).length;

      logger.info(' [WebSocketCoordinator] All services initialized successfully');

      this.setupConnectionManagement();

      return true;
    } catch (error) {
      logger.error(' [WebSocketCoordinator] Initialization failed:', error);
      return false;
    }
  }

  setupConnectionManagement() {
    if (!this.io) return;

    this.io.on('connection', (socket: any) => {
      this.metrics.totalConnections++;

      socket.on('disconnect', () => {
        this.handleGlobalDisconnect(socket.id);
      });

      logger.debug(`⚡️ [WebSocketCoordinator] New connection: ${socket.id}`);
    });
  }

  handleGlobalDisconnect(socketId: string) {
    try {
      const connection = this.globalConnections.get(socketId);

      if (connection) {
        const { userId, services } = connection;

        services.forEach(serviceName => {
          const service = this.services[serviceName];
          if (service) {
            if (serviceName === 'supportChat' && service.removeSupportChatUser) {
              service.removeSupportChatUser(socketId, userId);
            } else if (service.removeUser) {
              service.removeUser(socketId, userId);
            }
          }
        });

        this.globalConnections.delete(socketId);
        logger.info(`⚡️ [WebSocketCoordinator] User ${userId} disconnected from ${services.size} services`);
      }
    } catch (error) {
      logger.error('❌ [WebSocketCoordinator] Error handling disconnect:', error);
    }
  }

  registerUserWithService(socketId: string, userId: string, serviceName: string, userType = 'user') {
    try {
      if (!this.services[serviceName]) {
        logger.error(`❌ [WebSocketCoordinator] Unknown service: ${serviceName}`);
        return false;
      }

      if (!this.globalConnections.has(socketId)) {
        this.globalConnections.set(socketId, { userId, services: new Set() });
      }

      const connection = this.globalConnections.get(socketId);
      connection!.services.add(serviceName);

      const service = this.services[serviceName];
      let success = false;

      if (serviceName === 'supportChat') {
        success = service.addSupportChatUser(socketId, userId, userType);
      } else if (service.addUser) {
        success = service.addUser(socketId, userId);
      } else {
        logger.error(`❌ [WebSocketCoordinator] Service ${serviceName} does not support user registration`);
        return false;
      }

      if (success) {
        logger.info(`⚡️ [WebSocketCoordinator] User ${userId} registered with ${serviceName} service`);
      }

      return success;
    } catch (error) {
      logger.error(`❌ [WebSocketCoordinator] Error registering user with ${serviceName}:`, error);
      return false;
    }
  }

  /**
   * Drops every live socket a user holds, after telling them why.
   *
   * Identity is fixed at the handshake and never re-checked, so a socket opened
   * before a ban keeps its `user_{id}` room and every auction room it joined for as
   * long as the connection lasts — revoking the refresh token alone leaves it
   * running. The event goes out before the disconnect so the client can show a
   * reason instead of a bare connection drop and reconnect loop.
   */
  async disconnectUser(userId: string, reason: string) {
    if (!this.io) return 0;

    const room = `user_${userId}`;

    try {
      const sockets = await this.io.in(room).fetchSockets();
      this.io.to(room).emit('sessionRevoked', { reason, at: new Date().toISOString() });
      this.io.in(room).disconnectSockets(true);

      if (sockets.length > 0) {
        logger.info(`🔌 [WebSocketCoordinator] Disconnected ${sockets.length} socket(s) for user ${userId}: ${reason}`);
      }
      return sockets.length;
    } catch (error) {
      // Never block the ban on a socket failure: the session is already revoked and
      // the access token expires on its own.
      logger.error(`❌ [WebSocketCoordinator] Error disconnecting user ${userId}:`, error);
      return 0;
    }
  }

  // CHAT METHODS
  addChatUser(socketId: string, userId: string) {
    this.registerUserWithService(socketId, userId, 'chat');
    return this.services.chat.addUser(socketId, userId);
  }

  removeChatUser(socketId: string, userId: string) {
    return this.services.chat.removeUser(socketId, userId);
  }

  joinConversationRoom(socketId: string, conversationId: string, userId: string) {
    return this.services.chat.joinConversationRoom(socketId, conversationId, userId);
  }

  leaveConversationRoom(socketId: string, conversationId: string) {
    return this.services.chat.leaveConversationRoom(socketId, conversationId);
  }

  broadcastChatMessage(messageData: any) {
    return this.services.chat.broadcastChatMessage(messageData);
  }

  broadcastTypingIndicator(conversationId: string, userId: string, isTyping: boolean) {
    return this.services.chat.broadcastTypingIndicator(conversationId, userId, isTyping);
  }

  broadcastMessageReadStatus(conversationId: string, messageId: string, userId: string) {
    return this.services.chat.broadcastMessageReadStatus(conversationId, messageId, userId);
  }

  getChatStats() {
    return this.services.chat.getStats();
  }

  getChatUsers() {
    if (this.services.chat?.getUsers) {
      return this.services.chat.getUsers();
    }
    return [];
  }

  // AUCTION METHODS
  addAuctionUser(socketId: string, userId: string) {
    this.registerUserWithService(socketId, userId, 'auction');
    return this.services.auction.addUser(socketId, userId);
  }

  removeAuctionUser(socketId: string, userId: string) {
    return this.services.auction.removeUser(socketId, userId);
  }

  joinAuctionRoom(socketId: string, auctionId: string, userId: string | null = null) {
    return this.services.auction.joinAuctionRoom(socketId, auctionId, userId);
  }

  leaveAuctionRoom(socketId: string, auctionId: string) {
    return this.services.auction.leaveAuctionRoom(socketId, auctionId);
  }

  broadcastAuctionStatusUpdate(auctionData: any) {
    return this.services.auction.broadcastAuctionStatusUpdate(auctionData);
  }

  broadcastCountdownSync(auctionId: string, timeRemaining: number) {
    return this.services.auction.broadcastCountdownSync(auctionId, timeRemaining);
  }

  broadcastAutoBidStatusUpdate(autoBidData: any) {
    return this.services.auction.broadcastAutoBidStatusUpdate(autoBidData);
  }

  sendCurrentAuctionStatus(socketId: string, auctionId: string) {
    return this.services.auction.sendCurrentAuctionStatus(socketId, auctionId);
  }

  sendCurrentBidderStats(socketId: string, auctionId: string) {
    return this.services.auction.sendCurrentBidderStats(socketId, auctionId);
  }

  getAuctionStats() {
    return this.services.auction.getStats();
  }

  // GLOBAL METRICS
  getStats() {
    const stats: any = {
      coordinator: {
        ...this.metrics,
        totalConnections: this.globalConnections.size,
        connectedClients: this.io ? this.io.sockets.sockets.size : 0,
        isInitialized: this.isInitialized,
      },
    };

    Object.keys(this.services).forEach(serviceName => {
      const service = this.services[serviceName];
      if (service?.getStats) {
        stats[serviceName] = service.getStats();
      }
    });

    return stats;
  }

  healthCheck() {
    const stats = this.getStats();
    const healthStatus: any = {
      coordinator: {
        status: this.io && this.isInitialized ? 'healthy' : 'not_initialized',
        servicesActive: this.metrics.servicesActive,
        totalConnections: this.globalConnections.size,
      },
    };

    Object.keys(this.services).forEach(serviceName => {
      const service = this.services[serviceName];
      if (service?.healthCheck) {
        healthStatus[serviceName] = service.healthCheck();
      }
    });

    return {
      status: this.isInitialized ? 'healthy' : 'not_initialized',
      services: healthStatus,
      stats,
      timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
    };
  }

  testBroadcast() {
    if (!this.io || !this.isInitialized) return false;

    try {
      const testData = {
        type: 'coordinator_test_broadcast',
        message: 'WebSocket Coordinator is working',
        servicesActive: this.metrics.servicesActive,
        timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
        serverTime: Date.now(),
      };

      this.io.emit('testBroadcast', testData);
      logger.info('⚡️ [WebSocketCoordinator] Test broadcast sent to all clients');
      return true;
    } catch (error) {
      logger.error('❌ [WebSocketCoordinator] Test broadcast failed:', error);
      return false;
    }
  }

  // SUPPORT CHAT METHODS
  addSupportChatUser(socketId: string, userId: string, userType = 'user') {
    this.registerUserWithService(socketId, userId, 'supportChat', userType);
    return this.services.supportChat.addSupportChatUser(socketId, userId, userType);
  }

  removeSupportChatUser(socketId: string, userId: string, userType = 'user') {
    return this.services.supportChat.removeSupportChatUser(socketId, userId, userType);
  }

  joinSupportChatRoom(socketId: string, chatId: string, userId: string, userType = 'user') {
    return this.services.supportChat.joinSupportChatRoom(socketId, chatId, userId, userType);
  }

  leaveSupportChatRoom(socketId: string, chatId: string, userId: string) {
    return this.services.supportChat.leaveSupportChatRoom(socketId, chatId, userId);
  }

  broadcastSupportMessage(messageData: any) {
    return this.services.supportChat.broadcastSupportMessage(messageData);
  }

  notifyAdminNewSupportChat(chatData: any) {
    return this.services.supportChat.notifyAdminNewSupportChat(chatData);
  }

  joinAdminRoom(socketId: string, adminId: string) {
    return this.services.supportChat.joinAdminRoom(socketId, adminId);
  }

  leaveAdminRoom(socketId: string, adminId: string) {
    return this.services.supportChat.leaveAdminRoom(socketId, adminId);
  }

  broadcastSupportChatTyping(chatId: string, userId: string, userType: string, isTyping: boolean) {
    return this.services.supportChat.broadcastSupportChatTyping(chatId, userId, userType, isTyping);
  }

  broadcastSupportChatStatusUpdate(chatId: string, status: string, adminId: string, additionalData = {}) {
    return this.services.supportChat.broadcastSupportChatStatusUpdate(chatId, status, adminId, additionalData);
  }

  broadcastAdminStatusChange(adminId: string, isOnline: boolean, additionalInfo = {}) {
    return this.services.supportChat.broadcastAdminStatusChange(adminId, isOnline, additionalInfo);
  }

  broadcastSupportChatReadReceipt(chatId: string, userId: string, messageIds: any) {
    return this.services.supportChat.broadcastSupportChatReadReceipt(chatId, userId, messageIds);
  }

  getSupportChatStats() {
    return this.services.supportChat.getSupportChatStats();
  }
}

export default new WebSocketService();
