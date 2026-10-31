/**
 * Admin Support Chat Types
 * Types specifically for admin chat interface
 */

import { SupportChatMessage, SupportChatData } from './chat';
import type { SupportTicketRow } from '@/services/support-chat.mapper';

// Extended types for admin interface
export interface AdminSupportChat extends SupportChatData {
  user: {
    id: string;
    fullname: string;
    email: string;
    phone?: string;
    /** URL presigned, dùng thẳng được (hoặc null). Entity KHÔNG có field `avatar`. */
    avatarUrl?: string | null;
    username?: string;
  };
  admin?: {
    id: string;
    fullname: string;
    /** URL presigned, dùng thẳng được (hoặc null). Entity KHÔNG có field `avatar`. */
    avatarUrl?: string | null;
  };
}

export interface AdminChatListItem {
  id: string;
  userId: string;
  user: {
    fullname: string;
    email: string;
    /** URL presigned, dùng thẳng được (hoặc null). Entity KHÔNG có field `avatar`. */
    avatarUrl?: string | null;
  };
  subject: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  unreadByAdmin: number;
  lastMessage?: {
    message: string;
    senderType: 'user' | 'admin';
    timestamp: Date;
  };
  createdAt: Date;
  /** `null` khi ticket chưa có tin nhắn nào — backend không bịa mốc thời gian. */
  lastMessageAt: Date | null;
  lastAdminReplyAt?: Date;
  messageCount?: number;
}

// Types used by the new dashboard
export interface AdminChatDetail {
  id: string;
  userId: string;
  user: {
    id: string;
    fullname: string;
    email: string;
    phone?: string;
    /** URL presigned, dùng thẳng được (hoặc null). Entity KHÔNG có field `avatar`. */
    avatarUrl?: string | null;
  };
  subject: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  unreadByAdmin: number;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  lastAdminReplyAt?: Date;
}

export interface AdminMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderType: 'user' | 'admin';
  message: string;
  messageType: 'text' | 'image' | 'file';
  timestamp: Date;
  isInternal?: boolean;
  attachments?: {
    url: string;
    type: string;
    filename: string;
  }[];
}

export interface AdminChatFilters {
  status: 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'all' | 'low' | 'medium' | 'high';
  unread: 'all' | 'unread' | 'read';
  search: string;
}

export interface AdminChatStats {
  open: { count: number; unread: number };
  in_progress: { count: number; unread: number };
  resolved: { count: number; unread: number };
  closed: { count: number; unread: number };
  [key: string]: { count: number; unread: number };
}

export interface AdminChatPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Shape THẬT của `GET /admin/support/chats`: backend trả entity `SupportTicket`
 * thô cùng phân trang phẳng (`totalPages`/`currentPage`/`totalChats`), KHÔNG có
 * `stats` và KHÔNG bọc trong `pagination`. Dùng `mapAdminChats` để đổi sang
 * `AdminChatListItem` trước khi đưa vào UI.
 */
export interface AdminChatListResponse {
  status: string;
  message: string;
  data: {
    chats: SupportTicketRow[];
    totalPages?: number;
    currentPage?: number;
    totalChats?: number;
    /**
     * `status -> { count, unread }` trên TOÀN BỘ ticket (không chỉ trang hiện
     * tại), keyed theo status có thật trong DB — status là varchar tự do, không
     * có enum phía backend, nên đừng giả định đủ 4 key.
     *
     * `unread` cùng định nghĩa với `unreadByAdmin` từng dòng: tin chưa đọc mà
     * người gửi là chủ ticket.
     */
    statusCounts?: Record<string, { count: number; unread: number }>;
  };
}

export interface AdminChatDetailResponse {
  status: string;
  message: string;
  data: {
    chat: AdminSupportChat;
  };
}

export interface AdminChatMessagesResponse {
  status: string;
  message: string;
  data: {
    messages: SupportChatMessage[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

export interface AdminSendMessageRequest {
  chatId: string;
  message: string;
  messageType?: 'text' | 'image';
  isInternal?: boolean; // For internal admin notes
}

export interface UpdateChatStatusRequest {
  chatId: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high';
  internalNote?: string;
}

export interface BulkChatAction {
  chatIds: string[];
  action: 'mark_resolved' | 'mark_closed' | 'change_priority' | 'assign_admin';
  value?: string; // For priority or admin assignment
}

// WebSocket events for admin
export interface AdminChatSocketEvents {
  // Admin specific events
  admin_join_support: (data: { adminId: string }) => void;
  admin_join_chat: (data: { chatId: string; adminId: string }) => void;
  admin_send_message: (data: AdminSendMessageRequest) => void;
  admin_typing: (data: { chatId: string; isTyping: boolean }) => void;
  admin_update_chat_status: (data: UpdateChatStatusRequest) => void;

  // Incoming events
  new_support_chat: (data: AdminChatListItem) => void;
  new_support_message: (data: SupportChatMessage & { chatInfo: AdminChatListItem }) => void;
  chat_status_updated: (data: { chatId: string; status: string; updatedBy: string }) => void;
  user_typing: (data: { chatId: string; userId: string; isTyping: boolean }) => void;
  chat_stats_updated: (data: AdminChatStats) => void;
}

export interface AdminNotification {
  id: string;
  type: 'new_chat' | 'new_message' | 'chat_resolved' | 'urgent_chat' | 'admin_mentioned' | 'system';
  title: string;
  message: string;
  chatId?: string;
  userId?: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: Date;
  isRead: boolean;
}

export interface AdminChatSettings {
  autoAssignment: boolean;
  maxChatsPerAdmin: number;
  responseTimeTarget: number; // minutes
  workingHours: {
    start: string; // "09:00"
    end: string;   // "18:00"
    timezone: string;
  };
  emailNotifications: boolean;
  soundNotifications: boolean;
}

// Export all types
export type {
  AdminSupportChat,
  AdminChatListItem,
  AdminChatDetail,
  AdminMessage,
  AdminChatFilters,
  AdminChatStats,
  AdminChatPagination,
  AdminChatListResponse,
  AdminChatDetailResponse,
  AdminChatMessagesResponse,
  AdminSendMessageRequest,
  UpdateChatStatusRequest,
  BulkChatAction,
  AdminChatSocketEvents,
  AdminNotification,
  AdminChatSettings
};