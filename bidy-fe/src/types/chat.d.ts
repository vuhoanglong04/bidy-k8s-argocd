// Product Attachment Interface
export interface ProductAttachment {
  productId: string;
  productTitle: string;
  productImage: string;
  currentPrice: number;
  bidStatus: 'active' | 'completed' | 'cancelled';
  productUrl: string;
}

// Grid Configuration Interface
export interface GridConfig {
  columns: number;
  maxItems: number;
}

import type { SupportMessageRow } from '@/services/support-chat.mapper';

// Support Chat Widget Types
export interface SupportChatMessage {
  /**
   * Khoá chính Postgres (bigint -> string). Socket gọi field này là `messageId`
   * và `extractMessage` chuẩn hoá về `id`. KHÔNG có `_id` ở bất kỳ đâu trong
   * module này — đó là tàn dư Mongo, dùng lại sẽ khiến cùng một tin nhắn tải
   * qua REST và nhận qua socket mang hai khoá khác nhau rồi hiện hai lần.
   */
  id: string;
  /**
   * Id do client sinh, backend echo nguyên vẹn trong `new_support_message`.
   * Dùng để khớp bong bóng lạc quan với bản ghi thật thay vì so nội dung.
   */
  clientMessageId?: string | null;
  chatId: string;
  senderId: string;
  senderType: 'user' | 'admin';
  message: string;
  messageType: 'text' | 'image' | 'product_grid';
  isRead: boolean;
  timestamp: Date;
  // Product grid fields
  productAttachments?: ProductAttachment[];
  gridConfig?: GridConfig;
}

export interface SupportChatData {
  /** Khoá chính Postgres của ticket (bigint -> string). */
  id: string;
  userId: string;
  adminId: string;
  isActive: boolean;
  subject: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: Date;
  lastMessageAt: Date;
  unreadByAdmin: number;
  unreadByUser: number;
  /**
   * `GET /users/support/chat` trả kèm một TRANG lịch sử: 30 tin mới nhất,
   * sắp xếp cũ → mới (render thẳng, không reverse). Page 1 của
   * `GET /users/support/chat/:chatId/messages` trùng với phần này, nên tải cũ hơn thì bắt đầu từ
   * page 2.
   */
  messages?: SupportMessageRow[];
  /** Còn tin cũ hơn để tải không — khỏi phải gọi `GET /users/support/chat/:chatId/messages` để dò. */
  hasMoreMessages?: boolean;
  totalMessages?: number;
}

export interface AdminInfo {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
}

export interface ChatWindowState {
  isOpen: boolean;
  isMinimized: boolean;
  unreadCount: number;
}

export interface MessagePagination {
  page: number;
  limit: number;
  hasMore: boolean;
  totalMessages: number;
}

export interface TypingIndicator {
  isTyping: boolean;
  typingUsers: string[];
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

// API Response Types
export interface SupportChatResponse {
  success: boolean;
  message: string;
  data: SupportChatData;
}

export interface MessagesResponse {
  success: boolean;
  message: string;
  data: {
    messages: SupportChatMessage[];
    pagination: MessagePagination;
  };
}

export interface SendMessageRequest {
  chatId: string;
  message: string;
  messageType?: 'text' | 'image';
}

export interface StartChatRequest {
  subject?: string;
  priority?: 'low' | 'medium' | 'high';
  initialMessage?: string;
}

// Socket Events
export interface SupportChatSocketEvents {
  // Outgoing events
  user_start_chat: (data: { userId: string; subject?: string }) => void;
  user_send_message: (data: { chatId: string; message: string; messageType: string }) => void;
  user_typing: (data: { chatId: string; isTyping: boolean }) => void;
  user_join_chat: (data: { chatId: string }) => void;
  
  // Incoming events
  new_support_message: (data: SupportChatMessage) => void;
  typing_indicator: (data: { chatId: string; userId: string; isTyping: boolean }) => void;
  admin_status_change: (data: { adminId: string; isOnline: boolean }) => void;
  chat_status_update: (data: { chatId: string; status: SupportChatData['status'] }) => void;
}