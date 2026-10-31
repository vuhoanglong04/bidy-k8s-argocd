import { APP_CONSTANTS } from "@/constants";
import { getAppCookie, removeCookie, setAppCookie } from "@/lib/auth-cookies";
import { notifyAuthTokensChanged } from "@/lib/auth-events";
import { logoutDevice, refreshAccessToken } from "@/services/auth/auth.fetcher";
import { clearAuth } from "@/store/slices/authSlice";
import { store } from "@/store";
import logger from "@/utils/logger";
import { verifyJwt } from "@/utils";
import { lockAccountSession } from "@/lib/account-lock";
import type { paths } from "@/types/openapi";

/**
 * Mã lỗi 401 của `POST /auth/refresh` — nguồn: `components.schemas` trong
 * `openapi.d.ts` (BE map từ chính hằng số message của service, nên đổi wording
 * hay i18n hoá đều không làm lệch mã).
 *
 * `ACCOUNT_NOT_AVAILABLE` nghĩa là tài khoản bị suspend/ban: retry không bao giờ
 * hợp lệ lại, phải đưa sang màn hình khoá thay vì form đăng nhập.
 */
type RefreshErrorCode = NonNullable<
  NonNullable<
    paths["/api/v1/auth/refresh"]["post"]["responses"][401]["content"]["application/json"]["error_code"]
  >
>;

function readRefreshErrorCode(error: unknown): RefreshErrorCode | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (typeof data !== "object" || data === null) return undefined;

  const { error_code: errorCode } = data as { error_code?: unknown };
  return typeof errorCode === "string"
    ? (errorCode as RefreshErrorCode)
    : undefined;
}

/**
 * Một request refresh đang bay. Khi nhiều request cùng dính 401 một lúc (màn
 * hình đấu giá bắn song song nhiều query), tất cả phải chờ chung promise này
 * thay vì mỗi request tự gọi `/auth/refresh` — BE có rotation thì n lời gọi
 * song song sẽ vô hiệu hoá lẫn nhau và đá user ra ngoài.
 */
let inFlight: Promise<string | null> | null = null;

export function getStoredRefreshToken(): string | undefined {
  return getAppCookie(APP_CONSTANTS.REFRESH_COOKIE_NAME);
}

/** Ghi cặp token sau khi đăng nhập hoặc refresh thành công. */
export function persistTokens(token: string, refreshToken?: string | null) {
  setAppCookie(APP_CONSTANTS.AUTH_COOKIE_NAME, token);
  if (refreshToken) {
    setAppCookie(APP_CONSTANTS.REFRESH_COOKIE_NAME, refreshToken);
  }
  // Socket bắt tay bằng token cũ vẫn mang danh tính cũ tới lúc disconnect.
  notifyAuthTokensChanged();
}

/** Xoá sạch phiên: cookie + Redux. Không điều hướng — nơi gọi tự quyết định. */
export function clearAuthSession() {
  removeCookie(APP_CONSTANTS.AUTH_COOKIE_NAME);
  removeCookie(APP_CONSTANTS.USER_COOKIE_NAME);
  removeCookie(APP_CONSTANTS.REFRESH_COOKIE_NAME);
  store.dispatch(clearAuth());
  // Đăng xuất cũng phải hạ socket: phiên đang mở vẫn còn quyền đọc hội thoại.
  notifyAuthTokensChanged();
}

/**
 * Thu hồi phiên của thiết bị này ở phía server, phục vụ luồng đăng xuất.
 *
 * Nhận token qua tham số chứ không tự đọc cookie: nơi gọi xoá cookie ngay sau
 * khi gọi hàm này, đọc trễ trong microtask sẽ ra rỗng.
 *
 * BE lấy danh tính từ access token, nên token hết hạn thì logout trả 401 và
 * refresh token vẫn sống tiếp 7 ngày trong Redis dù user đã bấm đăng xuất —
 * đúng kịch bản để tab qua đêm rồi đăng xuất. Vì vậy token hết hạn thì đổi lấy
 * token mới trước.
 *
 * Cố tình **không** gọi `refreshSession()` để tự khởi động một lần refresh mới:
 * hàm đó ghi cặp token mới trở lại cookie, tức là hồi sinh đúng cái phiên vừa
 * bị xoá. Nhưng nếu đã có một refresh đang bay thì phải bám vào nó (xem dưới).
 */
export async function revokeDeviceSession(
  deviceId: string,
  accessToken: string | undefined,
  refreshToken: string | undefined
) {
  let usableToken = accessToken;

  if (!usableToken || !(await verifyJwt(usableToken))) {
    // Có refresh đang bay (user bấm đăng xuất đúng lúc một query 401) thì dùng
    // chung kết quả đó. Tự gọi refresh song song là hai lần xoay cùng một
    // token: lần này grace period của BE đỡ được, nhưng thêm một lần nữa chen
    // vào là chạm reuse thật và huỷ phiên trên MỌI thiết bị.
    if (inFlight) {
      usableToken = (await inFlight) ?? undefined;
    } else if (refreshToken) {
      try {
        usableToken = (await refreshAccessToken(refreshToken)).token;
      } catch {
        // Refresh token cũng chết → phiên phía server coi như đã kết thúc.
        return;
      }
    }

    if (!usableToken) return;
  }

  await logoutDevice(deviceId, usableToken);

  // Dọn lại lần nữa. Nơi gọi đã `clearAuthSession()` ngay từ đầu, nhưng nếu ta
  // vừa bám vào một refresh đang bay thì refresh đó ghi cặp token mới vào cookie
  // SAU thời điểm ấy — tức là hồi sinh phiên vừa xoá. Gọi lại ở đây là idempotent.
  clearAuthSession();
}

/**
 * Đổi refresh token lấy access token mới.
 *
 * Trả `null` khi không refresh được (hết refresh token, refresh token hết hạn
 * hoặc bị revoke) — lúc đó phiên đã bị xoá sạch và nơi gọi nên đưa user về
 * trang đăng nhập. Trả access token mới khi thành công.
 */
export function refreshSession(): Promise<string | null> {
  if (inFlight) return inFlight;

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearAuthSession();
    return Promise.resolve(null);
  }

  inFlight = refreshAccessToken(refreshToken)
    .then((result) => {
      persistTokens(result.token, result.refreshToken);
      logger.debug("Access token refreshed");
      return result.token;
    })
    .catch((error: unknown) => {
      logger.debug("Refresh token bị từ chối, đăng xuất phiên", { error });

      // Refresh hỏng thì token sẽ KHÔNG bao giờ hợp lệ lại — không retry ở bất
      // kỳ đâu. Riêng trường hợp tài khoản bị khoá thì đưa thẳng sang màn hình
      // giải thích thay vì để user loay hoay ở trang đăng nhập.
      clearAuthSession();

      // BE dùng chung một mã cho cả ban lẫn suspend và không kèm chi tiết, nên
      // chỉ khẳng định được "tài khoản không khả dụng".
      if (readRefreshErrorCode(error) === "ACCOUNT_NOT_AVAILABLE") {
        lockAccountSession({ kind: "unavailable" });
      }

      return null;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
