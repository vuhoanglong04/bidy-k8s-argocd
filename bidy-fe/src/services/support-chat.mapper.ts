import type { SupportChatMessage } from '@/types/chat';
import { SUPPORT_TICKET_STATUS } from '@/constants/app.enum';

/**
 * Row tin nhắn hỗ trợ đúng như REST trả về.
 *
 * Backend trả entity `SupportMessage` thô: `content` / `createdAt` / `ticketId`
 * và KHÔNG có `senderType`. FE thì dùng `message` / `timestamp` / `chatId` —
 * đúng shape của envelope socket `new_support_message`. Dùng thẳng row vào UI
 * làm mọi tin nhắn render "Invalid Date" (và nội dung rỗng), nên mọi chỗ nạp
 * lịch sử qua REST phải đi qua mapper này.
 */
export interface SupportMessageRow {
  id: string;
  ticketId?: string;
  chatId?: string;
  senderId: string;
  sender?: {
    id: string;
    username?: string;
    fullname?: string;
    avatarUrl?: string | null;
  };
  senderType?: 'user' | 'admin';
  content?: string;
  message?: string;
  messageType?: SupportChatMessage['messageType'];
  isRead?: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  timestamp?: string | Date;
  clientMessageId?: string | null;
}

/**
 * `senderType` do backend derive từ `ticket.userId` và có mặt ở MỌI payload
 * message (REST lẫn socket). `ticketUserId` chỉ còn là lưới an toàn cho payload
 * cũ — và phải so với CHỦ ticket, không phải "người đang xem": admin B trả lời
 * ticket mà admin A đang mở thì so kiểu đó sẽ gán nhầm tin của B thành tin của
 * khách.
 */
export const mapSupportMessage = (
  row: SupportMessageRow,
  ticketUserId?: string | null
): SupportChatMessage => {
  const rawTimestamp = row.timestamp ?? row.createdAt;
  const timestamp = rawTimestamp ? new Date(rawTimestamp) : new Date(NaN);

  return {
    id: String(row.id),
    clientMessageId: row.clientMessageId ?? null,
    chatId: String(row.chatId ?? row.ticketId ?? ''),
    senderId: String(row.senderId ?? ''),
    senderType:
      row.senderType ??
      (ticketUserId && String(row.senderId) === String(ticketUserId) ? 'user' : 'admin'),
    message: row.message ?? row.content ?? '',
    messageType: row.messageType ?? 'text',
    isRead: row.isRead ?? false,
    timestamp,
  };
};

export const mapSupportMessages = (
  rows: SupportMessageRow[] | undefined | null,
  ticketUserId?: string | null
): SupportChatMessage[] =>
  (Array.isArray(rows) ? rows : []).map((row) => mapSupportMessage(row, ticketUserId));

/**
 * Row ticket đúng như REST trả về (`GET /admin/support/chats`,
 * `GET /admin/support/chats/:chatId`).
 *
 * Backend trả entity `SupportTicket` thô. Entity KHÔNG có `priority`,
 * `unreadByAdmin`, `lastMessage` hay `lastMessageAt` — mốc thời gian gần nhất
 * là `updatedAt`. FE trước đây đọc thẳng `lastMessageAt` nên mọi card hiện
 * "Invalid Date".
 */
export interface SupportTicketRow {
  id: string;
  userId: string;
  user?: {
    id?: string;
    fullname?: string;
    email?: string;
    avatarUrl?: string | null;
  } | null;
  adminId?: string | null;
  subject?: string;
  status?: SUPPORT_TICKET_STATUS | string;
  createdAt?: string;
  updatedAt?: string;
  unreadByAdmin?: number;
  /** `null` khi ticket chưa có tin nhắn nào. */
  lastMessageAt?: string | null;
  /** Backend chưa có cột này — xem ghi chú ở `mapAdminChat`. */
  priority?: 'low' | 'medium' | 'high';
  lastMessage?: {
    id?: string;
    content?: string;
    message?: string;
    senderId?: string;
    senderType?: 'user' | 'admin';
    messageType?: string;
    createdAt?: string | Date;
    timestamp?: string | Date;
  } | null;
}

const TICKET_STATUSES = Object.values(SUPPORT_TICKET_STATUS);

/** Backend đã validate enum đóng; đây chỉ là lưới an toàn cho dữ liệu cũ. */
const normalizeStatus = (status?: string): SUPPORT_TICKET_STATUS =>
  TICKET_STATUSES.includes(status as SUPPORT_TICKET_STATUS)
    ? (status as SUPPORT_TICKET_STATUS)
    : SUPPORT_TICKET_STATUS.OPEN;

/** Ticket row → shape mà UI admin đang dùng. */
export const mapAdminChat = (row: SupportTicketRow) => ({
  id: String(row.id),
  userId: String(row.userId ?? row.user?.id ?? ''),
  user: {
    fullname: row.user?.fullname ?? 'Người dùng',
    email: row.user?.email ?? '',
    avatarUrl: row.user?.avatarUrl ?? null,
  },
  subject: row.subject ?? '',
  // Backend chưa có cột `priority` (đang chờ quyết định sản phẩm); mặc định
  // 'medium' để UI khỏi vỡ khi lọc.
  priority: row.priority ?? ('medium' as const),
  status: normalizeStatus(row.status),
  // Số tin chưa đọc do CHỦ TICKET gửi. `is_read` là boolean dùng chung cho cả
  // hai phía nên không có read state riêng từng người — admin mark read cũng
  // xoá dấu bên user.
  unreadByAdmin: row.unreadByAdmin ?? 0,
  createdAt: row.createdAt ? new Date(row.createdAt) : new Date(NaN),
  // `null` khi ticket chưa có tin nhắn nào. KHÔNG fallback về `updatedAt`: cột
  // đó cũng nhảy khi đổi status, sẽ xếp ticket rỗng lẫn vào ticket có hoạt động.
  lastMessageAt: row.lastMessageAt ? new Date(row.lastMessageAt) : null,
  lastMessage: row.lastMessage
    ? {
        message: row.lastMessage.message ?? row.lastMessage.content ?? '',
        senderType:
          row.lastMessage.senderType ??
          (row.userId && String(row.lastMessage.senderId) === String(row.userId) ? 'user' : 'admin'),
        timestamp: row.lastMessage.timestamp
          ? new Date(row.lastMessage.timestamp)
          : row.lastMessage.createdAt
            ? new Date(row.lastMessage.createdAt)
            : new Date(),
      }
    : undefined,
});

export const mapAdminChats = (rows: SupportTicketRow[] | undefined | null) =>
  (Array.isArray(rows) ? rows : []).map(mapAdminChat);
