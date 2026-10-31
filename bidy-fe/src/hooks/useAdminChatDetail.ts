"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { SOCKET_ERROR_CODES, useWebSocketCore } from './useWebSocketCore';
import { useAuth } from './useAuth';
import { 
  AdminSupportChat, 
  UpdateChatStatusRequest
} from '@/types/admin-chat';
import { SupportChatMessage } from '@/types/chat';
import axiosClient from '@/lib/axios-client';
import { API_ROUTES } from '@/constants/routes.constants';
import { mapAdminChat, mapSupportMessages } from '@/services/support-chat.mapper';
import { WEBSOCKET_EVENTS } from '@/constants/app.enum';

interface UseAdminChatDetailParams {
  chatId: string;
  initialPage?: number;
  limit?: number;
}

export function useAdminChatDetail({ 
  chatId, 
  initialPage = 1, 
  limit = 50 
}: UseAdminChatDetailParams) {
  const [chat, setChat] = useState<AdminSupportChat | null>(null);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit,
    total: 0,
    hasMore: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  /** `clientMessageId` của các bong bóng lạc quan đang chờ `support_message_ack`. */
  const pendingMessageIdsRef = useRef<Set<string>>(new Set());
  /** Chủ ticket — dùng để suy `senderType` khi payload cũ không có field đó. */
  const chatUserIdRef = useRef<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Get authenticated admin info
  const { user } = useAuth();
  const adminId = user?._id || 'current-admin'; // Fallback for development

  // WebSocket connection
  const { socket, isConnected } = useWebSocketCore();

  // Fetch chat details and messages
  const fetchChatDetail = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      if (page === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      // Fetch chat details first
      const chatResponse = await axiosClient.get(
        API_ROUTES.ADMIN_SUPPORT_CHAT_BY_ID(chatId)
      );
      
      if (chatResponse.data.status !== 'success') {
        setError(chatResponse.data.message || 'Không thể tải chi tiết cuộc trò chuyện');
        return;
      }

      // Fetch messages separately
      const messagesResponse = await axiosClient.get(
        `${API_ROUTES.ADMIN_SUPPORT_CHAT_MESSAGES(chatId)}?page=${page}&limit=${limit}`
      );
      
      if (messagesResponse.data.status === 'success') {
        // `GET /admin/support/chats/:chatId` trả entity ticket thô — map để có
        // `lastMessageAt`, `priority`, `unreadByAdmin` mà UI đang đọc.
        const rawChat = chatResponse.data.data.chat;
        const chatData = rawChat
          ? ({ ...rawChat, ...mapAdminChat(rawChat) } as AdminSupportChat)
          : rawChat;
        // Phân trang phẳng: `totalPages`/`currentPage`/`totalMessages`/`hasMore`,
        // KHÔNG bọc trong `pagination`. Và page 1 là các tin MỚI NHẤT — trong
        // một trang thì rows vẫn cũ→mới, nên trang sau prepend vào đầu list.
        const messagesData = messagesResponse.data.data ?? {};
        const newPagination = messagesData.pagination ?? {
          page: messagesData.currentPage ?? page,
          limit,
          total: messagesData.totalMessages ?? 0,
          hasMore: Boolean(messagesData.hasMore),
        };
        // REST trả entity thô (`content`/`createdAt`/`ticketId`) và không có
        // `senderType` — map về shape FE, suy `senderType` từ chủ ticket.
        const newMessages = mapSupportMessages(
          messagesData.messages,
          chatData?.userId
        );
        
        setChat(chatData);
        chatUserIdRef.current = chatData.userId ?? null;
        
        if (append) {
          // Prepend older messages
          setMessages(prev => [...newMessages, ...prev]);
        } else {
          // Set initial messages
          setMessages(newMessages);
        }
        
        setPagination(newPagination);
        
        // Mark chat as read when loading first page (UI-first update)
        if (page === 1 && chatData.id && chatData.unreadByAdmin > 0) {
          console.log(`✅ Admin opening chat, marking ${chatData.unreadByAdmin} messages as read`);
          
          // Update UI immediately
          setChat(prev => prev ? { ...prev, unreadByAdmin: 0 } : prev);

          // BE yêu cầu messageIds cụ thể — gom các tin chưa đọc do user gửi.
          const unreadAdminMessageIds = newMessages
            .filter((msg) => msg.senderType === 'user' && !msg.isRead)
            .map((msg) => msg.id);

          // Call mark-as-read API in background
          axiosClient.patch(API_ROUTES.ADMIN_SUPPORT_CHAT_READ(chatData.id))
            .then(() => {
              console.log('✅ Admin messages marked as read in database');
              
              // Emit WebSocket event
              if (socket?.connected) {
                // BE: socket.on('user_read_messages', ({ chatId, messageIds }))
                socket.emit(WEBSOCKET_EVENTS.USER_READ_MESSAGES, {
                  chatId: chatData.id,
                  messageIds: unreadAdminMessageIds,
                });
              }
            })
            .catch(error => {
              console.warn('Failed to mark chat as read:', error);
              // UI already updated, so user experience is not affected
            });
        }
      } else {
        setError(messagesResponse.data.message || 'Không thể tải tin nhắn');
      }
    } catch (err: unknown) {
      const error = err as Error & { response?: { data?: { message?: string } } };
      console.error('Error fetching chat detail:', error);
      setError(error.response?.data?.message || 'Lỗi kết nối server');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [chatId, limit, socket]);

  // Giữ tham chiếu mới nhất cho các handler socket dùng lại.
  const fetchChatDetailRef = useRef(fetchChatDetail);
  fetchChatDetailRef.current = fetchChatDetail;

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!pagination?.hasMore || isLoadingMore) return;
    
    await fetchChatDetail((pagination?.page || 1) + 1, true);
  }, [fetchChatDetail, pagination?.hasMore, pagination?.page, isLoadingMore]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // Send message — socket-only, có ack.
  //
  // Trước đây mỗi tin nhắn là một `POST /admin/support/chats/:chatId/messages`
  // vì socket không trả gì để await. BE đã thêm `support_message_ack` (kèm
  // `clientMessageId`) nên đường REST không còn lý do tồn tại trong admin panel:
  // handler socket lưu DB qua cùng service rồi mới broadcast.
  const sendMessage = useCallback(async (
    message: string,
    messageType: 'text' | 'image' = 'text'
  ) => {
    if (!message.trim() || !chat || isSending) return;

    if (!socket?.connected) {
      throw new Error('Mất kết nối realtime, không gửi được tin nhắn.');
    }

    // `clientMessageId` chính là id của bong bóng tạm nên ack/echo khớp được
    // ngay, không cần bảng ánh xạ riêng.
    const clientMessageId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `temp-admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      setIsSending(true);

      const optimisticMessage: SupportChatMessage = {
        id: clientMessageId,
        clientMessageId,
        chatId,
        senderId: adminId,
        senderType: 'admin',
        message: message.trim(),
        messageType,
        timestamp: new Date(),
        isRead: false,
      };

      pendingMessageIdsRef.current.add(clientMessageId);
      setMessages(prev => [...prev, optimisticMessage]);
      setChat(prev => prev ? { ...prev, lastMessageAt: new Date() } : null);
      scrollToBottom();

      // Không await gì — bản chính thức về qua `support_message_ack` và
      // `new_support_message` (không đảm bảo thứ tự giữa hai event).
      socket.emit(WEBSOCKET_EVENTS.ADMIN_SEND_MESSAGE, {
        chatId,
        message: message.trim(),
        messageType,
        clientMessageId,
      });

      return clientMessageId;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error sending message:', error);

      // Chỉ gỡ đúng bong bóng vừa hỏng, không đụng các tin đang bay khác.
      pendingMessageIdsRef.current.delete(clientMessageId);
      setMessages(prev => prev.filter(msg => msg.id !== clientMessageId));

      throw error;
    } finally {
      setIsSending(false);
    }
  }, [chat, chatId, isSending, scrollToBottom, adminId, socket]);

  // Update chat status
  const updateChatStatus = useCallback(async (
    status: AdminSupportChat['status'],
    priority?: AdminSupportChat['priority'],
    internalNote?: string
  ) => {
    if (!chat) return;
    
    try {
      const updateData: UpdateChatStatusRequest = {
        chatId,
        status,
        priority,
        internalNote
      };

      const response = await axiosClient.patch(API_ROUTES.ADMIN_SUPPORT_CHAT_STATUS(chatId), updateData);
      
      if (response.data.status === 'success') {
        // Update local chat state
        setChat(prev => prev ? {
          ...prev,
          status,
          ...(priority && { priority })
        } : null);
        
        // BE: socket.on('admin_status_update', ({ chatId, status, additionalData }))
        // — adminId lấy từ JWT, và server tự kiểm role 'admin'.
        if (socket && isConnected) {
          socket.emit(WEBSOCKET_EVENTS.ADMIN_STATUS_UPDATE, {
            chatId,
            status,
            additionalData: { priority, internalNote },
          });
        }
        
        return response.data;
      } else {
        throw new Error(response.data.message);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error updating chat status:', error);
      throw error;
    }
  }, [chat, chatId, socket, isConnected]);

  // Mark chat as read (UI-first update like user chat)
  const markChatAsRead = useCallback(async () => {
    if (!chat || chat.unreadByAdmin === 0) return;
    
    const unreadCount = chat.unreadByAdmin;
    console.log(`✅ Admin marking ${unreadCount} messages as read for chat ${chatId}`);
    
    // Update UI immediately for better UX
    setChat(prev => prev ? { ...prev, unreadByAdmin: 0 } : null);
    
    try {
      // Call API to persist the change
      const response = await axiosClient.patch(API_ROUTES.ADMIN_SUPPORT_CHAT_READ(chatId));
      
      if (response.data.status === 'success') {
        console.log('✅ Admin messages marked as read in database');
        
        // BE: socket.on('user_read_messages', ({ chatId, messageIds }))
        if (socket?.connected) {
          socket.emit(WEBSOCKET_EVENTS.USER_READ_MESSAGES, {
            chatId,
            messageIds: messages
              .filter(msg => msg.senderType === 'user' && !msg.isRead)
              .map(msg => msg.id),
          });
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('Failed to mark admin messages as read:', error);
      // UI already updated, so user experience is not affected
    }
  }, [chat, chatId, socket, messages]);

  // Typing indicator
  const sendTypingIndicator = useCallback((isTypingNow: boolean) => {
    if (socket && isConnected) {
      socket.emit(WEBSOCKET_EVENTS.ADMIN_TYPING, { chatId, isTyping: isTypingNow });
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    setIsTyping(isTypingNow);
    
    if (isTypingNow) {
      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        if (socket && isConnected) {
          socket.emit(WEBSOCKET_EVENTS.ADMIN_TYPING, { chatId, isTyping: false });
        }
      }, 3000);
    }
  }, [socket, isConnected, chatId]);

  // WebSocket event handlers
  useEffect(() => {
    if (!socket || !isConnected || !chatId) return;

    const handleNewMessage = (message: SupportChatMessage | {
      _id?: string;
      chatId: string;
      data?: SupportChatMessage;
      message?: SupportChatMessage;
      timestamp: string;
    }) => {
      // Handle nested message structure from WebSocket
      let actualMessage: SupportChatMessage;
      
      // Check if message is wrapped in a 'data' property
      if (message && typeof message === 'object' && 'data' in message && message.data && typeof message.data === 'object') {
        actualMessage = message.data as SupportChatMessage;
      }
      // Check if message is wrapped in a 'message' property
      else if (message && typeof message === 'object' && 'message' in message && message.message && typeof message.message === 'object') {
        actualMessage = message.message as SupportChatMessage;
      }
      else {
        actualMessage = message as SupportChatMessage;
      }

      // BE broadcast dùng key `messageId` (xem support.service.ts →
      // broadcastSupportMessage). Chuẩn hoá về shape của `SupportChatMessage`
      // trước khi dùng, nếu không mọi tin nhắn realtime đều rơi vào nhánh
      // "missing ID" và biến mất.
      const raw = actualMessage as SupportChatMessage & { messageId?: string };
      actualMessage = {
        ...raw,
        id: raw.id ?? raw.messageId ?? '',
        // `senderType` do BE derive từ `ticket.userId` trong DB. Fallback dưới
        // chỉ phòng payload cũ, và phải so với CHỦ ticket chứ không so với admin
        // đang xem: admin B trả lời ticket mà admin A đang mở thì so với adminId
        // sẽ gán nhầm tin của B thành tin của khách.
        senderType:
          raw.senderType ??
          (chatUserIdRef.current && String(raw.senderId) === String(chatUserIdRef.current)
            ? 'user'
            : 'admin'),
      };

      // Only process messages for the current chat with valid IDs
      // `chat.id` là bigint của BE, serialize ra string — nhưng payload socket
      // đi qua nhiều lớp, so bằng String() cho chắc thay vì `===` trần.
      if (String(actualMessage.chatId) === String(chatId) && actualMessage.id) {
        setMessages(prev => {
          // Create a Set of existing message IDs for faster duplicate detection
          const existingMessageIds = new Set(prev.map(msg => msg.id));

          // Use Set for O(1) duplicate detection
          if (existingMessageIds.has(actualMessage.id)) {
            if (process.env.NODE_ENV === 'development') {
              console.log('🔄 [AdminChat] Duplicate message filtered:', { messageId: actualMessage.id });
            }
            return prev; // Return previous state if duplicate exists
          }

          if (process.env.NODE_ENV === 'development') {
            console.log('✅ [AdminChat] Adding new message:', { messageId: actualMessage.id, chatId: actualMessage.chatId });
          }

          // Thay bong bóng lạc quan bằng bản thật, khớp theo `clientMessageId`
          // do BE echo lại. Cách cũ so nội dung trong cửa sổ 5 giây sẽ xoá nhầm
          // khi admin gửi cùng một chuỗi hai lần liên tiếp.
          const echoedClientId = actualMessage.clientMessageId;
          if (echoedClientId) {
            pendingMessageIdsRef.current.delete(echoedClientId);
          }
          const filteredMessages = prev.filter(
            msg => !(echoedClientId && msg.id === echoedClientId)
          );

          // Add new message
          const newMessages = [...filteredMessages, actualMessage];

          // Double-check uniqueness using Map (in case of race conditions)
          const uniqueMessages = Array.from(
            new Map(newMessages.map(msg => [msg.id, msg])).values()
          );

          return uniqueMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        });
        
        // Update chat's lastMessage
        setChat(prev => prev ? {
          ...prev,
          lastMessageAt: new Date(actualMessage.timestamp)
        } : null);
        
        // Auto-scroll if user is at bottom
        setTimeout(scrollToBottom, 100);
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ [AdminChat] Message filtered out:', { 
            actualMessageChatId: actualMessage.chatId, 
            currentChatId: chatId,
            hasId: !!actualMessage.id,
            reason: !actualMessage.id ? 'missing ID' : 'wrong chat'
          });
        }
      }
    };

    const handleTypingIndicator = (data: { chatId: string; userId: string; isTyping: boolean }) => {
      if (String(data.chatId) === String(chatId)) {
        setTypingUsers(prev => {
          if (data.isTyping) {
            return [...prev.filter(id => id !== data.userId), data.userId];
          } else {
            return prev.filter(id => id !== data.userId);
          }
        });
      }
    };

    const handleChatStatusUpdate = (data: { chatId: string; status: string }) => {
      if (String(data.chatId) === String(chatId)) {
        setChat(prev => prev ? {
          ...prev,
          status: data.status as AdminSupportChat['status']
        } : null);
      }
    };

    // Handle real-time unread count updates
    const handleUnreadCountUpdate = (data: { 
      chatId: string; 
      unreadCount: number;
      timestamp: Date;
    }) => {
      if (String(data.chatId) === String(chatId)) {
        console.log('📬 Admin chat detail received unread count update:', data);
        
        // Update the chat's unread count
        setChat(prev => prev ? {
          ...prev,
          unreadByAdmin: data.unreadCount
        } : null);
      }
    };

    // Status ngoài enum đóng bị backend từ chối — không nuốt lỗi im lặng, nếu
    // không UI sẽ hiện trạng thái mới trong khi DB vẫn giữ trạng thái cũ.
    const handleSocketError = (payload: { code?: string; message?: string }) => {
      if (payload?.code !== SOCKET_ERROR_CODES.INVALID_STATUS) return;
      console.error('❌ [AdminChat] Trạng thái không hợp lệ:', payload.message);
      setError(payload.message || 'Trạng thái không hợp lệ');
      // Kéo lại trạng thái thật từ server. Đọc qua ref để effect đăng ký socket
      // không phải phụ thuộc vào `fetchChatDetail` (đổi identity là re-subscribe).
      void fetchChatDetailRef.current(1, false);
    };

    // Ack riêng cho sender: chốt hoặc gỡ đúng một bong bóng lạc quan.
    const handleMessageAck = (data: {
      clientMessageId?: string;
      status: 'saved' | 'failed';
      chatId?: string;
      messageId?: string;
      createdAt?: string;
      code?: string;
    }) => {
      const clientMessageId = data.clientMessageId;
      if (!clientMessageId || !pendingMessageIdsRef.current.has(clientMessageId)) {
        return;
      }
      pendingMessageIdsRef.current.delete(clientMessageId);

      if (data.status === 'saved') {
        setMessages(prev => {
          // Broadcast `new_support_message` có thể đã tới trước ack và thay
          // bong bóng rồi — lúc đó chỉ cần bỏ bản tạm nếu còn sót.
          const hasReal = data.messageId
            ? prev.some(msg => msg.id === data.messageId)
            : false;
          if (hasReal) {
            return prev.filter(msg => msg.id !== clientMessageId);
          }
          return prev.map(msg =>
            msg.id === clientMessageId
              ? {
                  ...msg,
                  id: data.messageId ?? msg.id,
                  timestamp: data.createdAt ? new Date(data.createdAt) : msg.timestamp,
                }
              : msg
          );
        });
        return;
      }

      // `failed` = KHÔNG có gì được lưu.
      console.error('❌ [AdminChat] Gửi tin nhắn thất bại:', data.code);
      setMessages(prev => prev.filter(msg => msg.id !== clientMessageId));
      setError(
        data.code === 'SOCKET_FORBIDDEN'
          ? 'Không có quyền trả lời cuộc trò chuyện này.'
          : 'Không gửi được tin nhắn, vui lòng thử lại.'
      );
    };

    // Join chat room - backend automatically adds admin to necessary rooms
    socket.emit(WEBSOCKET_EVENTS.ADMIN_JOIN_CHAT, { chatId });

    // Subscribe to events
    socket.on('new_support_message', handleNewMessage);
    socket.on(WEBSOCKET_EVENTS.SUPPORT_MESSAGE_ACK, handleMessageAck);
    socket.on(WEBSOCKET_EVENTS.ERROR, handleSocketError);
    // BE emit ra event `support_chat_typing` (field `type` bên trong payload
    // mới là 'support_typing_indicator'). `user_typing` là tên INBOUND, nghe ở
    // đây thì typing im lặng không bao giờ chạy.
    socket.on(WEBSOCKET_EVENTS.SUPPORT_CHAT_TYPING, handleTypingIndicator);
    socket.on('chat_status_updated', handleChatStatusUpdate);
    socket.on('unread_count_updated', handleUnreadCountUpdate);

    return () => {
      socket.off('new_support_message', handleNewMessage);
      socket.off(WEBSOCKET_EVENTS.SUPPORT_MESSAGE_ACK, handleMessageAck);
      socket.off(WEBSOCKET_EVENTS.ERROR, handleSocketError);
      socket.off(WEBSOCKET_EVENTS.SUPPORT_CHAT_TYPING, handleTypingIndicator);
      socket.off('chat_status_updated', handleChatStatusUpdate);
      socket.off('unread_count_updated', handleUnreadCountUpdate);
    };
  }, [socket, isConnected, chatId, scrollToBottom, adminId]);

  // Fetch initial data
  useEffect(() => {
    if (chatId) {
      fetchChatDetail();
    }
  }, [chatId, fetchChatDetail]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Data
    chat,
    messages,
    pagination,
    
    // States
    isLoading,
    isLoadingMore,
    isSending,
    error,
    isConnected,
    isTyping,
    typingUsers,
    
    // Actions
    fetchChatDetail,
    loadMoreMessages,
    sendMessage,
    updateChatStatus,
    markChatAsRead,
    sendTypingIndicator,
    scrollToBottom,
    
    // Refs
    messagesContainerRef
  };
}