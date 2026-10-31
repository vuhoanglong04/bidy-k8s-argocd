import axios from "axios";
import { API_ROUTES } from "@/constants";
import { appConfig } from "@/config/app.config";

/**
 * Refresh KHÔNG dùng `axiosClient`.
 *
 * `axiosClient` có response interceptor bắt 401 rồi gọi lại chính hàm này —
 * nếu refresh cũng đi qua đó thì một refresh hỏng sẽ tự gọi lại chính nó vô
 * hạn. Instance trần dưới đây cắt vòng lặp: nó không có interceptor nào, và
 * cũng không gắn `Authorization` (access token đang hết hạn, gửi lên vô nghĩa).
 */
const authHttp = axios.create({
  baseURL: `${appConfig.api.baseUrl}/api/v1`,
  timeout: appConfig.api.timeout,
  headers: { "Content-Type": "application/json" },
});

/** Phần token trong response của `POST /auth/refresh`. */
export interface RefreshTokenResult {
  /** Access token mới (BE default 15m). */
  token: string;
  /** Refresh token mới nếu BE có rotation; `null` khi BE giữ nguyên token cũ. */
  refreshToken: string | null;
}

/**
 * `POST /auth/refresh` — spec `openapi.d.ts` để trống body của response 200,
 * nên hàm này narrow thủ công thay vì tin vào một shape cố định: chấp nhận cả
 * envelope `{ data: { token } }` lẫn body phẳng `{ token }`.
 */
function parseRefreshResponse(payload: unknown): RefreshTokenResult {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Refresh token: response không hợp lệ");
  }

  const envelope = payload as { data?: unknown };
  const body: unknown =
    typeof envelope.data === "object" && envelope.data !== null
      ? envelope.data
      : payload;

  const { token, refreshToken } = body as {
    token?: unknown;
    refreshToken?: unknown;
  };

  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Refresh token: response thiếu access token");
  }

  return {
    token,
    refreshToken: typeof refreshToken === "string" && refreshToken.length > 0
      ? refreshToken
      : null,
  };
}

/**
 * `POST /auth/logout` — thu hồi refresh token của đúng thiết bị này.
 *
 * Cũng dùng `authHttp` thay vì `axiosClient`: nếu access token đã hết hạn thì
 * `axiosClient` sẽ bắt 401 và kích hoạt refresh, mà nơi gọi (`revokeDeviceSession`)
 * đã tự lo việc đó rồi — để interceptor xen vào sẽ ghi cookie trở lại và hồi
 * sinh phiên vừa xoá. `Authorization` gắn tay và **bắt buộc**: BE lấy danh tính
 * từ access token, `userId` trong body bị bỏ qua hoàn toàn.
 *
 * Lỗi được nuốt có chủ đích: đăng xuất phía client phải xảy ra dù server có trả
 * lời hay không.
 */
export async function logoutDevice(deviceId: string, accessToken: string) {
  try {
    await authHttp.post(
      API_ROUTES.LOGOUT,
      { deviceId },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch {
    // Không chặn luồng đăng xuất cục bộ.
  }
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshTokenResult> {
  const { data } = await authHttp.post<unknown>(API_ROUTES.REFRESH_TOKEN, {
    refreshToken,
  });
  return parseRefreshResponse(data);
}
