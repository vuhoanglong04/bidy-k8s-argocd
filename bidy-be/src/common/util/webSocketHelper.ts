/**
 * Centralised Socket.IO broadcast helpers.
 *
 * Every emit goes through here so the same message can't be delivered twice when
 * two code paths react to one event: each broadcast is keyed by
 * event + room + messageId + serverTime and suppressed if that key was seen in
 * the last 30 seconds.
 */
import type { Server } from 'socket.io';
import VNTimeUtils from './vnTimezone.js';
import { logger } from './logger.js';

export interface BroadcastMessage {
  messageId?: string;
  _id?: string;
  chatId?: string;
  senderId?: string;
  senderType?: string;
  receiverId?: string;
  message?: string;
  timestamp?: string;
  [key: string]: unknown;
}

interface EnhancedMessage extends BroadcastMessage {
  type: string;
  serverTime: number;
  timestamp: string;
}

const BROADCAST_TTL = 30_000;

// ponytail: dedup state is per-process, so two API instances can each emit the
// same message once. Acceptable while Socket.IO runs single-instance; move the
// tracker to Redis (SET key NX PX 30000) when a second instance is added.
const broadcastTracker = new Map<string, number>();

const cleanExpiredBroadcasts = (): void => {
  const now = Date.now();
  for (const [broadcastId, sentAt] of broadcastTracker.entries()) {
    if (now - sentAt > BROADCAST_TTL) {
      broadcastTracker.delete(broadcastId);
    }
  }
};

// Sweep every 60s; unref so the timer never holds the event loop open.
setInterval(cleanExpiredBroadcasts, 60_000).unref();

/** Composite dedup key — the parts are already unique, so no hashing is needed. */
const broadcastIdOf = (event: string, roomId: string, messageId: unknown, timestamp: number): string =>
  `${event}_${roomId}_${String(messageId)}_${timestamp}`;

const alreadySent = (broadcastId: string): boolean => {
  const sentAt = broadcastTracker.get(broadcastId);
  if (sentAt === undefined) return false;

  if (Date.now() - sentAt > BROADCAST_TTL) {
    broadcastTracker.delete(broadcastId);
    return false;
  }

  return true;
};

const enhance = (messageData: BroadcastMessage, messageType = 'support_message'): EnhancedMessage => ({
  ...messageData,
  messageId: messageData.messageId ?? messageData._id,
  type: messageType,
  serverTime: Date.now(),
  timestamp: messageData.timestamp ?? VNTimeUtils.getCurrentVNTime().toISOString(),
  chatId: messageData.chatId,
  senderId: messageData.senderId,
  senderType: messageData.senderType ?? 'user',
  message: messageData.message,
});

export interface BroadcastOptions {
  messageType?: string;
}

/** Emit to one room, suppressing a repeat of the same message within the TTL. */
export const safeBroadcastToRoom = (
  io: Server,
  roomName: string,
  event: string,
  messageData: BroadcastMessage,
  options: BroadcastOptions = {},
): boolean => {
  try {
    if (!io || !roomName || !event || !messageData) {
      logger.error('[WebSocket] Invalid parameters for safeBroadcastToRoom', null, { roomName, event });
      return false;
    }

    const enhanced = enhance(messageData, options.messageType);
    const broadcastId = broadcastIdOf(event, roomName, enhanced.messageId, enhanced.serverTime);

    if (alreadySent(broadcastId)) {
      logger.debug(`[WebSocket] Duplicate broadcast prevented for ${event} in room ${roomName}`);
      return false;
    }

    broadcastTracker.set(broadcastId, Date.now());
    io.to(roomName).emit(event, enhanced);

    logger.debug(`[WebSocket] Broadcast ${event} to room ${roomName} (${String(enhanced.messageId)})`);
    return true;
  } catch (error) {
    logger.error('[WebSocket] Error in safeBroadcastToRoom', error, { roomName, event });
    return false;
  }
};

/** Emit to every connected client, with the same deduplication. */
export const safeBroadcastGlobal = (
  io: Server,
  event: string,
  messageData: BroadcastMessage,
  options: BroadcastOptions = {},
): boolean => {
  try {
    if (!io || !event || !messageData) {
      logger.error('[WebSocket] Invalid parameters for safeBroadcastGlobal', null, { event });
      return false;
    }

    const enhanced = enhance(messageData, options.messageType);
    const broadcastId = broadcastIdOf(event, 'global', enhanced.messageId, enhanced.serverTime);

    if (alreadySent(broadcastId)) {
      logger.debug(`[WebSocket] Duplicate global broadcast prevented for ${event}`);
      return false;
    }

    broadcastTracker.set(broadcastId, Date.now());
    io.emit(event, enhanced);

    logger.debug(`[WebSocket] Global broadcast ${event} (${String(enhanced.messageId)})`);
    return true;
  } catch (error) {
    logger.error('[WebSocket] Error in safeBroadcastGlobal', error, { event });
    return false;
  }
};

/** Deliver a support-chat message to the ticket room, and the user's personal room. */
export const broadcastSupportMessage = (io: Server, messageData: BroadcastMessage): boolean => {
  if (!io || !messageData?.chatId) {
    logger.error('[SupportChat] Invalid parameters for broadcastSupportMessage');
    return false;
  }

  const success = safeBroadcastToRoom(
    io,
    `support_chat_${messageData.chatId}`,
    'new_support_message',
    messageData,
    { messageType: 'new_support_message' },
  );

  if (success && messageData.receiverId) {
    safeBroadcastToRoom(
      io,
      `user_${messageData.receiverId}_support`,
      'support_message_notification',
      messageData,
      { messageType: 'support_message_notification' },
    );
  }

  return success;
};

/** Deliver a regular conversation message to its room. */
export const broadcastChatMessage = (
  io: Server,
  conversationId: string,
  messageData: BroadcastMessage,
): boolean => {
  if (!io || !conversationId || !messageData) {
    logger.error('[Chat] Invalid parameters for broadcastChatMessage', null, { conversationId });
    return false;
  }

  return safeBroadcastToRoom(io, `conversation_${conversationId}`, 'getMessage', messageData, {
    messageType: 'chat_message',
  });
};

export const safeJoinRoom = (
  io: Server,
  socketId: string,
  roomName: string,
  userId: string | null = null,
  roomType = 'generic',
): boolean => {
  try {
    if (!io || !socketId || !roomName) {
      logger.error(`[${roomType}] Invalid parameters for safeJoinRoom`, null, { socketId, roomName });
      return false;
    }

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      logger.error(`[${roomType}] Socket ${socketId} not found`);
      return false;
    }

    socket.join(roomName);
    logger.debug(`[${roomType}] ${userId ? `User ${userId}` : 'Socket'} joined room ${roomName}`);
    return true;
  } catch (error) {
    logger.error(`[${roomType}] Error joining room`, error, { socketId, roomName });
    return false;
  }
};

export const safeLeaveRoom = (
  io: Server,
  socketId: string,
  roomName: string,
  userId: string | null = null,
  roomType = 'generic',
): boolean => {
  try {
    if (!io || !socketId || !roomName) {
      logger.error(`[${roomType}] Invalid parameters for safeLeaveRoom`, null, { socketId, roomName });
      return false;
    }

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      logger.error(`[${roomType}] Socket ${socketId} not found`);
      return false;
    }

    socket.leave(roomName);
    logger.debug(`[${roomType}] ${userId ? `User ${userId}` : 'Socket'} left room ${roomName}`);
    return true;
  } catch (error) {
    logger.error(`[${roomType}] Error leaving room`, error, { socketId, roomName });
    return false;
  }
};

/** Throws when a socket operation is missing the ids it needs. */
export const validateSocketParams = (
  socketId: string,
  userId: string,
  operation = 'socket operation',
): boolean => {
  if (!socketId) throw new Error(`Socket ID required for ${operation}`);
  if (!userId) throw new Error(`User ID required for ${operation}`);
  return true;
};

/** Fan a notification out to both admin rooms kept for client compatibility. */
export const notifyAdmins = (
  io: Server,
  notificationData: Record<string, unknown>,
  notificationType = 'admin_notification',
): boolean => {
  try {
    const enhanced = {
      ...notificationData,
      type: notificationType,
      serverTime: Date.now(),
      timestamp: VNTimeUtils.getCurrentVNTime().toISOString(),
    };

    io.to('admin_room').emit('admin_notification', enhanced);
    io.to('admin_notifications').emit('admin_notification', enhanced);

    logger.debug(`[Admin] Notification sent - Type: ${notificationType}`);
    return true;
  } catch (error) {
    logger.error('[Admin] Error sending notification', error, { notificationType });
    return false;
  }
};

export default {
  safeBroadcastToRoom,
  safeBroadcastGlobal,
  broadcastSupportMessage,
  broadcastChatMessage,
  safeJoinRoom,
  safeLeaveRoom,
  validateSocketParams,
  notifyAdmins,
};
