import VNTimeUtils from '../../common/util/vnTimezone.js';
import webSocketHelper from '../../common/util/webSocketHelper.js';

class SupportChatWebSocketService {
  public io: any = null;
  private supportChatRooms = new Map<string, Set<string>>();
  private adminSockets = new Set<string>();
  private userSupportSockets = new Map<string, Set<string>>();
  private typingTimeouts = new Map<string, NodeJS.Timeout>();

  private supportChatStats = {
    activeSupportChats: 0,
    totalSupportMessages: 0,
    adminsOnline: 0,
  };

  initialize(io: any) {
    this.io = io;
    console.log('💬[SupportChatWS]: Service initialized');
  }

  addSupportChatUser(socketId: string, userId: string, userType = 'user') {
    try {
      webSocketHelper.validateSocketParams(socketId, userId, 'addSupportChatUser');

      if (!this.userSupportSockets.has(userId)) {
        this.userSupportSockets.set(userId, new Set());
      }
      this.userSupportSockets.get(userId)!.add(socketId);

      if (userType === 'admin') {
        this.adminSockets.add(socketId);
        this.supportChatStats.adminsOnline++;
        console.log(`👑[SupportChatWS]: Admin ${userId} added to support system`);
      } else {
        console.log(`👤[SupportChatWS]: User ${userId} added to support system`);
      }

      return true;
    } catch (error) {
      console.error('❌[SupportChatWS]: Error adding support chat user:', error);
      return false;
    }
  }

  removeSupportChatUser(socketId: string, userId: string, userType = 'user') {
    try {
      if (userId && this.userSupportSockets.has(userId)) {
        this.userSupportSockets.get(userId)!.delete(socketId);
        if (this.userSupportSockets.get(userId)!.size === 0) {
          this.userSupportSockets.delete(userId);
        }
      }

      if (userType === 'admin' || this.adminSockets.has(socketId)) {
        this.adminSockets.delete(socketId);
        this.supportChatStats.adminsOnline = Math.max(0, this.supportChatStats.adminsOnline - 1);
      }

      for (const [chatId, socketSet] of this.supportChatRooms.entries()) {
        if (socketSet.has(socketId)) {
          socketSet.delete(socketId);
          if (socketSet.size === 0) {
            this.supportChatRooms.delete(chatId);
            this.supportChatStats.activeSupportChats = Math.max(0, this.supportChatStats.activeSupportChats - 1);
          }
        }
      }

      console.log(`💬[SupportChatWS]: ${userType} ${userId || 'unknown'} removed from support system`);
      return true;
    } catch (error) {
      console.error('❌[SupportChatWS]: Error removing support chat user:', error);
      return false;
    }
  }

  joinSupportChatRoom(socketId: string, chatId: string, userId: string, _userType = 'user') {
    try {
      webSocketHelper.validateSocketParams(socketId, userId, 'joinSupportChatRoom');

      const roomName = `support_chat_${chatId}`;
      const success = webSocketHelper.safeJoinRoom(this.io, socketId, roomName, userId, 'SupportChat');

      if (success) {
        if (!this.supportChatRooms.has(chatId)) {
          this.supportChatRooms.set(chatId, new Set());
          this.supportChatStats.activeSupportChats++;
        }
        this.supportChatRooms.get(chatId)!.add(socketId);

        const userSupportRoom = `user_${userId}_support`;
        webSocketHelper.safeJoinRoom(this.io, socketId, userSupportRoom, userId, 'UserSupport');
      }

      return success;
    } catch (error) {
      console.error('❌[SupportChatWS]: Error joining support chat room:', error);
      return false;
    }
  }

  leaveSupportChatRoom(socketId: string, chatId: string, userId: string) {
    try {
      const roomName = `support_chat_${chatId}`;
      const success = webSocketHelper.safeLeaveRoom(this.io, socketId, roomName, userId, 'SupportChat');

      if (success) {
        if (userId) {
          const userSupportRoom = `user_${userId}_support`;
          webSocketHelper.safeLeaveRoom(this.io, socketId, userSupportRoom, userId, 'UserSupport');
        }

        if (this.supportChatRooms.has(chatId)) {
          this.supportChatRooms.get(chatId)!.delete(socketId);
          if (this.supportChatRooms.get(chatId)!.size === 0) {
            this.supportChatRooms.delete(chatId);
            this.supportChatStats.activeSupportChats = Math.max(0, this.supportChatStats.activeSupportChats - 1);
          }
        }
      }

      return success;
    } catch (error) {
      console.error('❌[SupportChatWS]: Error leaving support chat room:', error);
      return false;
    }
  }

  broadcastSupportMessage(messageData: any) {
    try {
      const success = webSocketHelper.broadcastSupportMessage(this.io, messageData);

      if (success) {
        this.supportChatStats.totalSupportMessages++;
      }

      return success;
    } catch (error) {
      console.error('❌[SupportChatWS]: Error broadcasting support message:', error);
      return false;
    }
  }

  notifyAdminNewSupportChat(chatData: any) {
    try {
      const notificationData = {
        type: 'support_chat_created',
        chat: {
          ...chatData,
          priority: chatData.priority || 'medium',
          status: chatData.status || 'open',
        },
        urgency: chatData.priority === 'high' ? 'urgent' : 'normal',
      };

      return webSocketHelper.notifyAdmins(this.io, notificationData, 'support_chat_created');
    } catch (error) {
      console.error('❌[SupportChatWS]: Error notifying admin of new support chat:', error);
      return false;
    }
  }

  joinAdminRoom(socketId: string, adminId: string) {
    try {
      webSocketHelper.validateSocketParams(socketId, adminId, 'joinAdminRoom');

      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.join('admin_room');
        socket.join('admin_notifications');
        socket.join(`admin_${adminId}`);

        this.adminSockets.add(socketId);
        this.addSupportChatUser(socketId, adminId, 'admin');

        console.log(`👑[SupportChatWS]: Admin ${adminId} joined admin rooms (admin_room, admin_notifications, admin_${adminId})`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌[SupportChatWS]: Error joining admin room:', error);
      return false;
    }
  }

  leaveAdminRoom(socketId: string, adminId: string) {
    try {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.leave('admin_room');
        socket.leave('admin_notifications');

        this.adminSockets.delete(socketId);

        if (adminId) {
          this.removeSupportChatUser(socketId, adminId, 'admin');
        }

        console.log(`👑[SupportChatWS]: Admin ${adminId} left admin rooms`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌[SupportChatWS]: Error leaving admin room:', error);
      return false;
    }
  }

  broadcastSupportChatTyping(chatId: string, userId: string, userType: string, isTyping: boolean) {
    try {
      webSocketHelper.validateSocketParams('socket', userId, 'broadcastSupportChatTyping');

      if (!chatId) {
        throw new Error('Chat ID required for typing indicator');
      }

      const roomName = `support_chat_${chatId}`;
      const typingKey = `${chatId}_${userId}`;

      if (this.typingTimeouts.has(typingKey)) {
        clearTimeout(this.typingTimeouts.get(typingKey));
        this.typingTimeouts.delete(typingKey);
      }

      const typingData = {
        type: 'support_typing_indicator',
        chatId,
        userId,
        userType,
        isTyping,
        serverTime: Date.now(),
        timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
      };

      const success = webSocketHelper.safeBroadcastToRoom(this.io, roomName, 'support_chat_typing', typingData);

      if (isTyping && success) {
        const timeout = setTimeout(() => {
          this.broadcastSupportChatTyping(chatId, userId, userType, false);
          this.typingTimeouts.delete(typingKey);
        }, 3000);

        this.typingTimeouts.set(typingKey, timeout);
      }

      return success;
    } catch (error) {
      console.error('❌[SupportChatWS]: Error broadcasting typing indicator:', error);
      return false;
    }
  }

  broadcastSupportChatStatusUpdate(chatId: string, status: string, adminId: string, additionalData = {}) {
    try {
      if (!chatId || !status) {
        throw new Error('Chat ID and status required');
      }

      const roomName = `support_chat_${chatId}`;
      const statusData = {
        type: 'support_chat_status_update',
        chatId,
        status,
        adminId,
        serverTime: Date.now(),
        timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
        ...additionalData,
      };

      const success = webSocketHelper.safeBroadcastToRoom(this.io, roomName, 'support_chat_status_update', statusData);

      if (success) {
        webSocketHelper.notifyAdmins(this.io, statusData, 'chat_status_changed');
      }

      return success;
    } catch (error) {
      console.error('❌[SupportChatWS]: Error broadcasting chat status update:', error);
      return false;
    }
  }

  broadcastAdminStatusChange(adminId: string, isOnline: boolean, additionalInfo = {}) {
    try {
      if (!adminId) {
        throw new Error('Admin ID required');
      }

      const statusData = {
        type: 'admin_status_change',
        adminId,
        isOnline,
        serverTime: Date.now(),
        timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
        ...additionalInfo,
      };

      return webSocketHelper.safeBroadcastGlobal(this.io, 'admin_status_change', statusData);
    } catch (error) {
      console.error('❌[SupportChatWS]: Error broadcasting admin status change:', error);
      return false;
    }
  }

  broadcastSupportChatReadReceipt(chatId: string, userId: string, messageIds: any) {
    try {
      webSocketHelper.validateSocketParams('socket', userId, 'broadcastSupportChatReadReceipt');

      if (!chatId) {
        throw new Error('Chat ID required');
      }

      const roomName = `support_chat_${chatId}`;
      const readReceiptData = {
        type: 'support_chat_read_receipt',
        chatId,
        userId,
        messageIds: Array.isArray(messageIds) ? messageIds : [messageIds],
        readAt: VNTimeUtils.getCurrentVNTime().toISOString(),
        serverTime: Date.now(),
      };

      return webSocketHelper.safeBroadcastToRoom(this.io, roomName, 'support_chat_read_receipt', readReceiptData);
    } catch (error) {
      console.error('❌[SupportChatWS]: Error broadcasting read receipt:', error);
      return false;
    }
  }

  getSupportChatStats() {
    return {
      ...this.supportChatStats,
      supportChatRooms: this.supportChatRooms.size,
      adminSocketsConnected: this.adminSockets.size,
      userSupportSockets: this.userSupportSockets.size,
      activeTypingIndicators: this.typingTimeouts.size,
    };
  }

  healthCheck() {
    const stats = this.getSupportChatStats();
    return {
      status: this.io ? 'healthy' : 'not_initialized',
      stats,
      supportChat: {
        status: this.supportChatRooms.size > 0 ? 'active' : 'idle',
        activeSupportChats: this.supportChatRooms.size,
        adminsOnline: this.adminSockets.size,
        totalSupportMessages: this.supportChatStats.totalSupportMessages,
      },
      timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
    };
  }
}

export default new SupportChatWebSocketService();
