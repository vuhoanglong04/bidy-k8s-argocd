"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { useWebSocketCore } from './useWebSocketCore';
import { supportChatService } from '@/services/user/support-chat.service';
import { mapSupportMessages } from '@/services/support-chat.mapper';
import { WEBSOCKET_EVENTS } from '@/constants/app.enum';
import type { 
  SupportChatData,
  SupportChatMessage,
  AdminInfo,
  TypingIndicator 
} from '@/types/chat';

/** Số tin nhắn mỗi trang khi nạp lịch sử. */
const MESSAGES_PAGE_SIZE = 30;

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

interface StartChatParams {
  subject?: string;
}

interface SendMessageParams {
  chatId: string;
  message: string;
  messageType?: 'text' | 'image';
}

export interface SupportChatHookReturn {
  // Core state
  currentChat: SupportChatData | null;
  messages: SupportChatMessage[];
  adminInfo: AdminInfo | null;
  typingIndicator: TypingIndicator;
  connectionState: ConnectionState;
  
  // Loading states
  isLoading: boolean;
  isSending: boolean;
  isLoadingOlder: boolean;
  hasMoreMessages: boolean;
  
  // Actions
  startChat: (params: StartChatParams) => Promise<SupportChatData | null>;
  sendMessage: (params: SendMessageParams) => Promise<void>;
  sendTypingIndicator: (chatId: string, isTyping: boolean) => void;
  loadOlderMessages: () => Promise<void>;
  markMessagesAsRead: (chatId: string) => void;
  
  // Computed
  hasUnreadMessages: boolean;
  unreadCount: number;
}

const CHAT_STORAGE_PREFIX = 'bidy_support_chat_';

interface StoredChatCache {
  chat: SupportChatData | null;
  messages: SupportChatMessage[];
}

function getStoredChat(uid?: string | null): StoredChatCache | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = sessionStorage.getItem(`${CHAT_STORAGE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.messages)) {
      return {
        chat: parsed.chat || null,
        messages: parsed.messages.map((m: SupportChatMessage) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function saveStoredChat(
  uid: string | null | undefined,
  chat: SupportChatData | null,
  messages: SupportChatMessage[]
) {
  if (typeof window === 'undefined' || !uid) return;
  try {
    sessionStorage.setItem(
      `${CHAT_STORAGE_PREFIX}${uid}`,
      JSON.stringify({ chat, messages })
    );
  } catch {
    // Ignore storage quota limits
  }
}

export function useSupportChatClean({ autoConnect = true } = {}): SupportChatHookReturn {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const userId = user?._id || user?.idUser || (user as { id?: string })?.id;

  // Only connect if user is authenticated to prevent 401 errors
  const shouldConnect = autoConnect && isAuthenticated;

  const {
    socket,
    isConnected,
    isConnecting,
    error,
    getMessagesForChat,
    getTypingUsersForChat,
    emit
  } = useWebSocketCore({ autoConnect: shouldConnect });

  // Khôi phục ngay từ session storage nếu có, tránh layout shift và flash empty state
  const cached = useMemo(() => getStoredChat(userId), [userId]);

  // Simple state - no complex logic
  const [currentChat, setCurrentChat] = useState<SupportChatData | null>(cached?.chat ?? null);
  const [apiMessages, setApiMessages] = useState<SupportChatMessage[]>(cached?.messages ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(!cached?.messages?.length && isAuthenticated);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const messagesPageRef = useRef(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const loadedChatRef = useRef<string | null>(cached?.chat?.id ?? null);
  const joinedChatRef = useRef<string | null>(null); // Track which chat we've joined
  const initialChatLoadedRef = useRef(false); // Track if we've loaded initial chat
  /** `clientMessageId` của các bong bóng lạc quan đang chờ `support_message_ack`. */
  const pendingMessageIdsRef = useRef<Set<string>>(new Set());

  // Connection state
  const connectionState = useMemo<ConnectionState>(() => ({
    isConnected,
    isConnecting,
    error
  }), [isConnected, isConnecting, error]);

  // Extract IDs for stable dependencies
  const chatId = currentChat?.id;

  // Join room when chat exists and connected
  // Use ref to capture latest emit function without causing re-renders
  const emitRef = useRef(emit);
  emitRef.current = emit;

  useEffect(() => {
    if (isConnected && chatId && userId) {
      // Only join if we haven't already joined this chat
      if (joinedChatRef.current !== chatId) {
        console.log('🔗 Joining chat room:', chatId);
        // Danh tính lấy từ JWT ở handshake — không gửi userId nữa.
        emitRef.current(WEBSOCKET_EVENTS.USER_JOIN_CHAT, { chatId });
        joinedChatRef.current = chatId;
      }
    }

    // Clear joined ref when chat changes or disconnects
    if (!chatId || !isConnected) {
      joinedChatRef.current = null;
    }
  }, [isConnected, chatId, userId]); // Stable dependencies only

  // Listen for WebSocket unread count updates and new messages
  useEffect(() => {
    if (!socket) return;

    const handleUnreadCountUpdate = (data: unknown) => {
      console.log('📬 Received unread count update:', data);
      const typedData = data as { chatId?: string; unreadCount?: number };
      // `chat.id` là bigint serialize thành string; so bằng String() cho chắc.
      if (String(typedData.chatId) === String(chatId)) {
        // Update UI immediately
        setUnreadCount(typedData.unreadCount || 0);
        
        // Also update the chat object if it exists
        setCurrentChat(prev => prev ? {
          ...prev,
          unreadByUser: typedData.unreadCount || 0
        } : null);
      }
    };

    // Also listen for new messages to increment count if chat is closed
    const handleNewMessage = (message: unknown) => {
      const typedMessage = message as { chatId?: string; senderType?: string };
      if (String(typedMessage.chatId) === String(chatId) && typedMessage.senderType === 'admin') {
        console.log('📨 New message from admin, updating unread count');
        // If chat window is closed, increment unread count
        const chatWindow = document.querySelector('[data-chat-open="true"]');
        if (!chatWindow) {
          setUnreadCount(prev => prev + 1);
        }
      }
    };

    // Ack riêng cho sender: chốt hoặc gỡ đúng một bong bóng lạc quan.
    const handleMessageAck = (data: {
      clientMessageId?: string;
      status: 'saved' | 'failed';
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
        setApiMessages(prev => {
          // Broadcast có thể tới trước ack và đã thay bong bóng rồi.
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
      console.error('❌ Gửi tin nhắn thất bại:', data.code);
      setApiMessages(prev => prev.filter(msg => msg.id !== clientMessageId));
    };

    socket.on('unread_count_updated', handleUnreadCountUpdate);
    socket.on('new_support_message', handleNewMessage);
    socket.on(WEBSOCKET_EVENTS.SUPPORT_MESSAGE_ACK, handleMessageAck);

    return () => {
      socket.off('unread_count_updated', handleUnreadCountUpdate);
      socket.off('new_support_message', handleNewMessage);
      socket.off(WEBSOCKET_EVENTS.SUPPORT_MESSAGE_ACK, handleMessageAck);
    };
  }, [socket, chatId]);

  // Load messages when chat changes
  useEffect(() => {
    const loadChatMessages = async () => {
      if (!chatId) return;
      
      // Only load if we haven't loaded this chat's messages yet
      if (loadedChatRef.current === chatId) return;
      
      try {
        setIsLoading(true);
        // Page 1 là các tin MỚI NHẤT (backend đảo chiều phân trang để mở chat ở
        // đáy); trong một trang rows vẫn cũ→mới nên render thẳng, không reverse.
        const response = await supportChatService.loadMessages(chatId, 1, MESSAGES_PAGE_SIZE);

        if (response.status === 'success' && response.data) {
          // REST trả entity thô (`content`/`createdAt`), phải map về shape FE.
          const messages = mapSupportMessages(response.data.messages, userId);
          setApiMessages(messages.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          ));
          messagesPageRef.current = 1;
          setHasMoreMessages(Boolean(response.data.hasMore));
          loadedChatRef.current = chatId;
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadChatMessages();
  }, [chatId, userId]);

  // Reset messages when chat is cleared (chỉ khi trước đó ĐÃ có chat mà bị xoá/đóng)
  const prevChatIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevChatIdRef.current && !chatId) {
      loadedChatRef.current = null;
      messagesPageRef.current = 1;
      setApiMessages([]);
      setHasMoreMessages(false);
      setUnreadCount(0);
      if (userId) {
        saveStoredChat(userId, null, []);
      }
    }
    prevChatIdRef.current = chatId;
  }, [chatId, userId]);

  // Defensive: Clear stale unread count if we have unread messages but no chat data
  useEffect(() => {
    if (unreadCount > 0 && !chatId) {
      console.warn('Clearing stale unread count - no current chat data');
      setUnreadCount(0);
    }
  }, [chatId, unreadCount]);

  // Gộp tin nhắn nạp qua REST với tin nhắn đến qua WebSocket.
  //
  // Trước đây `getMessagesForChat` được đọc qua ref và useMemo chỉ phụ thuộc
  // `[chatId, apiMessages]`, nên tin nhắn admin gửi tới KHÔNG làm memo tính lại
  // — bong bóng chỉ xuất hiện khi người dùng tự gửi tin (lúc đó `apiMessages`
  // mới đổi). Phải phụ thuộc thẳng vào `getMessagesForChat` (nó đổi mỗi khi kho
  // tin nhắn socket đổi).
  const messages = useMemo(() => {
    if (!chatId) return apiMessages;

    const wsMessages = getMessagesForChat(chatId);

    const normalizedWs: SupportChatMessage[] = wsMessages.map(msg => ({
      id: msg.id || '',
      clientMessageId: msg.clientMessageId ?? null,
      chatId: String(msg.chatId),
      senderId: msg.senderId || '',
      senderType: msg.senderType,
      message: msg.message,
      messageType: msg.messageType,
      timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp,
      isRead: msg.isRead || false,
    }));

    // Bản thật đã về thì bỏ bong bóng lạc quan tương ứng. Khớp bằng
    // `clientMessageId` backend echo lại, không so nội dung: gửi cùng một chuỗi
    // hai lần liên tiếp sẽ bị nuốt mất một tin.
    const settledClientIds = new Set(
      normalizedWs.map(msg => msg.clientMessageId).filter(Boolean) as string[]
    );
    const wsIds = new Set(normalizedWs.map(msg => msg.id).filter(Boolean));

    const combined = [
      ...apiMessages.filter(msg => {
        if (msg.clientMessageId && settledClientIds.has(msg.clientMessageId)) return false;
        return !wsIds.has(msg.id);
      }),
      ...normalizedWs,
    ];

    return combined.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [chatId, apiMessages, getMessagesForChat]);

  // Typing indicator - simple
  // Use ref to capture latest getTypingUsersForChat function without causing re-renders
  const getTypingUsersForChatRef = useRef(getTypingUsersForChat);
  getTypingUsersForChatRef.current = getTypingUsersForChat;

  const typingIndicator = useMemo((): TypingIndicator => {
    if (!chatId) {
      return { isTyping: false, typingUsers: [] };
    }

    // Get typing users using ref to avoid dependency loop
    const typingUsers = getTypingUsersForChatRef.current(chatId);
    return {
      isTyping: typingUsers.length > 0,
      typingUsers
    };
  }, [chatId]); // Use stable dependencies only

  // Start chat — qua socket.
  //
  // `user_start_chat` giờ tạo ticket thật, idempotent (partial unique index
  // `(user_id) WHERE status='open'`) và tự join room ngay trong handler, nên
  // không cần `user_join_chat` sau đó. Trước đây nó trả `_id: 'temp_chat_id'`
  // hardcode nên FE buộc phải đi đường REST `/support-chat/start`.
  const startChat = useCallback(async (params: StartChatParams): Promise<SupportChatData | null> => {
    if (!socket?.connected) {
      console.error('Failed to start chat: socket chưa kết nối');
      return null;
    }

    setIsLoading(true);

    return new Promise<SupportChatData | null>((resolve) => {
      let settled = false;

      const cleanup = () => {
        clearTimeout(timeoutId);
        socket.off(WEBSOCKET_EVENTS.SUPPORT_CHAT_CREATED, handleCreated);
        socket.off(WEBSOCKET_EVENTS.ERROR, handleError);
        setIsLoading(false);
      };

      const handleCreated = (data: { success?: boolean; chat?: SupportChatData }) => {
        if (settled || !data?.chat) return;
        settled = true;
        cleanup();

        const chatData = data.chat;
        setCurrentChat(chatData);
        setUnreadCount(chatData.unreadByUser || 0);
        loadedChatRef.current = null; // Force reload messages for new chat
        messagesPageRef.current = 1;
        // Handler đã join room hộ, đánh dấu để effect join không emit thừa.
        joinedChatRef.current = chatData.id;
        resolve(chatData);
      };

      const handleError = (err: { code?: string; message?: string }) => {
        if (settled || err?.code !== 'START_CHAT_ERROR') return;
        settled = true;
        cleanup();
        console.error('Failed to start chat:', err.message);
        resolve(null);
      };

      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        console.error('Failed to start chat: quá hạn chờ support_chat_created');
        resolve(null);
      }, 10000);

      socket.on(WEBSOCKET_EVENTS.SUPPORT_CHAT_CREATED, handleCreated);
      socket.on(WEBSOCKET_EVENTS.ERROR, handleError);

      socket.emit(WEBSOCKET_EVENTS.USER_START_CHAT, { subject: params.subject });
    });
  }, [socket]);

  // Send message — socket-only, có ack.
  //
  // Trước đây mỗi tin nhắn là một `POST /support-chat/send-message` vì socket
  // không trả gì để await. BE đã thêm `support_message_ack` (khớp theo
  // `clientMessageId`) và handler lưu DB qua cùng service trước khi broadcast,
  // nên đường REST chỉ còn dành cho caller không tương tác.
  const sendMessage = useCallback(async (params: SendMessageParams) => {
    // Id riêng cho từng lần gửi: khi hỏng chỉ được gỡ đúng bong bóng này, gỡ
    // theo tiền tố `temp-` sẽ xoá luôn các tin khác đang bay.
    const optimisticId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (!socket?.connected) {
      throw new Error('Mất kết nối realtime, không gửi được tin nhắn.');
    }

    try {
      setIsSending(true);

      // Optimistic update: Add message to UI immediately
      const optimisticMessage: SupportChatMessage = {
        id: optimisticId,
        clientMessageId: optimisticId,
        chatId: params.chatId,
        senderId: userId || '',
        senderType: 'user',
        message: params.message,
        messageType: params.messageType || 'text',
        timestamp: new Date(),
        isRead: false,
      };

      pendingMessageIdsRef.current.add(optimisticId);
      setApiMessages(prev => [...prev, optimisticMessage]);

      // Không await gì — bản chính thức về qua `support_message_ack` và
      // `new_support_message` (không đảm bảo thứ tự giữa hai event).
      socket.emit(WEBSOCKET_EVENTS.USER_SEND_MESSAGE, {
        chatId: params.chatId,
        message: params.message,
        messageType: params.messageType || 'text',
        clientMessageId: optimisticId,
      });
    } catch (error) {
      console.error('Failed to send message:', error);

      // Remove optimistic message on error
      pendingMessageIdsRef.current.delete(optimisticId);
      setApiMessages(prev => prev.filter(msg => msg.id !== optimisticId));

      throw error;
    } finally {
      setIsSending(false);
    }
  }, [userId, socket]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((chatId: string, isTyping: boolean) => {
    if (socket?.connected && userId) {
      emit(WEBSOCKET_EVENTS.SUPPORT_USER_TYPING, { chatId, isTyping });
    }
  }, [socket, userId, emit]);

  /**
   * Tải trang tin nhắn cũ hơn (scroll lên đầu danh sách).
   * Trang sau = tin cũ hơn, prepend vào đầu list. Điều kiện dừng lấy từ
   * `hasMore` của backend, không tự tính từ `totalPages` (con số đó dịch mỗi
   * khi có tin nhắn mới tới).
   */
  const loadOlderMessages = useCallback(async () => {
    if (!chatId || !hasMoreMessages || isLoadingOlder) return;

    const nextPage = messagesPageRef.current + 1;
    try {
      setIsLoadingOlder(true);
      const response = await supportChatService.loadMessages(chatId, nextPage, MESSAGES_PAGE_SIZE);

      if (response.status === 'success' && response.data) {
        const older = mapSupportMessages(response.data.messages, userId);
        setApiMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.id));
          const deduped = older.filter(msg => !existingIds.has(msg.id));
          return [...deduped, ...prev];
        });
        messagesPageRef.current = nextPage;
        setHasMoreMessages(Boolean(response.data.hasMore));
      }
    } catch (error) {
      console.error('Failed to load older messages:', error);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [chatId, hasMoreMessages, isLoadingOlder, userId]);

  // Mark ALL messages as read when opening chat.
  // `user_read_messages` giờ ghi `is_read` xuống DB chứ không chỉ broadcast, nên
  // không cần gọi kèm `PUT /support-chat/mark-as-read/:chatId` nữa.
  const markMessagesAsRead = useCallback((chatId: string) => {
    if (!chatId || unreadCount === 0) return;

    console.log(`✅ Marking all ${unreadCount} messages as read for chat ${chatId}`);

    // Update UI immediately for better UX
    setUnreadCount(0);
    setCurrentChat(prev => prev ? {
      ...prev,
      unreadByUser: 0
    } : null);

    if (socket?.connected && userId) {
      emit(WEBSOCKET_EVENTS.USER_READ_MESSAGES, { chatId });
    }
  }, [unreadCount, socket, userId, emit]);

  // Nếu đã kiểm tra xong auth mà không đăng nhập -> tắt loading
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setIsLoading(false);
    }
  }, [isAuthLoading, isAuthenticated]);

  // Cập nhật state từ cache khi userId có sẵn (sau rehydration)
  useEffect(() => {
    if (userId && apiMessages.length === 0) {
      const stored = getStoredChat(userId);
      if (stored?.messages && stored.messages.length > 0) {
        setApiMessages(stored.messages);
        if (stored.chat) {
          setCurrentChat(stored.chat);
        }
      }
    }
  }, [userId, apiMessages.length]);

  // Tự động lưu cache mỗi khi danh sách tin nhắn thay đổi
  useEffect(() => {
    if (userId && messages.length > 0) {
      saveStoredChat(userId, currentChat, messages);
    }
  }, [userId, currentChat, messages]);

  // Load existing chat on mount
  useEffect(() => {
    const loadExistingChat = async () => {
      // Don't load if not authenticated or already loaded
      if (!userId || !isAuthenticated || initialChatLoadedRef.current) return;

      try {
        setIsLoading(true);
        // Đánh dấu ĐANG chạy để không gọi song song; chỉ chốt là "đã nạp" khi
        // gọi thành công. Trước đây cờ này bật ngay trước `await`, nên một lần
        // hỏng (401 lúc token chưa gắn kịp, mạng chập) là khoá luôn: chat không
        // bao giờ được nạp lại, người dùng mở widget thấy khung trống và chỉ
        // thấy lịch sử sau khi tự gửi một tin (lúc đó `startChat` mới dựng lại
        // ticket).
        initialChatLoadedRef.current = true;

        const response = await supportChatService.getUserCurrentChat();
        
        if (response?.data?.chat && response.data.chat.id) {
          const chatData = response.data.chat;
          setCurrentChat(chatData);
          // Use backend unread count directly
          setUnreadCount(chatData.unreadByUser || 0);

          // `/my-chat` trả kèm MỘT TRANG lịch sử (30 tin mới nhất, cũ → mới) và
          // `hasMoreMessages`. Dùng luôn làm trang 1 thay vì gọi lại
          // `/messages/:chatId?page=1` — nội dung y hệt.
          const inlineMessages = mapSupportMessages(chatData.messages, userId);
          const sorted = inlineMessages.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          setApiMessages(sorted);
          messagesPageRef.current = 1;
          setHasMoreMessages(Boolean(chatData.hasMoreMessages));
          // Đánh dấu đã có trang 1 để effect nạp messages không gọi trùng.
          loadedChatRef.current = chatData.id;
          saveStoredChat(userId, chatData, sorted);
        } else {
          // Server xác nhận user chưa có phiên chat nào mở
          saveStoredChat(userId, null, []);
        }
      } catch (error) {
        console.error('Failed to load existing chat:', error);
        // Mở khoá để lần render sau (token đã sẵn sàng, mạng đã lại) thử lại.
        initialChatLoadedRef.current = false;
        // Reset unread count when API fails to prevent showing stale counts
        setUnreadCount(0);
        setCurrentChat(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadExistingChat();
    // `isConnected` nằm trong deps để lần hỏng đầu (token chưa gắn kịp) được
    // thử lại ngay khi socket kết nối được, thay vì phải reload trang.
  }, [userId, isAuthenticated, isConnected]);

  const hasUnreadMessages = unreadCount > 0;

  return {
    // Core state
    currentChat,
    messages,
    adminInfo: null, // We can add this later if needed
    typingIndicator,
    connectionState,
    
    // Loading states
    isLoading,
    isSending,
    isLoadingOlder,
    hasMoreMessages,
    
    // Actions
    startChat,
    sendMessage,
    sendTypingIndicator,
    markMessagesAsRead,
    loadOlderMessages,
    
    // Computed - use backend unread count directly
    hasUnreadMessages,
    unreadCount
  };
}