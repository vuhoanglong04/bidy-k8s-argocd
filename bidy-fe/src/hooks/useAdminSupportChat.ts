"use client";

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useWebSocketCore } from './useWebSocketCore';
import { useAuth } from './useAuth';
import { useIsAdmin } from './useIsAdmin';
import logger from '@/utils/logger';
import { SupportChatMessage, TypingIndicator, ConnectionState } from '@/types/chat.d';

interface UseAdminSupportChatOptions {
  autoJoinAllChats?: boolean;
  enableNotifications?: boolean;
  enableAudioNotifications?: boolean;
}

// Admin-specific WebSocket interfaces
interface AdminWebSocketFunctions {
  adminJoinAllSupport?: (adminId: string) => void;
  adminJoinSupportChat?: (chatId: string, adminId: string) => void;
  adminSendSupportMessage?: (chatId: string, adminId: string, message: string, messageType?: string) => void;
  adminSendTyping?: (chatId: string, adminId: string, isTyping: boolean) => void;
  adminUpdateChatStatus?: (chatId: string, adminId: string, status: string, additionalData?: unknown) => void;
  clearSupportChatMessages?: () => void;
  clearSupportChatNotifications?: () => void;
  supportChatMessages?: SupportChatMessage[];
  supportChatNotifications?: AdminNotification[];
  typingIndicators?: AdminTypingIndicator[];
  adminStatusUpdates?: AdminStatusUpdate[];
}

interface AdminNotification {
  _id: string;
  type: 'support_chat_created' | 'support_chat_status_update' | 'new_message';
  chatId: string;
  userId?: string;
  adminId?: string;
  timestamp: Date;
  data: unknown;
  chat?: {
    priority: 'low' | 'medium' | 'high';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
  };
}

interface AdminTypingIndicator {
  chatId: string;
  userId: string;
  isTyping: boolean;
  timestamp: Date;
}

interface AdminStatusUpdate {
  adminId: string;
  isOnline: boolean;
  timestamp: Date;
}

interface ChatStatistics {
  totalActiveChats: number;
  unreadMessagesCount: number;
  highPriorityChats: number;
  averageResponseTime: number;
  onlineAdmins: number;
}

interface UseAdminSupportChatReturn {
  // Connection state
  connectionState: ConnectionState;
  
  // Admin chat methods
  joinAllChats: () => void;
  joinSpecificChat: (chatId: string) => void;
  sendMessage: (chatId: string, message: string, messageType?: 'text' | 'image') => void;
  updateChatStatus: (chatId: string, status: string, additionalData?: unknown) => void;
  
  // Typing methods
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  
  // Data
  allMessages: SupportChatMessage[];
  newChatNotifications: AdminNotification[];
  statusUpdates: AdminNotification[];
  typingIndicators: TypingIndicator[];
  
  // Statistics
  chatStatistics: ChatStatistics;
  
  // Filtered data helpers
  getMessagesForChat: (chatId: string) => SupportChatMessage[];
  getUnreadCountForChat: (chatId: string) => number;
  getChatTypingUsers: (chatId: string) => string[];
  
  // Utilities
  clearAllMessages: () => void;
  clearNotifications: () => void;
  markAsJoinedAllChats: () => void;
}

export const useAdminSupportChat = (options: UseAdminSupportChatOptions = {}): UseAdminSupportChatReturn => {
  const {
    autoJoinAllChats = true,
    enableNotifications = true,
    enableAudioNotifications = false
  } = options;

  // Get authenticated admin info
  const { user } = useAuth();
  const adminId = user?._id;
  const { isAdmin } = useIsAdmin();

  // WebSocket connection
  const webSocket = useWebSocketCore();
  const {
    isConnected,
    isConnecting,
    error
  } = webSocket;

  // Type-safe fallback values for admin WebSocket functions
  const adminWebSocket = webSocket as unknown as AdminWebSocketFunctions;
  
  // Memoized data arrays to prevent unnecessary re-renders
  const supportChatMessages = useMemo(() => 
    adminWebSocket.supportChatMessages || [], 
    [adminWebSocket.supportChatMessages]
  );
  
  const supportChatNotifications = useMemo(() => 
    adminWebSocket.supportChatNotifications || [], 
    [adminWebSocket.supportChatNotifications]
  );
  
  const typingIndicators = useMemo(() => 
    adminWebSocket.typingIndicators || [], 
    [adminWebSocket.typingIndicators]
  );
  
  const adminStatusUpdates = useMemo(() => 
    adminWebSocket.adminStatusUpdates || [], 
    [adminWebSocket.adminStatusUpdates]
  );
  
  // Memoized fallback functions with proper typing to prevent re-renders
  const adminJoinAllSupport = useMemo(() => 
    adminWebSocket.adminJoinAllSupport || (() => {}), 
    [adminWebSocket.adminJoinAllSupport]
  );
  
  const adminJoinSupportChat = useMemo(() => 
    adminWebSocket.adminJoinSupportChat || (() => {}), 
    [adminWebSocket.adminJoinSupportChat]
  );
  
  const adminSendSupportMessage = useMemo(() => 
    adminWebSocket.adminSendSupportMessage || (() => {}), 
    [adminWebSocket.adminSendSupportMessage]
  );
  
  const adminSendTyping = useMemo(() => 
    adminWebSocket.adminSendTyping || (() => {}), 
    [adminWebSocket.adminSendTyping]
  );
  
  const adminUpdateChatStatus = useMemo(() => 
    adminWebSocket.adminUpdateChatStatus || (() => {}), 
    [adminWebSocket.adminUpdateChatStatus]
  );
  
  const clearSupportChatMessages = useMemo(() => 
    adminWebSocket.clearSupportChatMessages || (() => {}), 
    [adminWebSocket.clearSupportChatMessages]
  );
  
  const clearSupportChatNotifications = useMemo(() => 
    adminWebSocket.clearSupportChatNotifications || (() => {}), 
    [adminWebSocket.clearSupportChatNotifications]
  );

  // Local state for admin-specific features
  const [hasJoinedAllChats, setHasJoinedAllChats] = useState(false);
  const [readMessageIds] = useState<Set<string>>(new Set());

  // Connection state
  const connectionState: ConnectionState = {
    isConnected,
    isConnecting,
    error
  };

  // Join all support chats for notifications
  const joinAllChats = useCallback(() => {
    if (!adminId || !isAdmin) {
      logger.error('Cannot join chats: Not authenticated as admin');
      return;
    }

    adminJoinAllSupport(adminId);
    setHasJoinedAllChats(true);
    logger.info('Admin joined all support chat notifications');
  }, [adminId, isAdmin, adminJoinAllSupport]);

  // Join specific support chat
  const joinSpecificChat = useCallback((chatId: string) => {
    if (!adminId || !isAdmin) {
      logger.error('Cannot join specific chat: Not authenticated as admin');
      return;
    }

    adminJoinSupportChat(chatId, adminId);
    logger.info(`Admin joined specific chat: ${chatId}`);
  }, [adminId, isAdmin, adminJoinSupportChat]);

  // Send message to support chat
  const sendMessage = useCallback((chatId: string, message: string, messageType: 'text' | 'image' = 'text') => {
    if (!adminId || !isAdmin) {
      logger.error('Cannot send message: Not authenticated as admin');
      return;
    }

    if (!message.trim()) {
      logger.warn('Cannot send empty message');
      return;
    }

    adminSendSupportMessage(chatId, adminId, message, messageType);
    logger.info(`Admin sent message to chat: ${chatId}`);
  }, [adminId, isAdmin, adminSendSupportMessage]);

  // Update chat status
  const updateChatStatus = useCallback((chatId: string, status: string, additionalData?: unknown) => {
    if (!adminId || !isAdmin) {
      logger.error('Cannot update chat status: Not authenticated as admin');
      return;
    }

    adminUpdateChatStatus(chatId, adminId, status, additionalData);
    logger.info(`Admin updated chat status: ${chatId} -> ${status}`);
  }, [adminId, isAdmin, adminUpdateChatStatus]);

  // Typing indicator methods
  const startTyping = useCallback((chatId: string) => {
    if (!adminId || !isAdmin) return;
    adminSendTyping(chatId, adminId, true);
  }, [adminId, isAdmin, adminSendTyping]);

  const stopTyping = useCallback((chatId: string) => {
    if (!adminId || !isAdmin) return;
    adminSendTyping(chatId, adminId, false);
  }, [adminId, isAdmin, adminSendTyping]);

  // Data filtering helpers
  const getMessagesForChat = useCallback((chatId: string): SupportChatMessage[] => {
    return supportChatMessages.filter((msg: SupportChatMessage) => msg.chatId === chatId);
  }, [supportChatMessages]);

  const getUnreadCountForChat = useCallback((chatId: string): number => {
    const chatMessages = getMessagesForChat(chatId);
    return chatMessages.filter(msg => 
      msg.senderType === 'user' && !readMessageIds.has(msg.id || '')
    ).length;
  }, [getMessagesForChat, readMessageIds]);

  const getChatTypingUsers = useCallback((chatId: string): string[] => {
    return typingIndicators
      .filter((indicator: AdminTypingIndicator) => 
        indicator.chatId === chatId && 
        indicator.isTyping && 
        indicator.userId !== adminId
      )
      .map((indicator: AdminTypingIndicator) => indicator.userId);
  }, [typingIndicators, adminId]);

  // Calculate chat statistics
  const chatStatistics = useMemo((): ChatStatistics => {
    // Group messages by chat
    const chatGroups = supportChatMessages.reduce((acc: Record<string, SupportChatMessage[]>, msg: SupportChatMessage) => {
      if (!acc[msg.chatId]) {
        acc[msg.chatId] = [];
      }
      acc[msg.chatId].push(msg);
      return acc;
    }, {} as Record<string, SupportChatMessage[]>);

    const totalActiveChats = Object.keys(chatGroups).length;
    
    const unreadMessagesCount = supportChatMessages.filter((msg: SupportChatMessage) => 
      msg.senderType === 'user' && !readMessageIds.has(msg.id || '')
    ).length;

    // Count high priority chats from notifications
    const highPriorityChats = supportChatNotifications.filter((notification: AdminNotification) => 
      notification.type === 'support_chat_created' && 
      notification.chat?.priority === 'high'
    ).length;

    // Count online admins
    const onlineAdmins = Object.values(
      adminStatusUpdates.reduce((acc: Record<string, boolean>, update: AdminStatusUpdate) => {
        acc[update.adminId] = update.isOnline;
        return acc;
      }, {} as Record<string, boolean>)
    ).filter(isOnline => isOnline).length;

    // Calculate average response time from admin message timestamps
    const averageResponseTime = 0; // Placeholder - needs proper implementation

    return {
      totalActiveChats,
      unreadMessagesCount,
      highPriorityChats,
      averageResponseTime,
      onlineAdmins
    };
  }, [supportChatMessages, supportChatNotifications, adminStatusUpdates, readMessageIds]);

  // Auto-join all chats when connected
  useEffect(() => {
    if (isConnected && autoJoinAllChats && !hasJoinedAllChats && adminId && isAdmin) {
      joinAllChats();
    }
  }, [isConnected, autoJoinAllChats, hasJoinedAllChats, adminId, isAdmin, joinAllChats]);

  // Handle new message notifications
  useEffect(() => {
    if (enableNotifications && supportChatMessages.length > 0) {
      const latestMessage = supportChatMessages[0];
      
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
  }, [supportChatMessages, enableNotifications, enableAudioNotifications]);

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

  // Mark as joined all chats utility
  const markAsJoinedAllChats = useCallback(() => {
    setHasJoinedAllChats(true);
  }, []);

  return {
    // Connection state
    connectionState,
    
    // Admin chat methods
    joinAllChats,
    joinSpecificChat,
    sendMessage,
    updateChatStatus,
    
    // Typing methods
    startTyping,
    stopTyping,
    
    // Data
    allMessages: supportChatMessages,
    newChatNotifications: supportChatNotifications,
    statusUpdates: supportChatNotifications.filter((n: AdminNotification) => n.type === 'support_chat_status_update'),
    typingIndicators: typingIndicators.map((indicator: AdminTypingIndicator): TypingIndicator => ({
      isTyping: indicator.isTyping,
      typingUsers: indicator.isTyping ? [indicator.userId] : []
    })),
    
    // Statistics
    chatStatistics,
    
    // Filtered data helpers
    getMessagesForChat,
    getUnreadCountForChat,
    getChatTypingUsers,
    
    // Utilities
    clearAllMessages: clearSupportChatMessages,
    clearNotifications: clearSupportChatNotifications,
    markAsJoinedAllChats
  };
};

export default useAdminSupportChat;