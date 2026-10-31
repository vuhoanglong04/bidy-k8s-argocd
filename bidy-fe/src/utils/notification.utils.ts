import { APP_ROUTES } from "@/constants/routes.constants";

/**
 * BE vẫn gửi `actionUrl` dạng `/orders/{id}`, nhưng FE không có trang chi tiết
 * đơn — mọi link đơn hàng dồn về danh sách đơn của user.
 */
export const resolveNotificationActionUrl = (actionUrl: string): string =>
  /^\/orders(\/|\?|$)/.test(actionUrl) ? APP_ROUTES.MY_ORDERS : actionUrl;
