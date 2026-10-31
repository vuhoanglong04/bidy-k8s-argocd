import { APP_ROUTES } from "@/constants";

/**
 * Ba đường độc lập cùng dẫn về màn hình khoá tài khoản:
 *
 * 1. socket `sessionRevoked` — đến sớm nhất, BE đá socket ngay khi admin ban;
 * 2. 401 từ `POST /auth/refresh` — chậm hơn, tối đa 15 phút sau (hạn access token);
 * 3. notification `account_suspended`/`account_banned` — bản ghi lịch sử, user
 *    thường chỉ đọc được nếu tài khoản đã được mở lại.
 *
 * Chi tiết đi qua `sessionStorage` chứ không qua query param: `reason` là câu
 * admin tự viết, đưa lên URL là đẩy nó vào lịch sử duyệt web và log server.
 */
const STORAGE_KEY = "bidy:account-lock";

export type AccountLockKind =
  | "suspended"
  | "banned"
  /** Biết là tài khoản không dùng được, nhưng không biết ban hay suspend. */
  | "unavailable"
  /** Phiên bị thu hồi — có thể do ban, cũng có thể do admin buộc đăng xuất. */
  | "revoked";

export interface AccountLockDetails {
  kind: AccountLockKind;
  /** Câu admin viết. Vắng mặt khi tín hiệu đến từ `sessionRevoked`. */
  reason?: string;
  /** ISO. Null/vắng nghĩa là không có hạn (ban vĩnh viễn hoặc chưa biết). */
  suspendedUntil?: string | null;
}

export function readAccountLock(): AccountLockDetails | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { kind } = parsed as AccountLockDetails;
    if (!["suspended", "banned", "unavailable", "revoked"].includes(kind)) {
      return null;
    }
    return parsed as AccountLockDetails;
  } catch {
    // Private mode / storage bị chặn: màn hình vẫn hiện được ở dạng chung chung.
    return null;
  }
}

export function clearAccountLock() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Không đọc/ghi được storage thì cũng không có gì để dọn.
  }
}

/**
 * Ghi lý do rồi đưa user sang màn hình khoá.
 *
 * KHÔNG tự gọi `clearAuthSession()`: `lib/auth-refresh` là nơi giữ hàm đó và
 * chính nó gọi hàm này, nhập ngược lại sẽ thành vòng import. Nơi gọi phải xoá
 * phiên trước.
 *
 * Dùng `window.location.replace` chứ không phải router của Next: hàm này chạy
 * từ interceptor axios và từ handler socket — ngoài cây React, không có router.
 * `replace` cũng chặn nút Back quay lại trang đã mất quyền truy cập.
 */
export function lockAccountSession(details: AccountLockDetails) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(details));
  } catch {
    // Ghi hỏng thì màn hình rơi về nội dung mặc định, vẫn hơn là không chặn.
  }

  if (window.location.pathname !== APP_ROUTES.ACCOUNT_LOCKED) {
    window.location.replace(APP_ROUTES.ACCOUNT_LOCKED);
  }
}
