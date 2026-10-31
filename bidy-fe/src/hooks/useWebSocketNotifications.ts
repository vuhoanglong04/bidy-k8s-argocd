"use client";

import { useEffect } from 'react';
import { useWebSocketCore } from '@/hooks/useWebSocketCore';
import { WEBSOCKET_EVENTS } from '@/constants/app.enum';
import { useNotifications } from '@/contexts/NotificationContext';

export function useWebSocketNotifications() {
  const { socket, isConnected } = useWebSocketCore();
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for new support chat created
    const handleNewSupportChat = (data: {
      userName?: string;
      chatId?: string;
      _id?: string;
    }) => {
      console.log('New support chat created:', data);
      
      addNotification({
        type: 'new_chat',
        title: '🆕 Cuộc trò chuyện mới',
        message: `${data.userName || 'Khách hàng'} vừa bắt đầu cuộc trò chuyện`,
        priority: 'medium',
        chatId: data.chatId || data._id
      });
    };

    // Listen for new support messages
    const handleNewSupportMessage = (data: {
      senderType: 'user' | 'admin';
      sender?: { type: 'user' | 'admin' };
      message?: string;
      priority?: string;
      chatId?: string;
      supportChatId?: string;
    }) => {
      console.log('New support message:', data);
      
      // Only notify for user messages (not admin messages)
      if (data.senderType === 'user' || data.sender?.type === 'user') {
        const isUrgent = data.message?.toLowerCase().includes('khẩn cấp') ||
                        data.message?.toLowerCase().includes('urgent') ||
                        data.priority === 'high';

        addNotification({
          type: isUrgent ? 'urgent_chat' : 'new_message',
          title: isUrgent ? '🚨 Tin nhắn khẩn cấp' : '💬 Tin nhắn mới',
          message: data.message ? 
                  (data.message.length > 50 ? data.message.substring(0, 47) + '...' : data.message) :
                  'Tin nhắn mới từ khách hàng',
          priority: isUrgent ? 'high' : 'medium',
          chatId: data.chatId || data.supportChatId
        });
      }
    };

    // Listen for chat status updates
    const handleChatStatusUpdate = (data: {
      status: string;
      userName?: string;
      chatId: string;
    }) => {
      console.log('Chat status updated:', data);
      
      if (data.status === 'resolved' || data.status === 'closed') {
        addNotification({
          type: 'chat_resolved',
          title: '✅ Cuộc trò chuyện đã giải quyết',
          message: `Cuộc trò chuyện với ${data.userName || 'khách hàng'} đã được giải quyết`,
          priority: 'low',
          chatId: data.chatId
        });
      } else if (data.status === 'urgent') {
        addNotification({
          type: 'urgent_chat',
          title: '🚨 Cuộc trò chuyện khẩn cấp',
          message: `Cuộc trò chuyện với ${data.userName || 'khách hàng'} cần được xử lý gấp`,
          priority: 'high',
          chatId: data.chatId
        });
      }
    };

    // Listen for system notifications
    const handleSystemNotification = (data: {
      message?: string;
      priority?: string;
    }) => {
      console.log('System notification:', data);
      
      addNotification({
        type: 'system',
        title: '⚙️ Thông báo hệ thống',
        message: data.message || 'Thông báo từ hệ thống',
        priority: (data.priority as 'low' | 'medium' | 'high') || 'low'
      });
    };

    // Register event listeners.
    // Đã gỡ `new_support_chat`, `chat_status_updated`, `admin_mentioned`,
    // `system_notification` — backend không emit event nào trong số đó.
    socket.on(WEBSOCKET_EVENTS.SUPPORT_CHAT_CREATED, handleNewSupportChat);
    socket.on(WEBSOCKET_EVENTS.NEW_SUPPORT_MESSAGE, handleNewSupportMessage);
    socket.on(WEBSOCKET_EVENTS.SUPPORT_CHAT_STATUS_UPDATE, handleChatStatusUpdate);
    socket.on(WEBSOCKET_EVENTS.CHAT_STATUS_CHANGED, handleChatStatusUpdate);
    socket.on(WEBSOCKET_EVENTS.ADMIN_NOTIFICATION, handleSystemNotification);

    // Cleanup listeners
    return () => {
      socket.off(WEBSOCKET_EVENTS.SUPPORT_CHAT_CREATED, handleNewSupportChat);
      socket.off(WEBSOCKET_EVENTS.NEW_SUPPORT_MESSAGE, handleNewSupportMessage);
      socket.off(WEBSOCKET_EVENTS.SUPPORT_CHAT_STATUS_UPDATE, handleChatStatusUpdate);
      socket.off(WEBSOCKET_EVENTS.CHAT_STATUS_CHANGED, handleChatStatusUpdate);
      socket.off(WEBSOCKET_EVENTS.ADMIN_NOTIFICATION, handleSystemNotification);
    };
  }, [socket, isConnected, addNotification]);

  return { isConnected };
}