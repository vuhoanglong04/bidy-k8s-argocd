import axios, { AxiosRequestConfig } from "axios";
import { getAppCookie } from "./auth-cookies";
import { redirect } from "next/navigation";
import { APP_CONSTANTS, API_ROUTES, APP_ROUTES } from "@/constants";
import { appConfig } from "@/config/app.config";
import { clearAuthSession, refreshSession } from "./auth-refresh";

/** Config gốc kèm cờ đánh dấu request đã được retry sau khi refresh. */
type RetriableConfig = AxiosRequestConfig & { _retriedAfterRefresh?: boolean };

/**
 * Các endpoint mà 401 là kết quả nghiệp vụ hợp lệ, không phải "token hết hạn":
 * sai mật khẩu khi đăng nhập, refresh token chết. Refresh ở đây là vô nghĩa và
 * sẽ nuốt mất thông báo lỗi của form.
 */
/**
 * Backend trả 401 cho cả ba trường hợp (thiếu token / token hết hạn / token
 * hỏng). Chỉ token hết
 * hạn mới đáng refresh; hai trường hợp kia refresh cũng vô ích và với cơ chế
 * reuse-detection của BE thì một lời gọi refresh thừa có thể đá user khỏi **mọi**
 * thiết bị. Nên ở đây so khớp chặt thay vì refresh mù.
 */
const TOKEN_EXPIRED_CODE = "TOKEN_EXPIRED";
const TOKEN_EXPIRED_MESSAGE = "Token expired";

function isTokenExpiredError(error: { response?: { data?: unknown } }): boolean {
  const data = error.response?.data;
  if (typeof data !== "object" || data === null) return false;

  const { error_code: errorCode, message } = data as {
    error_code?: unknown;
    message?: unknown;
  };

  // `error_code` là hợp đồng ổn định mà BE sẽ bổ sung (top-level, cạnh
  // `message`). Ưu tiên nó khi có; chỉ khi vắng mới rơi về so chuỗi `message` —
  // câu chữ có thể đổi bất cứ lúc nào.
  if (typeof errorCode === "string" && errorCode.length > 0) {
    return errorCode === TOKEN_EXPIRED_CODE;
  }

  return typeof message === "string" && message.includes(TOKEN_EXPIRED_MESSAGE);
}

const NO_REFRESH_PATHS = [
  API_ROUTES.SIGN_IN,
  API_ROUTES.SIGN_UP,
  API_ROUTES.REFRESH_TOKEN,
  API_ROUTES.FORGOT_PASS,
  API_ROUTES.RESET_PASS,
];

/**
 * `redirect()` của next/navigation chỉ dùng được khi render phía server: gọi
 * nó trong interceptor (chạy ở browser, ngoài render) chỉ ném lỗi
 * `NEXT_REDIRECT` — không điều hướng, và lỗi đó rơi vào `onError` của mutation
 * rồi hiện nguyên chữ "NEXT_REDIRECT" lên toast.
 */
function redirectToSignIn() {
  if (typeof window === "undefined") {
    redirect(APP_ROUTES.SIGN_IN);
  }
  const redirectParam = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`${APP_ROUTES.SIGN_IN}?redirect=${redirectParam}`);
}

const baseURL = `${appConfig.api.baseUrl}/api/v1`;
const axiosClient = axios.create({
  baseURL,
  timeout: appConfig.api.timeout,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
axiosClient.interceptors.request.use(
  (config) => {
    const token = getAppCookie(APP_CONSTANTS.AUTH_COOKIE_NAME);
    console.log('🌐 Axios Request:', {
      url: config.url,
      method: config.method,
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'No token'
    });
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(
      error instanceof Error ? error : new Error(String(error))
    );
  }
);

// Response interceptor
axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config: RetriableConfig | undefined = error.config;
    const url = config?.url ?? "";
    // 401 ở các endpoint auth là kết quả nghiệp vụ (sai mật khẩu, refresh token
    // chết) — để form tự hiển thị lỗi, không đụng vào phiên.
    const isAuthEndpoint = NO_REFRESH_PATHS.some((path) => url.includes(path));
    // Request không kèm token là của khách: 401 chỉ nghĩa là "cần đăng nhập",
    // không có phiên nào để refresh/xoá, và không được đá khách khỏi trang đang
    // xem (vd. /product/:id có query cá nhân chạy nền). Để caller tự xử lý.
    const hadToken = Boolean(config?.headers?.Authorization);
    const isUnauthorized =
      error.response?.status === 401 && !isAuthEndpoint && hadToken;

    if (isUnauthorized && config !== undefined && !config._retriedAfterRefresh &&
        isTokenExpiredError(error)) {
      // Access token 15m hết hạn là chuyện thường trong một phiên đấu giá dài.
      // Đổi refresh token lấy token mới rồi chạy lại đúng request đó, user
      // không thấy gì; chỉ khi refresh cũng hỏng mới đá về trang đăng nhập.
      const newToken = await refreshSession();
      if (newToken) {
        config._retriedAfterRefresh = true;
        config.headers = { ...config.headers, Authorization: `Bearer ${newToken}` };
        return axiosClient.request(config);
      }

      // `refreshSession` đã xoá phiên khi thất bại — chỉ còn việc điều hướng.
      redirectToSignIn();
    }

    // Còn lại: token hỏng/bị revoke, hoặc token mới vừa refresh vẫn bị từ chối.
    // Refresh không cứu được gì — phiên chết thật.
    if (isUnauthorized) {
      clearAuthSession();
      redirectToSignIn();
    }

    return Promise.reject(
      error instanceof Error ? error : new Error(String(error))
    );
  }
);

export default axiosClient;
