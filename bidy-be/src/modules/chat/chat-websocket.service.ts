import VNTimeUtils from '../../common/util/vnTimezone.js';
import webSocketHelper from '../../common/util/webSocketHelper.js';
import { logger } from '../../common/util/logger.js';
import { AppDataSource } from '../../database/data-source.js';
import { ConversationMember } from './entity/conversation-member.entity.js';

class ChatWebSocketService {
  public io: any = null;
  private conversationRooms = new Map<string, Set<string>>();
  private userChatSockets = new Map<string, Set<string>>();

  private metrics = {
    totalMessages: 0,
    activeConversations: 0,
    connectedChatUsers: 0,
  };

  initialize(io: any) {
    this.io = io;
    logger.info('💬 [ChatWS] Service initialized');
  }

  addUser(socketId: string, userId: string) {
    try {
      webSocketHelper.validateSocketParams(socketId, userId, 'addChatUser');

      if (!this.userChatSockets.has(userId)) {
        this.userChatSockets.set(userId, new Set());
      }
      this.userChatSockets.get(userId)!.add(socketId);

      this.metrics.connectedChatUsers = this.userChatSockets.size;
      logger.info(`💬 [ChatWS] User ${userId} added to chat system`);

      return true;
    } catch (error) {
      logger.error('❌ [ChatWS] Error adding user:', error);
      return false;
    }
  }

  removeUser(socketId: string, userId?: string) {
    try {
      if (userId && this.userChatSockets.has(userId)) {
        this.userChatSockets.get(userId)!.delete(socketId);
        if (this.userChatSockets.get(userId)!.size === 0) {
          this.userChatSockets.delete(userId);
        }
      }

      for (const [conversationId, socketSet] of this.conversationRooms.entries()) {
        if (socketSet.has(socketId)) {
          socketSet.delete(socketId);
          if (socketSet.size === 0) {
            this.conversationRooms.delete(conversationId);
          }
        }
      }

      this.metrics.connectedChatUsers = this.userChatSockets.size;
      this.metrics.activeConversations = this.conversationRooms.size;

      logger.info(`💬 [ChatWS] User ${userId || 'unknown'} removed from chat system`);
      return true;
    } catch (error) {
      logger.error('❌ [ChatWS] Error removing user:', error);
      return false;
    }
  }

  async joinConversationRoom(socketId: string, conversationId: string, userId: string) {
    try {
      webSocketHelper.validateSocketParams(socketId, conversationId, 'joinConversationRoom');

      // Reaching a conversation id is not permission to read it. Without this any
      // authenticated client could join a stranger's room by guessing an id and
      // receive its history and every later message.
      const isMember = await AppDataSource.getRepository(ConversationMember).findOne({
        where: { conversationId, userId },
      });
      if (!isMember) {
        logger.warn(`💬 [ChatWS] User ${userId} denied access to conversation ${conversationId}`);
        return false;
      }

      const roomName = `conversation_${conversationId}`;
      const success = webSocketHelper.safeJoinRoom(this.io, socketId, roomName, userId, 'Chat');

      if (success) {
        if (!this.conversationRooms.has(conversationId)) {
          this.conversationRooms.set(conversationId, new Set());
        }
        this.conversationRooms.get(conversationId)!.add(socketId);

        this.metrics.activeConversations = this.conversationRooms.size;

        // History is not pushed on join any more: every tab switch cost a query for
        // messages the client usually already had. GET /chat/messages/:id serves it,
        // paged, when the client actually needs it.
        logger.info(`💬 [ChatWS] User ${userId} joined conversation ${conversationId}`);
      }

      return success;
    } catch (error) {
      logger.error('❌ [ChatWS] Error joining conversation room:', error);
      return false;
    }
  }

  leaveConversationRoom(socketId: string, conversationId: string) {
    try {
      const roomName = `conversation_${conversationId}`;
      const success = webSocketHelper.safeLeaveRoom(this.io, socketId, roomName, null, 'Chat');

      if (success) {
        if (this.conversationRooms.has(conversationId)) {
          this.conversationRooms.get(conversationId)!.delete(socketId);
          if (this.conversationRooms.get(conversationId)!.size === 0) {
            this.conversationRooms.delete(conversationId);
          }
        }

        this.metrics.activeConversations = this.conversationRooms.size;
        logger.info(`💬 [ChatWS] Socket ${socketId} left conversation ${conversationId}`);
      }

      return success;
    } catch (error) {
      logger.error('❌ [ChatWS] Error leaving conversation room:', error);
      return false;
    }
  }

  broadcastChatMessage(messageData: any) {
    try {
      const conversationId = messageData.conversationId || messageData.conversation;

      if (!conversationId) {
        logger.error('❌ [ChatWS] Missing conversationId in message data');
        return false;
      }

      const enhancedMessageData = {
        type: 'new_chat_message',
        conversationId,
        messageId: messageData.messageId || messageData._id || messageData.id,
        senderId: messageData.senderId,
        senderType: messageData.senderType || 'user',
        message: messageData.message || messageData.content,
        messageType: messageData.messageType || 'text',
        timestamp: messageData.timestamp || VNTimeUtils.getCurrentVNTime().toISOString(),
        serverTime: Date.now(),
        fileUrl: messageData.fileUrl,
        fileName: messageData.fileName,
        isEdited: messageData.isEdited || false,
        editedAt: messageData.editedAt,
        replyTo: messageData.replyTo,
        sender: messageData.sender,
      };

      // No per-conversation time window here: one guarded the room against duplicate
      // broadcasts by dropping anything sent within 1s of the previous message, which
      // silently swallowed the second half of any fast exchange — the row was written
      // but never delivered, so it only appeared after a reload.
      const success = webSocketHelper.broadcastChatMessage(this.io, conversationId, enhancedMessageData);

      if (success) {
        this.metrics.totalMessages++;

        logger.info(`💬 [ChatWS] Message broadcasted to conversation ${conversationId}`);

        void this.notifyConversationActivity(conversationId, enhancedMessageData);
      }

      return success;
    } catch (error) {
      logger.error('❌ [ChatWS] Error broadcasting chat message:', error);
      return false;
    }
  }

  broadcastTypingIndicator(conversationId: string, userId: string, isTyping: boolean) {
    try {
      const typingData = {
        type: 'typing_indicator',
        conversationId,
        userId,
        isTyping,
        timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
        serverTime: Date.now(),
      };

      const roomName = `conversation_${conversationId}`;
      const success = webSocketHelper.safeBroadcastToRoom(
        this.io,
        roomName,
        'typingIndicator',
        typingData,
      );

      if (success) {
        logger.debug(`💬 [ChatWS] Typing indicator broadcasted for user ${userId} in conversation ${conversationId}`);
      }

      return success;
    } catch (error) {
      logger.error('❌ [ChatWS] Error broadcasting typing indicator:', error);
      return false;
    }
  }

  broadcastMessageReadStatus(conversationId: string, messageId: string, userId: string) {
    try {
      const readStatusData = {
        type: 'message_read_status',
        conversationId,
        messageId,
        userId,
        readAt: VNTimeUtils.getCurrentVNTime().toISOString(),
        serverTime: Date.now(),
      };

      const roomName = `conversation_${conversationId}`;
      const success = webSocketHelper.safeBroadcastToRoom(
        this.io,
        roomName,
        'messageReadStatus',
        readStatusData,
      );

      if (success) {
        logger.info(`💬 [ChatWS] Read status broadcasted for message ${messageId} in conversation ${conversationId}`);
      }

      return success;
    } catch (error) {
      logger.error('❌ [ChatWS] Error broadcasting message read status:', error);
      return false;
    }
  }

  async notifyConversationActivity(conversationId: string, messageData: any) {
    try {
      const activityData = {
        type: 'conversation_activity',
        conversationId,
        lastMessageId: messageData.messageId,
        lastMessageSender: messageData.senderId,
        lastMessagePreview: messageData.message.substring(0, 50) + (messageData.message.length > 50 ? '...' : ''),
        timestamp: messageData.timestamp,
        serverTime: Date.now(),
      };

      // Only the participants. This used to be io.emit, which pushed a 50-character
      // preview of a private message to every connected socket — a fan-out of
      // O(online users) per message, and the message body leaked with it.
      const members = await AppDataSource.getRepository(ConversationMember).find({
        where: { conversationId },
        select: { userId: true },
      });
      for (const member of members) {
        this.io.to(`user_${member.userId}`).emit('conversationActivity', activityData);
      }

      logger.debug(`💬 [ChatWS] Activity notification sent for conversation ${conversationId}`);
    } catch (error) {
      logger.error('❌ [ChatWS] Error notifying conversation activity:', error);
    }
  }

  getStats() {
    return {
      ...this.metrics,
      activeConversations: this.conversationRooms.size,
      connectedChatUsers: this.userChatSockets.size,
      totalUserSockets: Array.from(this.userChatSockets.values())
        .reduce((sum, socketSet) => sum + socketSet.size, 0),
    };
  }

  getUsers() {
    return Array.from(this.userChatSockets.keys());
  }

  healthCheck() {
    const stats = this.getStats();
    return {
      status: this.io ? 'healthy' : 'not_initialized',
      stats,
      chat: {
        status: this.conversationRooms.size > 0 ? 'active' : 'idle',
        activeConversations: this.conversationRooms.size,
        totalMessages: this.metrics.totalMessages,
      },
      timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
    };
  }
}

export default new ChatWebSocketService();
