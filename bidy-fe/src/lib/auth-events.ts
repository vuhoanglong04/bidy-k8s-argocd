/**
 * Cầu nối một chiều giữa tầng auth và các kết nối sống lâu (Socket.IO).
 *
 * Socket lấy danh tính từ JWT lúc handshake, nên nó giữ nguyên danh tính cũ cho
 * tới khi disconnect — access token refresh xong mà không bắt tay lại thì server
 * vẫn coi phiên đó là token cũ. Tầng `lib/auth-refresh` không được import hook,
 * nên nó chỉ bắn một CustomEvent; bên socket tự lắng nghe và reconnect.
 */
export const AUTH_TOKENS_CHANGED_EVENT = "auth:tokens-changed";

export function notifyAuthTokensChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_TOKENS_CHANGED_EVENT));
}
