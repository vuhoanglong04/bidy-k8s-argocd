import { USER_ROLE, USER_STATUS } from "@/constants/app.enum";

/**
 * Người dùng dưới góc nhìn admin — `GET /admin/users`.
 *
 * Khác hẳn `User` ở `user.d.ts` (luồng public dùng `_id`, `status: boolean`):
 * backend admin trả `id` dạng UUID và `status` là enum chuỗi, kèm các cờ quản
 * trị (`accountLocked`, `passwordResetRequired`). Payload này KHÔNG có
 * `phone`/`identity` — đừng render hai cột đó cho bảng admin.
 */
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  fullname: string;
  role: `${USER_ROLE}`;
  status: `${USER_STATUS}`;
  /** Lý do admin đặt khi suspend/ban. */
  statusReason: string | null;
  /** Hạn tạm khoá; `null` nghĩa là vô thời hạn (hoặc không bị suspend). */
  suspendedUntil: string | null;
  /** Bị hệ thống khoá do đăng nhập sai nhiều lần — khác với suspend/ban thủ công. */
  accountLocked: boolean;
  lockedUntil: string | null;
  passwordResetRequired: boolean;
  avatarFileId: string | null;
  /** Presigned URL, hết hạn sau 1 giờ. Không lưu lại. */
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Số liệu tổng hợp kèm theo `GET /admin/users/:id`. */
export interface AdminUserSummary {
  products: number;
  auctions: number;
  ordersAsBuyer: number;
  ordersAsSeller: number;
  reviews: number;
  supportTickets: number;
}

export interface AdminUserDetail extends AdminUser {
  summary: AdminUserSummary;
}

/**
 * Phân trang của `GET /admin/users`: cursor-based, KHÔNG trả tổng số trang.
 * UI chỉ điều hướng tiến/lùi được, đừng dựng thanh số trang từ payload này.
 */
export interface AdminUserPagination {
  nextCursor: string | null;
  hasNext: boolean;
  limit: number;
}

export interface AdminUserListResponse {
  data: AdminUser[];
  pagination: AdminUserPagination;
}

export interface AdminUserListParams {
  /** Tìm theo username, email, hoặc khớp chính xác ID. */
  q?: string;
  status?: `${USER_STATUS}`;
  role?: `${USER_ROLE}`;
  locked?: boolean;
  created_from?: string;
  /** `created_at` = cũ nhất trước; bỏ trống = mới nhất trước. */
  sort?: string;
  cursor?: string;
  page?: number;
  limit?: number;
}

export interface AdminUpdateUserProfilePayload {
  username?: string;
  email?: string;
  fullname?: string;
}

export interface AdminChangeUserRolePayload {
  role: `${USER_ROLE}`;
  reason?: string;
}

export interface AdminSuspendUserPayload {
  reason: string;
  /** ISO date-time. Bỏ trống = tạm khoá vô thời hạn. */
  until?: string;
}

export interface AdminBanUserPayload {
  reason: string;
}

/** Một dòng nhật ký thao tác quản trị — `GET /admin/users/:id/audit-logs`. */
export interface AdminUserAuditLog {
  id: string;
  adminId: string;
  adminUsername?: string;
  action: string;
  reason?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  createdAt: string;
}
