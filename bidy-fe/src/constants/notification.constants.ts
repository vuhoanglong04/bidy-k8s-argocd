import type { components } from "@/types/openapi";

/**
 * Enum notification lấy thẳng từ swagger BE (`npm run openapi:sync`).
 *
 * KHÔNG hardcode lại union ở đây: bản chép tay cũ lệch khỏi BE mà không ai
 * biết — FE từng lọc theo `payment`/`social`/`security`, ba giá trị không
 * writer nào sinh ra, vì swagger cũ khai sai và FE copy đúng theo đó.
 */
export type NotificationType =
  | components["schemas"]["NotificationType"]
  | "auction_request_approved"
  | "auction_request_rejected";
export type NotificationCategory =
  components["schemas"]["NotificationCategory"];
export type NotificationPriority =
  components["schemas"]["NotificationPriority"];

/**
 * Nhãn hiển thị. Đây cũng là chốt chặn khi BE thêm giá trị mới: `Record` đòi
 * đủ khoá nên `tsc` sẽ báo ngay sau lần `openapi:sync` kế tiếp, thay vì để một
 * category mới lặng lẽ rơi vào nhánh default.
 */
export const NOTIFICATION_CATEGORY_LABELS: Record<
  NotificationCategory,
  string
> = {
  auction: "Đấu giá",
  bid: "Đặt giá",
  order: "Đơn hàng",
  account: "Tài khoản",
  system: "Hệ thống",
};

export const NOTIFICATION_PRIORITY_LABELS: Record<
  NotificationPriority,
  string
> = {
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn cấp",
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  auction_started: "Phiên bắt đầu",
  auction_ending_soon: "Sắp kết thúc",
  auction_won: "Thắng phiên",
  auction_lost: "Không thắng",
  new_bid: "Lượt trả giá mới",
  bid_outbid: "Bị vượt giá",
  payment_reminder: "Nhắc thanh toán",
  account_locked: "Tài khoản bị khoá",
  account_unlocked: "Tài khoản mở lại",
  account_suspended: "Tài khoản bị tạm ngưng",
  account_banned: "Tài khoản bị cấm",
  system_maintenance: "Bảo trì hệ thống",
  // 6 types mới:
  payment_released: "Tiền bán hàng đã giải ngân",
  withdrawal_completed: "Rút tiền thành công",
  withdrawal_rejected: "Yêu cầu rút tiền bị từ chối",
  topup_success: "Nạp tiền thành công",
  withdrawal_sla_overdue: "Cảnh báo quá hạn xử lý rút tiền",
  wallet_reconciliation_failed: "Đối soát ví thất bại",
  // Luồng duyệt phiên:
  auction_request_approved: "Yêu cầu đăng phiên được duyệt",
  auction_request_rejected: "Yêu cầu đăng phiên bị từ chối",
};

/** Suy ra từ nhãn để chỉ có một nguồn sự thật cho cả filter lẫn hiển thị. */
export const NOTIFICATION_CATEGORIES = Object.keys(
  NOTIFICATION_CATEGORY_LABELS
) as NotificationCategory[];

export const NOTIFICATION_PRIORITIES = Object.keys(
  NOTIFICATION_PRIORITY_LABELS
) as NotificationPriority[];
