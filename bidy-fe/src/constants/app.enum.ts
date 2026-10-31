export enum HTTP_STATUS_CODES {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

export enum APP_CONSTANTS {
  AUTH_COOKIE_NAME = "authCookie",
  USER_COOKIE_NAME = "userCookie",
  /** Refresh token (BE default 7d) — dùng để lấy access token mới khi token 15m hết hạn. */
  REFRESH_COOKIE_NAME = "refreshCookie",
}

/**
 * Trạng thái phiên đấu giá — khớp 4 giá trị enum AuctionStatus của backend.
 * Lưu ý: INITIAL map sang "pending" (tên lệch do lịch sử, không đổi tên).
 */
export enum STATUS_AUCTIONS {
  INITIAL = "pending",
  HAPPENING = "happening",
  ENDED = "ended",
  CANCELLED = "cancelled",
}

/**
 * Trạng thái tài khoản (`user.status`) — khớp enum `UserStatus` của backend.
 * `INACTIVE` chỉ còn tồn tại vì dữ liệu cũ; luồng quản trị mới dùng
 * SUSPENDED (tạm khoá, có hạn) và BANNED (cấm vĩnh viễn).
 */
export enum USER_STATUS {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  BANNED = "banned",
  DEACTIVATED = "deactivated",
}

export const USER_STATUS_LABELS: Record<USER_STATUS, string> = {
  [USER_STATUS.ACTIVE]: "Đang hoạt động",
  [USER_STATUS.INACTIVE]: "Chưa kích hoạt",
  [USER_STATUS.SUSPENDED]: "Tạm khoá",
  [USER_STATUS.BANNED]: "Bị cấm",
  [USER_STATUS.DEACTIVATED]: "Đã vô hiệu hoá",
};

/**
 * Trạng thái ticket hỗ trợ — enum ĐÓNG, khớp `SupportTicketStatus` của backend.
 * Backend validate ở cả DTO, service (đường socket) lẫn CHECK constraint của DB;
 * giá trị lạ bị từ chối (REST 400, socket `error` code `INVALID_STATUS`), kể cả
 * khi dùng làm filter cho `GET /admin/support/chats?status=`.
 */
export enum SUPPORT_TICKET_STATUS {
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  RESOLVED = "resolved",
  CLOSED = "closed",
}

export const SUPPORT_TICKET_STATUS_LABELS: Record<SUPPORT_TICKET_STATUS, string> = {
  [SUPPORT_TICKET_STATUS.OPEN]: "Đang mở",
  [SUPPORT_TICKET_STATUS.IN_PROGRESS]: "Đang xử lý",
  [SUPPORT_TICKET_STATUS.RESOLVED]: "Đã giải quyết",
  [SUPPORT_TICKET_STATUS.CLOSED]: "Đã đóng",
};

/** Vai trò tài khoản — khớp enum `UserRole` của backend. */
export enum USER_ROLE {
  USER = "user",
  ADMIN = "admin",
}

export const USER_ROLE_LABELS: Record<USER_ROLE, string> = {
  [USER_ROLE.USER]: "Người dùng",
  [USER_ROLE.ADMIN]: "Quản trị viên",
};

/**
 * Tình trạng vật lý của sản phẩm (`product.condition`) — KHÔNG phải trạng thái
 * phiên đấu giá (xem `STATUS_AUCTIONS`). Giá trị khớp enum backend.
 */
export enum PRODUCT_CONDITION {
  NEW = "new",
  LIKE_NEW = "like_new",
  USED = "used",
  REFURBISHED = "refurbished",
}

export const PRODUCT_CONDITION_LABELS: Record<PRODUCT_CONDITION, string> = {
  [PRODUCT_CONDITION.NEW]: "Mới",
  [PRODUCT_CONDITION.LIKE_NEW]: "Như mới",
  [PRODUCT_CONDITION.USED]: "Đã qua sử dụng",
  [PRODUCT_CONDITION.REFURBISHED]: "Tân trang",
};

/** Đổi `condition` thô từ API sang nhãn tiếng Việt; không nhận diện được thì trả nhãn mặc định. */
export function getProductConditionLabel(condition?: string | null): string {
  if (!condition) return "Chưa rõ tình trạng";

  const normalized = String(condition).toLowerCase() as PRODUCT_CONDITION;
  return PRODUCT_CONDITION_LABELS[normalized] ?? "Chưa rõ tình trạng";
}

// API Endpoints
export enum API_ENDPOINTS {
  // Path tương đối so với `axiosClient` (baseURL đã gồm sẵn `/api/v1`) —
  // KHÔNG thêm tiền tố `/api/v1` ở đây, sẽ thành `/api/v1/api/v1/...`.
  TIME_CURRENT = "/time/current",
  TIME_SYNC = "/time/sync",
  TIME_AUCTION_REMAINING = "/time/auction",
  TIME_BATCH = "/time/auctions/batch",
}

/**
 * WebSocket events — mirrors the backend gateway contract
 * (bidy-be `src/modules/common/socket-handler.service.ts`).
 *
 * Backend chỉ có namespace gốc `/`, phân tách bằng room (xem `WEBSOCKET_ROOMS`).
 * Không có event nào dùng ack callback — lỗi trả về qua event `ERROR`.
 * Chỉ dùng enum này, không hardcode chuỗi tên event.
 */
export enum WEBSOCKET_EVENTS {
  // --- Auction: client -> server ---
  /** payload: `{ auctionId, userId? }` */
  JOIN_AUCTION = "joinAuction",
  /** payload: `{ auctionId }` */
  LEAVE_AUCTION = "leaveAuction",
  /** payload: `{ auctionId }` (object, KHÔNG phải string) */
  REQUEST_AUCTION_STATUS = "requestAuctionStatus",
  /** payload: `auctionId` (string trần — bất đối xứng với event trên, đúng theo BE) */
  REQUEST_BIDDER_STATS = "requestBidderStats",
  /** payload: bid data — server broadcast lại */
  NEW_BID = "newBid",

  // --- Auction: server -> client ---
  /** 2 shape: cron `{ auctionId, status, timestamp }` | AuctionWS: object đầy đủ */
  AUCTION_STATUS_UPDATE = "auctionStatusUpdate",
  AUCTION_UPDATE = "auctionUpdate",
  COUNTDOWN_SYNC = "countdownSync",
  CURRENT_AUCTION_STATUS = "currentAuctionStatus",
  CURRENT_BIDDER_STATS = "currentBidderStats",
  BIDDER_UPDATE = "bidderUpdate",
  BID_UPDATE = "bidUpdate",
  AUTO_BID_STATUS_UPDATE = "autoBidStatusUpdate",
  AUTO_BID_UPDATE = "autoBidUpdate",
  TEST_BROADCAST = "testBroadcast",

  // --- Chat: client -> server ---
  // Danh tính (userId/senderId/adminId) lấy từ JWT ở handshake, KHÔNG gửi kèm
  // payload nữa. Gửi thừa cũng bị bỏ qua; thiếu token thì ra SOCKET_UNAUTHENTICATED.
  /** payload: `{ conversationId, message }` */
  SEND_MESSAGE = "sendMessage",
  /** payload: `{ conversationId }` — có thể bị TỪ CHỐI nếu không phải thành viên */
  JOIN_CONVERSATION = "joinConversation",
  /** payload: `{ conversationId }` */
  LEAVE_CONVERSATION = "leaveConversation",

  // --- Chat: server -> client ---
  GET_MESSAGE = "getMessage",
  /** Server không tự broadcast nữa — phải chủ động emit, chỉ socket đó nhận lại. */
  GET_USERS = "getUsers",
  TYPING_INDICATOR = "typingIndicator",
  MESSAGE_READ_STATUS = "messageReadStatus",
  /**
   * KHÔNG còn được server tự đẩy khi join. Lấy lịch sử bằng REST
   * `GET /chat/conversations/:id/messages?page&limit` (trả DESC, phải reverse).
   */
  CONVERSATION_HISTORY = "conversationHistory",
  /** Chỉ participant nhận — không còn dùng để dựng danh sách hội thoại toàn cục. */
  CONVERSATION_ACTIVITY = "conversationActivity",

  // --- Support chat (user): client -> server ---
  /** payload: `{ userId, subject?, priority? }` */
  USER_START_CHAT = "user_start_chat",
  /**
   * payload: `{ chatId, message, clientMessageId }`
   * Gửi kèm `clientMessageId` thì server trả `support_message_ack` riêng cho
   * sender — đó là cách duy nhất biết tin nhắn đã lưu hay hỏng.
   */
  USER_SEND_MESSAGE = "user_send_message",
  /** payload: `{ chatId, isTyping }` */
  SUPPORT_USER_TYPING = "user_typing",
  /** payload: `{ chatId }` */
  USER_JOIN_CHAT = "user_join_chat",
  /** payload: `{ chatId, messageIds }` — dùng cho cả user lẫn admin */
  USER_READ_MESSAGES = "user_read_messages",

  // --- Support chat (admin): client -> server ---
  // Yêu cầu role 'admin' thật trong token, nếu không server trả SOCKET_FORBIDDEN.
  /** payload: `{ chatId }` */
  ADMIN_JOIN_CHAT = "admin_join_chat",
  /** không có tham số */
  ADMIN_JOIN_ALL = "admin_join_all",
  /**
   * payload: `{ chatId, message, clientMessageId }`
   * Server tự join room `support_chat_<chatId>` trước khi lưu, nên không cần
   * `admin_join_chat` trước đó. Đây là đường gửi tin nhắn chính thức của admin
   * panel — REST `POST /admin/support/chats/:chatId/messages` chỉ dành cho
   * caller không tương tác (script, integration).
   */
  ADMIN_SEND_MESSAGE = "admin_send_message",
  /** payload: `{ chatId, isTyping }` */
  ADMIN_TYPING = "admin_typing",
  /** payload: `{ chatId, status, additionalData? }` */
  ADMIN_STATUS_UPDATE = "admin_status_update",

  // --- Support chat: server -> client ---
  NEW_SUPPORT_MESSAGE = "new_support_message",
  /**
   * Ack chỉ gửi riêng cho sender, payload:
   * `{ clientMessageId, status: 'saved' | 'failed', chatId, messageId, createdAt, code? }`
   * `saved` mang `messageId` thật để thay bong bóng lạc quan; `failed` nghĩa là
   * KHÔNG có gì được lưu → gỡ bong bóng. Sender nhận CẢ ack lẫn
   * `new_support_message` (vì đang ở trong room) và không đảm bảo thứ tự — dedupe
   * theo `messageId`, ghép bong bóng tạm theo `clientMessageId`.
   */
  SUPPORT_MESSAGE_ACK = "support_message_ack",
  SUPPORT_CHAT_CREATED = "support_chat_created",
  SUPPORT_CHAT_STATUS_UPDATE = "support_chat_status_update",
  SUPPORT_CHAT_TYPING = "support_chat_typing",
  SUPPORT_CHAT_READ_RECEIPT = "support_chat_read_receipt",
  ADMIN_STATUS_CHANGE = "admin_status_change",
  /**
   * Notification realtime, đẩy vào room `user_<id>` — socket đã authed là tự
   * nhận, không phải join thêm. Payload đúng object như REST `/notifications`.
   */
  NOTIFICATION = "notification",
  ADMIN_NOTIFICATION = "admin_notification",
  /**
   * Server thu hồi phiên rồi ngắt socket ngay sau đó.
   * payload: `{ reason: 'ACCOUNT_NOT_AVAILABLE' | 'SESSION_REVOKED', at: ISO }`
   * Bắn tới room `user_<id>` nên mọi tab/thiết bị của người đó cùng nhận.
   * Không handle thì client sẽ reconnect loop tới khi access token hết hạn.
   */
  SESSION_REVOKED = "sessionRevoked",
  SUPPORT_MESSAGE_NOTIFICATION = "support_message_notification",
  CHAT_STATUS_CHANGED = "chat_status_changed",

  // --- Orders & Payments ---
  /** payload: `{ orderId }` */
  JOIN_ORDER = "joinOrder",
  /** payload: `{ orderId }` */
  LEAVE_ORDER = "leaveOrder",
  /** payload: `{ orderId, amount, paymentCode?, status: 'paid' }` */
  ORDER_PAID = "order:paid",
  /** payload: `{ transactionId?, walletId, amount }` (không có orderId) */
  WALLET_TOPUP_SUCCESS = "wallet:topup_success",
  /** payload: `{ orderId, amount, paymentStatus, fundStatus }` */
  ORDER_REFUNDED = "order:refunded",
  /** payload: `{ orderId, sellerPayout, platformFee }` */
  PAYMENT_RELEASED = "payment:released",

  // --- Chung ---
  /** payload: `{ message, code?, details?, context?, timestamp? }` */
  ERROR = "error",
}

/**
 * Room naming của backend — dùng underscore, không phải dấu hai chấm.
 * Client phải tự emit event join; server không auto-join.
 */
export const WEBSOCKET_ROOMS = {
  auction: (auctionId: string) => `auction_${auctionId}`,
  conversation: (conversationId: string) => `conversation_${conversationId}`,
  supportChat: (chatId: string) => `support_chat_${chatId}`,
  userSupport: (userId: string) => `user_${userId}_support`,
  order: (orderId: string) => `order_${orderId}`,
  admin: (adminId: string) => `admin_${adminId}`,
  adminRoom: "admin_room",
  adminNotifications: "admin_notifications",
} as const;
