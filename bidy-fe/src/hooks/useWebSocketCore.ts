"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import { APP_CONSTANTS, WEBSOCKET_EVENTS } from '@/constants/app.enum';
import { AUTH_TOKENS_CHANGED_EVENT } from '@/lib/auth-events';
import { getAppCookie } from '@/lib/auth-cookies';
import { clearAuthSession, refreshSession } from '@/lib/auth-refresh';
import { lockAccountSession } from '@/lib/account-lock';
import logger from '@/utils/logger';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Dynamic import for socket.io-client to prevent SSR issues
let io: typeof import('socket.io-client').io | null = null;
if (isBrowser) {
  import('socket.io-client').then((socketModule) => {
    io = socketModule.io;
  });
}

// Singleton WebSocket instance - ONE CONNECTION FOR ENTIRE APP
let globalSocket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;
/**
 * Token đã dùng để bắt tay cho `globalSocket`. Danh tính socket được chốt lúc
 * handshake nên khi token đổi (refresh / đăng nhập / đăng xuất) phải so lại và
 * bắt tay lại — không có cách nào "đổi danh tính" trên socket đang mở.
 */
let handshakeToken: string | undefined;

/**
 * Server đã thu hồi phiên này (`sessionRevoked`). Token vẫn nằm trong cookie và
 * còn hạn tới 15 phút, nên nếu không chốt cờ ở đây thì mọi lần `disconnect` kế
 * tiếp đều lên lịch reconnect với đúng cái token đã chết — vòng lặp reconnect
 * mà BE cảnh báo. Cờ sống tới khi trang được nạp lại, và điều hướng sang màn
 * hình khoá chính là lần nạp lại đó.
 */
let sessionRevoked = false;

function readAccessToken(): string | undefined {
  if (!isBrowser) return undefined;
  return getAppCookie(APP_CONSTANTS.AUTH_COOKIE_NAME);
}

// Global message store - SHARED ACROSS ALL COMPONENTS
let globalMessages: WebSocketMessage[] = [];
const globalMessageListeners: Set<(messages: WebSocketMessage[]) => void> = new Set();

/**
 * Socket là singleton nhưng TRẠNG THÁI KẾT NỐI trước đây là state cục bộ của
 * từng hook instance. Chỉ instance nào tự tay dựng socket mới biết là đã nối
 * lại; các instance khác kẹt ở `isConnected: false` vĩnh viễn dù socket sống —
 * đúng triệu chứng "ô chat bị khoá, luôn hiện Đang kết nối...".
 * Vì vậy trạng thái phải nằm chung một chỗ và phát cho mọi listener.
 */
let globalConnectionState: WebSocketState = {
  isConnected: false,
  isConnecting: false,
  error: null,
  lastReconnectAttempt: null,
};
const connectionStateListeners: Set<(state: WebSocketState) => void> = new Set();

function setGlobalConnectionState(
  patch: Partial<WebSocketState> | ((prev: WebSocketState) => Partial<WebSocketState>)
) {
  const resolved = typeof patch === 'function' ? patch(globalConnectionState) : patch;
  const next = { ...globalConnectionState, ...resolved };

  const unchanged =
    next.isConnected === globalConnectionState.isConnected &&
    next.isConnecting === globalConnectionState.isConnecting &&
    next.error === globalConnectionState.error &&
    next.lastReconnectAttempt === globalConnectionState.lastReconnectAttempt;
  if (unchanged) return;

  globalConnectionState = next;
  connectionStateListeners.forEach((listener) => listener(next));
}

/**
 * Số hook instance đang bám vào socket. `disconnect()` lúc unmount trước đây hạ
 * luôn socket dùng chung, nên chỉ cần rời trang sản phẩm là widget chat mất kết
 * nối theo. Chỉ hạ thật khi consumer cuối cùng rời đi.
 */
let activeConsumers = 0;

// Core WebSocket Events (consolidated)
export interface WebSocketMessage {
  /** Khoá chuẩn, khớp khoá chính Postgres mà REST trả về. */
  id?: string;
  /** Tên khoá backend dùng trong `new_support_message`; `extractMessage` map về `id`. */
  messageId?: string;
  /** FE gửi lên, backend echo nguyên vẹn — dùng để khớp bong bóng lạc quan. */
  clientMessageId?: string | null;
  chatId: string;
  senderId?: string;
  senderType: 'user' | 'admin';
  message: string;
  messageType: 'text' | 'image';
  timestamp: string | Date;
  serverTime?: number;
  isRead?: boolean;
}

import type { SupportChatData } from '@/types/chat';

export interface WebSocketNotification {
  type: 'support_chat_created' | 'new_support_message' | 'support_chat_status_update';
  chat?: SupportChatData;
  message?: WebSocketMessage;
  chatId?: string;
  status?: string;
  adminId?: string;
  serverTime: number;
  timestamp: string;
}

export interface TypingIndicator {
  type: 'support_typing_indicator';
  chatId: string;
  userId: string;
  userType: 'user' | 'admin';
  isTyping: boolean;
  serverTime: number;
  timestamp: string;
}

export interface AdminStatusChange {
  type: 'admin_status_change';
  adminId: string;
  isOnline: boolean;
  serverTime: number;
  timestamp: string;
}

/** Status values do backend phát ra (khớp enum AuctionStatus trong OpenAPI). */
export type AuctionStatus = 'pending' | 'happening' | 'ended' | 'cancelled';

/**
 * Chuẩn hoá của 2 shape `auctionStatusUpdate` khác nhau từ backend:
 *  - cron status-sync : `{ auctionId, status, timestamp }`
 *  - AuctionWS        : object đầy đủ (`type`, `serverTime`, `endDate`, ...)
 * Chỉ `auctionId` là chắc chắn có; mọi field khác đều optional.
 */
export interface AuctionUpdate {
  auctionId: string;
  status?: AuctionStatus;
  endDate?: string;
  timeRemaining?: number;
  auctionName?: string;
  serverTime?: string;
  timestamp?: string;
  /** Giữ lại các field ngoài contract để hook chuyên biệt tự đọc. */
  raw?: Record<string, unknown>;
}

/** Payload của event `error` từ backend — KHÔNG phải Error instance. */
export interface SocketErrorPayload {
  message?: string;
  code?: string;
  details?: unknown;
  context?: string;
  timestamp?: string;
}

/** Mã lỗi trust-boundary của Socket.IO gateway. */
export const SOCKET_ERROR_CODES = {
  /** Chưa có/hết hạn JWT ở handshake — mọi event chat bị chặn. */
  UNAUTHENTICATED: 'SOCKET_UNAUTHENTICATED',
  /** Có danh tính nhưng không đủ quyền (ví dụ event admin_* mà không phải admin). */
  FORBIDDEN: 'SOCKET_FORBIDDEN',
  /**
   * `admin_status_update` với status ngoài enum đóng
   * (`open|in_progress|resolved|closed`). Trước đây gộp vào
   * `STATUS_UPDATE_ERROR`, giờ backend tách riêng.
   */
  INVALID_STATUS: 'INVALID_STATUS',
} as const;

const AUCTION_STATUSES: readonly AuctionStatus[] = ['pending', 'happening', 'ended', 'cancelled'];

function isAuctionStatus(value: unknown): value is AuctionStatus {
  return typeof value === 'string' && (AUCTION_STATUSES as readonly string[]).includes(value);
}

/**
 * Parse phòng thủ cho `auctionStatusUpdate` / `auctionUpdate`.
 * Trả `null` nếu payload không có `auctionId` — khi đó caller nên bỏ qua.
 */
function normalizeAuctionUpdate(data: unknown): AuctionUpdate | null {
  if (typeof data !== 'object' || data === null) return null;

  const raw = data as Record<string, unknown>;
  const auctionId = raw.auctionId ?? raw.auction_id ?? raw.id;
  if (typeof auctionId !== 'string' || !auctionId) return null;

  return {
    auctionId,
    status: isAuctionStatus(raw.status) ? raw.status : undefined,
    endDate: typeof raw.endDate === 'string' ? raw.endDate : undefined,
    timeRemaining: typeof raw.timeRemaining === 'number' ? raw.timeRemaining : undefined,
    auctionName: typeof raw.auctionName === 'string' ? raw.auctionName : undefined,
    serverTime: typeof raw.serverTime === 'string' ? raw.serverTime : undefined,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : undefined,
    raw,
  };
}

export interface BidUpdate {
  auctionId: string;
  bidAmount: number;
  bidder: {
    id: string;
    name: string;
  };
  totalBids: number;
  timestamp: string;
}

interface WebSocketCoreOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

// User notification function for admin replies
const showUserNotificationForAdminReply = (message: WebSocketMessage) => {
  try {
    // Check if notifications are supported
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('🎧 Hỗ trợ khách hàng Bidy', {
        body: message.message ? 
              (message.message.length > 50 ? message.message.substring(0, 47) + '...' : message.message) :
              'Bạn có tin nhắn mới từ đội hỗ trợ',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `admin-reply-${message.id || Date.now()}`,
        silent: false,
        requireInteraction: false
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Handle click to scroll to chat window
      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Try to scroll to or open the chat widget
        const chatWidget = document.querySelector('[data-support-chat-widget]');
        if (chatWidget) {
          chatWidget.scrollIntoView({ behavior: 'smooth' });
        }
      };
    }

    // Also show toast-style notification for immediate feedback
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const event = new CustomEvent('admin-message-received', {
        detail: { message: message.message, messageId: message.id }
      });
      window.dispatchEvent(event);
    }
  } catch (error) {
    console.error('Error showing user notification:', error);
  }
};

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastReconnectAttempt: Date | null;
}

// Consolidated message deduplication function
const deduplicateMessages = (messages: WebSocketMessage[]): WebSocketMessage[] => {
  const uniqueMessages = Array.from(
    new Map(messages.map(msg => [msg.id, msg])).values()
  );
  return uniqueMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

// Extract actual message from nested structure
const extractMessage = (rawMessage: unknown): WebSocketMessage | null => {
  let actualMessage = rawMessage as Record<string, unknown>;
  
  // Check if message is wrapped in a 'data' property
  if (rawMessage && typeof rawMessage === 'object' && 'data' in rawMessage) {
    const msg = rawMessage as { data?: unknown };
    if (typeof msg.data === 'object') {
      actualMessage = msg.data as Record<string, unknown>;
    }
  }
  // Check if message is wrapped in a 'message' property (legacy structure)
  else if (rawMessage && typeof rawMessage === 'object' && 'message' in rawMessage) {
    const msg = rawMessage as { message?: unknown };
    if (typeof msg.message === 'object') {
      actualMessage = msg.message as Record<string, unknown>;
    }
  }
  
  // Validate message structure
  if (!actualMessage || !('chatId' in actualMessage)) {
    return null;
  }

  // Backend đặt tên khoá là `messageId` trong payload `new_support_message`,
  // còn REST trả `id` (khoá chính Postgres). Chuẩn hoá về `id` — nếu chuẩn hoá
  // về `_id` thì cùng một tin tải qua REST và nhận qua socket sẽ mang hai khoá
  // khác nhau, dedup không nhận ra nhau và tin hiện hai lần.
  const normalized = { ...actualMessage };
  if (!normalized.id && normalized.messageId) {
    normalized.id = normalized.messageId;
  }

  return normalized as unknown as WebSocketMessage;
};

export const useWebSocketCore = (options: WebSocketCoreOptions = {}) => {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 5000
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const setupEventHandlersRef = useRef<((socket: Socket) => void) | null>(null);
  const startHeartbeatRef = useRef<(() => void) | null>(null);
  const executePendingOperationsRef = useRef<(() => void) | null>(null);
  /** Chặn vòng lặp refresh → vẫn 401 → refresh… khi token thật sự đã chết. */
  const unauthRetryRef = useRef(false);

  // Bám vào trạng thái dùng chung, không giữ bản sao riêng.
  const [state, setState] = useState<WebSocketState>(globalConnectionState);

  useEffect(() => {
    // Đồng bộ ngay lúc mount: socket có thể đã nối xong từ trước khi hook này
    // xuất hiện (widget chat mở sau khi trang đã chạy một lúc).
    setState(globalConnectionState);

    connectionStateListeners.add(setState);
    return () => {
      connectionStateListeners.delete(setState);
    };
  }, []);

  // Local state that syncs with global messages
  const [messages, setLocalMessages] = useState<WebSocketMessage[]>(globalMessages);
  
  // Other message stores (these are less critical for duplication)
  const [notifications, setNotifications] = useState<WebSocketNotification[]>([]);
  const [typingIndicators, setTypingIndicators] = useState<TypingIndicator[]>([]);
  const [adminStatusUpdates, setAdminStatusUpdates] = useState<AdminStatusChange[]>([]);
  
  // Auction data (existing functionality)
  const [auctionUpdates, setAuctionUpdates] = useState<AuctionUpdate[]>([]);
  const [bidUpdates, setBidUpdates] = useState<BidUpdate[]>([]);

  // Queue for pending operations when not connected
  const pendingOperationsRef = useRef<Array<() => void>>([]);
  
  // Sync local state with global messages
  useEffect(() => {
    const listener = (newMessages: WebSocketMessage[]) => {
      setLocalMessages(newMessages);
    };
    
    globalMessageListeners.add(listener);
    
    return () => {
      globalMessageListeners.delete(listener);
    };
  }, []);

  // Heartbeat management
  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    
    heartbeatRef.current = setInterval(() => {
      if (globalSocket?.connected) {
        logger.debug('Connection health check - socket connected');
      } else {
        if (reconnectCountRef.current < reconnectAttempts) {
          logger.info('Heartbeat detected disconnection, initiating reconnect...');
          // Don't call connect() directly to avoid circular dependency
          // Instead, trigger reconnection through event system
          if (reconnectCountRef.current < reconnectAttempts && !globalSocket?.connected) {
            globalSocket?.connect();
          }
        }
      }
    }, 30000);
  }, [reconnectAttempts]);

  // Store function in ref to avoid circular dependencies
  startHeartbeatRef.current = startHeartbeat;

  // Core connection management
  const connect = useCallback(() => {
    if (sessionRevoked) {
      logger.warn('Phiên đã bị thu hồi — không kết nối lại WebSocket');
      return;
    }

    if (!isBrowser) {
      logger.warn('WebSocket connection attempted in non-browser environment');
      setGlobalConnectionState(() => ({ error: 'WebSocket not available in server environment' }));
      return;
    }

    if (!io) {
      logger.warn('Socket.IO not loaded yet, retrying in 1 second...');
      setTimeout(connect, 1000);
      return;
    }

    // Socket đang mở nhưng bắt tay bằng token khác thì phải dựng lại, nếu không
    // server vẫn gắn nó với danh tính cũ (hoặc coi là khách khi vừa đăng nhập).
    if (globalSocket?.connected && handshakeToken !== readAccessToken()) {
      logger.info('Access token đã đổi — bắt tay lại WebSocket');
      globalSocket.disconnect();
      globalSocket = null;
      connectionPromise = null;
    }

    if (globalSocket?.connected) {
      logger.info('WebSocket already connected');
      socketRef.current = globalSocket;
      setGlobalConnectionState(() => ({ isConnected: true, isConnecting: false, error: null }));
      return;
    }

    if (connectionPromise) {
      logger.info('WebSocket connection already in progress, waiting...');
      connectionPromise.then((socket) => {
        socketRef.current = socket;
        setGlobalConnectionState(() => ({ isConnected: true, isConnecting: false, error: null }));
      });
      return;
    }

    setGlobalConnectionState(() => ({ isConnecting: true, error: null }));

    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001';
      
      connectionPromise = new Promise((resolve, reject) => {
        logger.info('Creating new WebSocket connection...');
        
        if (!io) {
          throw new Error('Socket.io not loaded');
        }
        
        // Danh tính đến từ JWT ở handshake, KHÔNG từ payload event nữa.
        // Không có token vẫn kết nối được nhưng chỉ nhận auction status public;
        // mọi event chat sẽ bị trả về SOCKET_UNAUTHENTICATED.
        const token = readAccessToken();
        handshakeToken = token;

        const newSocket = io(wsUrl, {
          transports: ['websocket', 'polling'],
          upgrade: true,
          rememberUpgrade: true,
          timeout: 5000,
          forceNew: false,
          autoConnect: false,
          reconnection: false,
          auth: token ? { token } : undefined,
          extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        newSocket.once('connect', () => {
          logger.info('Global WebSocket connected');
          globalSocket = newSocket;
          socketRef.current = newSocket;
          connectionPromise = null;
          resolve(newSocket);
        });

        newSocket.once('connect_error', (error: Error) => {
          logger.error('Global WebSocket connection error:', error.message);
          connectionPromise = null;
          reject(error);
        });

        // Set up event handlers - use ref to avoid circular dependency
        if (setupEventHandlersRef.current) {
          setupEventHandlersRef.current(newSocket);
        }

        // Connect the socket
        newSocket.connect();
      });

      connectionPromise.then(() => {
        logger.info('WebSocket connection promise resolved');
        setGlobalConnectionState(() => ({ isConnected: true, isConnecting: false, error: null }));
        if (startHeartbeatRef.current) {
          startHeartbeatRef.current();
        }
        if (executePendingOperationsRef.current) {
          executePendingOperationsRef.current();
        }
        if (setupEventHandlersRef.current && globalSocket) {
          setupEventHandlersRef.current(globalSocket);
        }
      }).catch((error) => {
        logger.error('WebSocket connection promise rejected:', error);
        setGlobalConnectionState(() => ({ isConnected: false, isConnecting: false, error: error.message }));
      });

    } catch (error) {
      logger.error('Failed to create WebSocket connection:', error);
      setGlobalConnectionState(() => ({
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Unknown connection error'
      }));
    }
  }, []);

  // Consolidated event handlers setup
  const setupEventHandlers = useCallback((socket: Socket) => {
    const scheduleReconnect = () => {
      if (sessionRevoked) return;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectCountRef.current += 1;
      const baseDelay = Math.min(Math.max(reconnectDelay * Math.pow(1.2, reconnectCountRef.current - 1), 3000), 15000);
      const delay = baseDelay + Math.random() * 2000;

      logger.info(`Scheduling reconnect attempt ${reconnectCountRef.current}/${reconnectAttempts} in ${delay}ms`);

      setGlobalConnectionState(() => ({
        lastReconnectAttempt: new Date()
      }));

      reconnectTimeoutRef.current = setTimeout(() => {
        // Trigger reconnection using ref to avoid circular dependency
        if (!globalSocket?.connected && reconnectCountRef.current < reconnectAttempts && connectRef.current) {
          connectRef.current();
        }
      }, delay);
    };

    /**
     * Server thu hồi phiên rồi ngắt ngay sau event này. Phải dừng hẳn: token
     * trong cookie vẫn còn hạn nên reconnect sẽ thành công về mặt handshake rồi
     * lại bị đá, lặp vô hạn.
     */
    socket.on(
      WEBSOCKET_EVENTS.SESSION_REVOKED,
      (payload: { reason?: string; at?: string }) => {
        logger.warn('Phiên bị thu hồi từ server', { reason: payload?.reason });

        sessionRevoked = true;

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        stopHeartbeat();
        socket.disconnect();
        if (globalSocket === socket) {
          globalSocket = null;
          connectionPromise = null;
        }

        // Event không nói rõ bị ban hay chỉ bị thu hồi phiên, và cũng không kèm
        // `reason` do admin viết — màn hình khoá hiển thị bản chung chung.
        clearAuthSession();
        lockAccountSession({
          kind: payload?.reason === 'ACCOUNT_NOT_AVAILABLE' ? 'unavailable' : 'revoked',
        });
      }
    );

    // Connection events
    socket.on('connect', () => {
      logger.info('WebSocket connected successfully');
      reconnectCountRef.current = 0;
      setGlobalConnectionState(() => ({
        isConnected: true,
        isConnecting: false,
        error: null
      }));
    });

    socket.on('disconnect', (reason) => {
      logger.warn('WebSocket disconnected:', { reason });
      
      stopHeartbeat();
      
      if (globalSocket === socket) {
        globalSocket = null;
        connectionPromise = null;
      }
      
      setGlobalConnectionState(() => ({
        isConnected: false,
        isConnecting: false,
        error: `Disconnected: ${reason}`
      }));

      if (reason !== 'io server disconnect' && reconnectCountRef.current < reconnectAttempts) {
        scheduleReconnect();
      }
    });

    socket.on('connect_error', (error) => {
      logger.error('WebSocket connection error:', { error: error.message });
      setGlobalConnectionState(() => ({
        isConnected: false,
        isConnecting: false,
        error: `Connection error: ${error.message}`
      }));

      if (reconnectCountRef.current < reconnectAttempts) {
        scheduleReconnect();
      }
    });

    // Support Chat Events - CONSOLIDATED with deduplication
    socket.on(WEBSOCKET_EVENTS.NEW_SUPPORT_MESSAGE, (rawMessage: unknown) => {
      const actualMessage = extractMessage(rawMessage);
      
      if (actualMessage && actualMessage.id) {
        // Show notification for admin replies to user
        if (actualMessage.senderType === 'admin' && typeof window !== 'undefined') {
          showUserNotificationForAdminReply(actualMessage);
        }

        // Update global messages state
        const messageId = actualMessage.id;
        const exists = globalMessages.some(msg => msg.id === messageId);
        
        if (!exists) {
          // Update global state
          const newMessages = [actualMessage, ...globalMessages.slice(0, 99)];
          globalMessages = deduplicateMessages(newMessages);
          
          // Notify all listeners
          globalMessageListeners.forEach(listener => {
            listener(globalMessages);
          });
        }
      }
    });

    socket.on(WEBSOCKET_EVENTS.SUPPORT_CHAT_CREATED, (data: WebSocketNotification) => {
      logger.info('Received support chat created notification:', { data });
      setNotifications(prev => [data, ...prev.slice(0, 99)]);
    });

    socket.on(WEBSOCKET_EVENTS.SUPPORT_CHAT_STATUS_UPDATE, (data: WebSocketNotification) => {
      logger.info('Received support chat status update:', { data });
      setNotifications(prev => [data, ...prev.slice(0, 99)]);
    });

    socket.on(WEBSOCKET_EVENTS.SUPPORT_CHAT_TYPING, (data: TypingIndicator) => {
      logger.info('Received support chat typing indicator:', { data });
      setTypingIndicators(prev => {
        const filtered = prev.filter(t => !(t.chatId === data.chatId && t.userId === data.userId));
        return data.isTyping ? [data, ...filtered.slice(0, 19)] : filtered;
      });
    });

    socket.on(WEBSOCKET_EVENTS.ADMIN_STATUS_CHANGE, (data: AdminStatusChange) => {
      logger.info('Received admin status change:', { data });
      setAdminStatusUpdates(prev => [data, ...prev.slice(0, 99)]);
    });

    socket.on(WEBSOCKET_EVENTS.SUPPORT_CHAT_READ_RECEIPT, (data: { chatId: string; messageId: string; readBy: string }) => {
      logger.info('Received support chat read receipt:', { data });
      // Handle read receipts - can be extended by specialized hooks
    });

    // Auction events.
    // `auctionStatusUpdate` đến từ 2 nguồn với shape KHÁC NHAU:
    //   - cron status-sync: { auctionId, status, timestamp }
    //   - AuctionWS (bid trigger): object đầy đủ có type/serverTime/...
    // Nên phải parse phòng thủ, không giả định field nào có sẵn.
    socket.on(WEBSOCKET_EVENTS.AUCTION_STATUS_UPDATE, (data: unknown) => {
      const update = normalizeAuctionUpdate(data);
      if (!update) {
        logger.warn('Bỏ qua auctionStatusUpdate không hợp lệ:', { data });
        return;
      }
      logger.info('Received auction status update:', { update });
      setAuctionUpdates(prev => [update, ...prev.slice(0, 99)]);
    });

    socket.on(WEBSOCKET_EVENTS.AUCTION_UPDATE, (data: unknown) => {
      const update = normalizeAuctionUpdate(data);
      if (!update) return;
      logger.info('Received auction update (global):', { update });
      setAuctionUpdates(prev => [update, ...prev.slice(0, 99)]);
    });

    socket.on(WEBSOCKET_EVENTS.NEW_BID, (data: BidUpdate) => {
      logger.info('Received bid update:', { data });
      setBidUpdates(prev => [data, ...prev.slice(0, 99)]);
    });

    socket.on(WEBSOCKET_EVENTS.BID_UPDATE, (data: BidUpdate) => {
      logger.info('Received bid update (bidUpdate):', { data });
      setBidUpdates(prev => [data, ...prev.slice(0, 99)]);
    });

    // BE gửi { message, code?, details?, context?, timestamp? } — KHÔNG phải Error instance.
    socket.on(WEBSOCKET_EVENTS.ERROR, (payload: SocketErrorPayload) => {
      logger.error('WebSocket error:', {
        error: payload?.message ?? 'Unknown socket error',
        code: payload?.code,
        context: payload?.context,
        details: payload?.details,
      });

      // Token hết hạn giữa chừng: thử refresh rồi bắt tay lại đúng một lần.
      // `refreshSession` đã gộp các lời gọi song song nên gọi thẳng là an toàn.
      if (payload?.code === SOCKET_ERROR_CODES.UNAUTHENTICATED) {
        if (unauthRetryRef.current) {
          logger.warn('Vẫn SOCKET_UNAUTHENTICATED sau khi refresh — dừng thử lại');
          setGlobalConnectionState(() => ({ error: 'Phiên đăng nhập đã hết hạn' }));
          return;
        }
        unauthRetryRef.current = true;

        refreshSession()
          .then((token) => {
            // `persistTokens` bắn event đổi token; nếu không có token mới thì
            // không bắt tay lại làm gì, user cần đăng nhập lại.
            if (!token) {
              setGlobalConnectionState(() => ({ error: 'Phiên đăng nhập đã hết hạn' }));
            }
          })
          .catch((error) => {
            logger.error('Refresh token cho socket thất bại:', error);
          });
        return;
      }

      if (payload?.code === SOCKET_ERROR_CODES.FORBIDDEN) {
        logger.warn('Socket bị từ chối do thiếu quyền:', { context: payload?.context });
        setGlobalConnectionState(() => ({ error: 'Không đủ quyền cho thao tác realtime này' }));
      }
    });
  }, [reconnectAttempts, reconnectDelay, stopHeartbeat]);

  // Store function in ref to avoid circular dependencies
  setupEventHandlersRef.current = setupEventHandlers;

  // Execute pending operations when connection is established
  const executePendingOperations = useCallback(() => {
    if (globalSocket?.connected && pendingOperationsRef.current.length > 0) {
      logger.info(`Executing ${pendingOperationsRef.current.length} pending WebSocket operations`);
      pendingOperationsRef.current.forEach(operation => {
        try {
          operation();
        } catch (error) {
          logger.error('Error executing pending WebSocket operation:', error);
        }
      });
      pendingOperationsRef.current = [];
    }
  }, []);

  // Store function in ref to avoid circular dependencies
  executePendingOperationsRef.current = executePendingOperations;

  // Store connect function in ref to avoid circular dependencies
  connectRef.current = connect;

  // Disconnect method
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (globalSocket) {
      globalSocket.disconnect();
      globalSocket = null;
      socketRef.current = null;
    }

    setGlobalConnectionState({
      isConnected: false,
      isConnecting: false,
      error: null,
      lastReconnectAttempt: null
    });

    reconnectCountRef.current = 0;
  }, [stopHeartbeat]);

  // Generic emit method with queuing
  const emit = useCallback((event: string, data?: unknown) => {
    if (globalSocket?.connected) {
      globalSocket.emit(event, data);
    } else {
      logger.warn(`Cannot emit ${event} - not connected, queuing operation`);
      pendingOperationsRef.current.push(() => {
        if (globalSocket?.connected) {
          globalSocket.emit(event, data);
        }
      });
    }
  }, []);

  // Auto-connect on mount.
  // Socket dùng chung nên unmount KHÔNG được hạ ngay: trang sản phẩm có vài
  // consumer (bidders, countdown, auction WS) mount/unmount liên tục, mỗi lần
  // như vậy trước đây đều ngắt luôn socket của widget chat.
  useEffect(() => {
    if (!isBrowser || !autoConnect) return;

    activeConsumers += 1;
    connect();

    return () => {
      activeConsumers = Math.max(0, activeConsumers - 1);
      if (activeConsumers === 0) {
        disconnect();
      }
    };
  }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Đánh thức lại sau khi đã cạn lượt reconnect.
   *
   * `scheduleReconnect` bỏ cuộc sau `reconnectAttempts` lần và trước đây KHÔNG
   * có gì khởi động lại nó: BE restart, wifi rớt, hay laptop sleep đủ lâu là
   * socket chết vĩnh viễn tới khi user tự F5. Với notification thì hỏng đó im
   * lặng — badge đứng nguyên số cũ, nhìn như "không có gì mới" chứ không như
   * "đang mất kết nối".
   *
   * Hai mốc đáng thử lại: máy có mạng trở lại, và user quay về tab. Cả hai đều
   * reset bộ đếm vì đây là hoàn cảnh mới, không phải lần thử thứ 6 của cùng một
   * lần hỏng. Phiên đã bị thu hồi thì `connect()` tự chặn, không cần lọc ở đây.
   */
  useEffect(() => {
    if (!isBrowser || !autoConnect) return;

    const reconnectIfDropped = () => {
      if (globalSocket?.connected || sessionRevoked) return;
      logger.info('Thử kết nối lại WebSocket sau khi tab/mạng hoạt động trở lại');
      reconnectCountRef.current = 0;
      connectRef.current?.();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reconnectIfDropped();
    };

    window.addEventListener('online', reconnectIfDropped);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', reconnectIfDropped);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [autoConnect]);

  // Token đổi (đăng nhập / refresh / đăng xuất) → bắt tay lại để server gắn
  // đúng danh tính mới. `connect()` tự phát hiện token lệch và hạ socket cũ.
  useEffect(() => {
    if (!isBrowser) return;

    const handleTokensChanged = () => {
      unauthRetryRef.current = false;
      if (handshakeToken === readAccessToken()) return;
      logger.info('Token đổi — dựng lại kết nối WebSocket');
      connectRef.current?.();
    };

    window.addEventListener(AUTH_TOKENS_CHANGED_EVENT, handleTokensChanged);
    return () => {
      window.removeEventListener(AUTH_TOKENS_CHANGED_EVENT, handleTokensChanged);
    };
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  // Message filtering helpers
  const getMessagesForChat = useCallback((chatId: string): WebSocketMessage[] => {
    return messages.filter(msg => msg.chatId === chatId);
  }, [messages]);

  const getLatestMessageForChat = useCallback((chatId: string): WebSocketMessage | null => {
    const chatMessages = getMessagesForChat(chatId);
    return chatMessages.length > 0 ? chatMessages[0] : null;
  }, [getMessagesForChat]);

  const getTypingUsersForChat = useCallback((chatId: string): string[] => {
    return typingIndicators
      .filter(indicator => indicator.chatId === chatId && indicator.isTyping)
      .map(indicator => indicator.userId);
  }, [typingIndicators]);

  // Clear methods
  const clearMessages = useCallback(() => {
    globalMessages = [];
    globalMessageListeners.forEach(listener => listener([]));
  }, []);
  const clearNotifications = useCallback(() => setNotifications([]), []);
  const clearTypingIndicators = useCallback(() => setTypingIndicators([]), []);

  // Return stable memoized object
  return useMemo(() => ({
    // Connection state
    ...state,
    socket: globalSocket,
    
    // Connection methods
    connect,
    disconnect,
    emit,
    
    // Data streams with deduplication
    messages,
    notifications,
    typingIndicators,
    adminStatusUpdates,
    auctionUpdates,
    bidUpdates,
    
    // Helper methods
    getMessagesForChat,
    getLatestMessageForChat,
    getTypingUsersForChat,
    
    // Clear methods
    clearMessages,
    clearNotifications,
    clearTypingIndicators,
    
    // Heartbeat management
    startHeartbeat,
    stopHeartbeat,
    
    // Raw socket access for advanced usage
    socketRef: socketRef.current,
  }), [
    state,
    connect,
    disconnect,
    emit,
    messages,
    notifications,
    typingIndicators,
    adminStatusUpdates,
    auctionUpdates,
    bidUpdates,
    getMessagesForChat,
    getLatestMessageForChat,
    getTypingUsersForChat,
    clearMessages,
    clearNotifications,
    clearTypingIndicators,
    startHeartbeat,
    stopHeartbeat,
  ]);
};

export default useWebSocketCore;