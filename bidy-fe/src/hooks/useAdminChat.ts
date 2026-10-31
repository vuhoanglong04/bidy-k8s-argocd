"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWebSocketCore } from './useWebSocketCore';
import { useAuth } from './useAuth';
import { useIsAdmin } from './useIsAdmin';
import axiosClient from '@/lib/axios-client';
import { API_ROUTES } from '@/constants/routes.constants';
import { mapSupportMessages } from '@/services/support-chat.mapper';
import { WEBSOCKET_EVENTS } from '@/constants/app.enum';
import logger from '@/utils/logger';
import { 
  AdminSupportChat, 
  UpdateChatStatusRequest
} from '@/types/admin-chat';
import { SupportChatMessage } from '@/types/chat';

// Consolidated interface for admin chat management
interface UseAdminChatOptions {
  autoJoinAllChats?: boolean;
  enableNotifications?: boolean;
  enableAudioNotifications?: boolean;
}

interface ChatStatistics {
  totalActiveChats: number;
  unreadMessagesCount: number;
  highPriorityChats: number;
  averageResponseTime: number;
  onlineAdmins: number;
}

interface UseAdminChatReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  
  // Global admin methods
  joinAllChats: () => void;
  joinSpecificChat: (chatId: string) => void;
  updateChatStatus: (chatId: string, status: string, additionalData?: Record<string, unknown>) => Promise<void>;
  
  // Chat-specific methods (for individual chat management)
  getChatDetail: (chatId: string) => Promise<AdminSupportChat | null>;
  loadChatMessages: (chatId: string, page?: number) => Promise<SupportChatMessage[]>;
  sendMessage: (chatId: string, message: string, messageType?: 'text' | 'image') => Promise<SupportChatMessage | null>;
  markChatAsRead: (chatId: string) => Promise<void>;
  
  // Typing methods
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  
  // Data streams
  allMessages: SupportChatMessage[];
  newChatNotifications: Array<{ type: string; chat?: { priority?: string } }>;
  statusUpdates: Array<{ type: string }>;
  
  // Chat-specific data (for individual chat view)
  getChatMessages: (chatId: string) => SupportChatMessage[];
  getChatTypingUsers: (chatId: string) => string[];
  getUnreadCountForChat: (chatId: string) => number;
  
  // Statistics
  chatStatistics: ChatStatistics;
  
  // Utilities
  clearAllMessages: () => void;
  clearNotifications: () => void;
}

export const useAdminChat = (options: UseAdminChatOptions = {}): UseAdminChatReturn => {
  const {
    autoJoinAllChats = true,
    enableNotifications = true,
    enableAudioNotifications = false
  } = options;

  // Get authenticated admin info
  const { user } = useAuth();
  const adminId = user?._id;
  const { isAdmin } = useIsAdmin();

  // Core WebSocket connection (no more duplication)
  const {
    isConnected,
    isConnecting,
    error,
    messages: wsMessages,
    notifications,
    adminStatusUpdates,
    getMessagesForChat,
    getTypingUsersForChat,
    emit,
    clearMessages,
    clearNotifications,
  } = useWebSocketCore({ autoConnect: true });

  // Local state for admin-specific features
  const [hasJoinedAllChats, setHasJoinedAllChats] = useState(false);
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());
  const [chatCache, setChatCache] = useState<Map<string, AdminSupportChat>>(new Map());
  const [apiMessagesCache, setApiMessagesCache] = useState<Map<string, SupportChatMessage[]>>(new Map());

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Join all support chats for notifications
  const joinAllChats = useCallback(() => {
    if (!adminId || !isAdmin) {
      logger.error('Cannot join chats: Not authenticated as admin');
      return;
    }

    emit('admin_join_all', { adminId });
    setHasJoinedAllChats(true);
    logger.info('Admin joined all support chat notifications');
  }, [adminId, isAdmin, emit]);

  // Join specific support chat
  const joinSpecificChat = useCallback((chatId: string) => {
    if (!adminId || !isAdmin) {
      logger.error('Cannot join specific chat: Not authenticated as admin');
      return;
    }

    emit('admin_join_chat', { chatId, adminId });
    logger.info(`Admin joined specific chat: ${chatId}`);
  }, [adminId, isAdmin, emit]);

  // Get chat detail from API
  const getChatDetail = useCallback(async (chatId: string): Promise<AdminSupportChat | null> => {
    try {
      // Check cache first
      if (chatCache.has(chatId)) {
        return chatCache.get(chatId)!;
      }

      const response = await axiosClient.get(API_ROUTES.ADMIN_SUPPORT_CHAT_BY_ID(chatId));
      
      if (response.data.status === 'success') {
        const chatData = response.data.data.chat;
        setChatCache(prev => new Map(prev).set(chatId, chatData));
        return chatData;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get chat detail:', error);
      throw error;
    }
  }, [chatCache]);

  // Load messages for a specific chat
  const loadChatMessages = useCallback(async (chatId: string, page: number = 1): Promise<SupportChatMessage[]> => {
    try {
      const response = await axiosClient.get(
        `${API_ROUTES.ADMIN_SUPPORT_CHAT_MESSAGES(chatId)}?page=${page}&limit=50`
      );
      
      if (response.data.status === 'success') {
        // REST trả entity thô — map về shape FE, nếu không timestamp là
        // Invalid Date và `message` rỗng.
        const messages = mapSupportMessages(
          response.data.data.messages,
          response.data.data.chat?.userId
        );

        // Cache API messages separately
        if (page === 1) {
          setApiMessagesCache(prev => new Map(prev).set(chatId, messages));
        } else {
          setApiMessagesCache(prev => {
            const existing = prev.get(chatId) || [];
            const combined = [...existing, ...messages];
            return new Map(prev).set(chatId, combined);
          });
        }
        
        return messages;
      }
      return [];
    } catch (error) {
      logger.error('Failed to load chat messages:', error);
      throw error;
    }
  }, []);

  // Send message to support chat
  const sendMessage = useCallback(async (
    chatId: string, 
    message: string, 
    messageType: 'text' | 'image' = 'text'
  ): Promise<SupportChatMessage | null> => {
    if (!adminId || !isAdmin || !message.trim()) {
      logger.error('Cannot send message: Invalid params or not authenticated as admin');
      return null;
    }

    // Socket-only: BE lưu DB trong chính handler `admin_send_message` rồi mới
    // broadcast, và trả `support_message_ack` kèm `clientMessageId`. REST
    // `POST /admin/support/chats/:chatId/messages` chỉ còn dành cho caller không
    // tương tác (script, integration).
    const clientMessageId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `temp-admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      emit(WEBSOCKET_EVENTS.ADMIN_SEND_MESSAGE, {
        chatId,
        message: message.trim(),
        messageType,
        clientMessageId,
      });

      // Bản chính thức về qua `support_message_ack` / `new_support_message`;
      // không có gì để trả về đồng bộ ở đây nữa.
      return null;
    } catch (error) {
      logger.error('Failed to send admin message:', error);
      throw error;
    }
  }, [adminId, isAdmin, emit]);

  // Update chat status
  const updateChatStatus = useCallback(async (
    chatId: string, 
    status: string, 
    additionalData?: Record<string, unknown>
  ): Promise<void> => {
    if (!adminId || !isAdmin) {
      logger.error('Cannot update chat status: Not authenticated as admin');
      return;
    }

    try {
      const updateData: UpdateChatStatusRequest = {
        chatId,
        status: status as AdminSupportChat['status'],
        ...additionalData
      };

      await axiosClient.patch(API_ROUTES.ADMIN_SUPPORT_CHAT_STATUS(chatId), updateData);
      
      // Update cached chat
      setChatCache(prev => {
        const chat = prev.get(chatId);
        if (chat) {
          return new Map(prev).set(chatId, { ...chat, status: status as AdminSupportChat['status'] });
        }
        return prev;
      });
      
      // Emit socket event for real-time updates
      emit('admin_status_update', { chatId, adminId, status, additionalData });
      
      logger.info(`Admin updated chat status: ${chatId} -> ${status}`);
    } catch (error) {
      logger.error('Failed to update chat status:', error);
      throw error;
    }
  }, [adminId, isAdmin, emit]);

  // Mark chat as read
  const markChatAsRead = useCallback(async (chatId: string): Promise<void> => {
    try {
      await axiosClient.patch(API_ROUTES.ADMIN_SUPPORT_CHAT_READ(chatId));
      
      // Update local read state
      const chatMessages = getMessagesForChat(chatId);
      const messageIds = chatMessages.map(msg => msg.id).filter(Boolean) as string[];
      setReadMessageIds(prev => {
        const newSet = new Set(prev);
        messageIds.forEach(id => newSet.add(id));
        return newSet;
      });
      
      logger.info(`Marked chat as read: ${chatId}`);
    } catch (error) {
      logger.error('Failed to mark chat as read:', error);
      throw error;
    }
  }, [getMessagesForChat]);

  // Typing indicator methods
  const startTyping = useCallback((chatId: string) => {
    if (!adminId || !isAdmin) return;
    
    emit('admin_typing', { chatId, adminId, isTyping: true });
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      emit('admin_typing', { chatId, adminId, isTyping: false });
    }, 3000);
  }, [adminId, isAdmin, emit]);

  const stopTyping = useCallback((chatId: string) => {
    if (!adminId || !isAdmin) return;
    
    emit('admin_typing', { chatId, adminId, isTyping: false });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [adminId, isAdmin, emit]);

  // Get unified messages for a specific chat (API + WebSocket)
  const getChatMessages = useCallback((chatId: string): SupportChatMessage[] => {
    const apiMessages = apiMessagesCache.get(chatId) || [];
    const wsMessages = getMessagesForChat(chatId);
    
    // Combine and deduplicate
    const combined = [...apiMessages];
    
    wsMessages.forEach(wsMsg => {
      const messageId = wsMsg.id;
      const exists = combined.some(apiMsg => apiMsg.id === messageId);
      
      if (!exists && messageId) {
        // Convert WebSocket message format
        const convertedMessage: SupportChatMessage = {
          id: wsMsg.id || wsMsg.id || '',
          chatId: wsMsg.chatId,
          senderId: wsMsg.senderId || '',
          senderType: wsMsg.senderType,
          message: wsMsg.message,
          messageType: wsMsg.messageType,
          timestamp: typeof wsMsg.timestamp === 'string' ? new Date(wsMsg.timestamp) : wsMsg.timestamp,
          isRead: wsMsg.isRead || false,
        };
        combined.push(convertedMessage);
      }
    });

    return combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [apiMessagesCache, getMessagesForChat]);

  // Get typing users for specific chat
  const getChatTypingUsers = useCallback((chatId: string): string[] => {
    return getTypingUsersForChat(chatId).filter(userId => userId !== adminId);
  }, [getTypingUsersForChat, adminId]);

  // Get unread count for specific chat
  const getUnreadCountForChat = useCallback((chatId: string): number => {
    const chatMessages = getChatMessages(chatId);
    return chatMessages.filter(msg => 
      msg.senderType === 'user' && !readMessageIds.has(msg.id || '')
    ).length;
  }, [getChatMessages, readMessageIds]);

  // Calculate chat statistics
  const chatStatistics = useMemo((): ChatStatistics => {
    // Group WebSocket messages by chat
    const chatGroups = wsMessages.reduce((acc, msg) => {
      if (!acc[msg.chatId]) {
        acc[msg.chatId] = [];
      }
      acc[msg.chatId].push(msg);
      return acc;
    }, {} as { [chatId: string]: typeof wsMessages });

    const totalActiveChats = Object.keys(chatGroups).length;
    
    const unreadMessagesCount = wsMessages.filter(msg => 
      msg.senderType === 'user' && !readMessageIds.has(msg.id || '')
    ).length;

    // Count high priority chats from notifications
    const highPriorityChats = notifications.filter(notification => 
      notification.type === 'support_chat_created' && 
      notification.chat?.priority === 'high'
    ).length;

    // Count online admins
    const onlineAdmins = Object.values(
      adminStatusUpdates.reduce((acc, update) => {
        acc[update.adminId] = update.isOnline;
        return acc;
      }, {} as { [adminId: string]: boolean })
    ).filter(isOnline => isOnline).length;

    return {
      totalActiveChats,
      unreadMessagesCount,
      highPriorityChats,
      averageResponseTime: 0, // Calculated separately due to type mismatch
      onlineAdmins
    };
  }, [wsMessages, notifications, adminStatusUpdates, readMessageIds]);

  // Auto-join all chats when connected
  useEffect(() => {
    if (isConnected && autoJoinAllChats && !hasJoinedAllChats && adminId && isAdmin) {
      joinAllChats();
    }
  }, [isConnected, autoJoinAllChats, hasJoinedAllChats, adminId, isAdmin, joinAllChats]);

  // Handle new message notifications
  useEffect(() => {
    if (enableNotifications && wsMessages.length > 0) {
      const latestMessage = wsMessages[0];
      
      // Only show notification for user messages
      if (latestMessage.senderType === 'user') {
        // Browser notification
        if (Notification.permission === 'granted') {
          new Notification('New Support Message', {
            body: `${latestMessage.message.substring(0, 100)}...`,
            icon: '/support-icon.png',
            tag: latestMessage.chatId
          });
        }

        // Audio notification
        if (enableAudioNotifications) {
          try {
            const audio = new Audio('/notification-sound.wav');
            audio.play().catch(err => 
              logger.warn('Could not play notification sound:', err)
            );
          } catch (err) {
            logger.warn('Audio notification error:', { error: err });
          }
        }
      }
    }
  }, [wsMessages, enableNotifications, enableAudioNotifications]);

  // Request notification permission on mount
  useEffect(() => {
    if (enableNotifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            logger.info('Notification permission granted');
          }
        });
      }
    }
  }, [enableNotifications]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Connection state
    isConnected,
    isConnecting,
    error,
    
    // Global admin methods
    joinAllChats,
    joinSpecificChat,
    updateChatStatus,
    
    // Chat-specific methods
    getChatDetail,
    loadChatMessages,
    sendMessage,
    markChatAsRead,
    
    // Typing methods
    startTyping,
    stopTyping,
    
    // Data streams (converted to SupportChatMessage format)
    allMessages: wsMessages.map(msg => ({
      id: msg.id || '',
      chatId: msg.chatId,
      senderId: msg.senderId || '',
      senderType: msg.senderType,
      message: msg.message,
      messageType: msg.messageType,
      timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp,
      isRead: msg.isRead || false,
    })) as SupportChatMessage[],
    newChatNotifications: notifications,
    statusUpdates: notifications.filter(n => n.type === 'support_chat_status_update'),
    
    // Chat-specific data helpers
    getChatMessages,
    getChatTypingUsers,
    getUnreadCountForChat,
    
    // Statistics
    chatStatistics,
    
    // Utilities
    clearAllMessages: clearMessages,
    clearNotifications,
  };
};

export default useAdminChat;