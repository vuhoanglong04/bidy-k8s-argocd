"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { WEBSOCKET_EVENTS } from "@/constants/app.enum";
import { notificationKeys } from "@/services/notification/notification.query";
import type { Notification } from "@/services/notification/notification.fetcher";
import logger from "@/utils/logger";
import { clearAuthSession } from "@/lib/auth-refresh";
import { lockAccountSession } from "@/lib/account-lock";
import { formatCurrency, getValidNumber } from "@/utils";

import { useWebSocketCore } from "./useWebSocketCore";

/**
 * Gộp các lượt invalidate trong cùng một burst. Phiên đấu giá phút cuối có thể
 * bắn liên tiếp nhiều `bid_outbid`; mỗi lượt invalidate sẽ refetch MỌI biến thể
 * filter đang active trong cache, đủ để chạm rate-limit.
 */
const INVALIDATE_DEBOUNCE_MS = 800;

/**
 * Nhận notification realtime thay cho polling.
 *
 * Server đẩy event `notification` vào room `user_<id>`; socket đã authed bằng
 * JWT ở handshake là tự nhận, không phải join room thủ công. Vì vậy hook này
 * không emit gì cả — chỉ nghe rồi đẩy dữ liệu vào cache TanStack Query.
 *
 * Badge số chưa đọc được cộng tại chỗ thay vì refetch: payload đã là object
 * notification đầy đủ, gọi lại API chỉ để đọc một con số là thừa.
 */
export function useRealtimeNotifications() {
  const { socket, isConnected } = useWebSocketCore();
  const queryClient = useQueryClient();
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEverConnectedRef = useRef(false);

  // Trailing-edge debounce: burst bao nhiêu event cũng chỉ refetch một lần,
  // sau khi lặng 800ms. Badge không đi qua đây nên vẫn nhảy tức thì.
  const scheduleInvalidate = useCallback(() => {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    invalidateTimerRef.current = setTimeout(() => {
      invalidateTimerRef.current = null;
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.stats() });
    }, INVALIDATE_DEBOUNCE_MS);
  }, [queryClient]);

  /**
   * Trong lúc mất kết nối, mọi event đẩy tới đều rơi mất — badge và danh sách
   * đứng lại ở số cũ mà không có dấu hiệu gì. Nối lại được thì phải nạp lại
   * toàn bộ, kể cả `unreadCount` (khác nhánh burst ở trên: nhánh đó cộng badge
   * tại chỗ nên không cần refetch).
   *
   * Bỏ qua lần kết nối ĐẦU: `useNotifications`/`useUnreadCount` vừa fetch lúc
   * mount, invalidate thêm chỉ tạo một lượt gọi thừa.
   */
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (isConnected) {
      if (wasConnectedRef.current === false && hasEverConnectedRef.current) {
        logger.info("Socket nối lại — nạp lại notification đã lỡ");
        queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      }
      wasConnectedRef.current = true;
      hasEverConnectedRef.current = true;
    } else {
      wasConnectedRef.current = false;
    }
  }, [isConnected, queryClient]);

  // Huỷ lượt refetch còn treo khi unmount, tránh gọi API cho màn đã rời.
  useEffect(
    () => () => {
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!socket || !isConnected) return;

    // REST và socket dùng chung một object; khoá chính là `id` (bigint → string).
    // Cố tình KHÔNG fallback sang `_id`: nhận cả hai sẽ che mất chỗ nào còn trả
    // shape cũ thời Mongo thay vì để nó lộ ra ngay.
    const handleNotification = (payload: Notification) => {
      if (!payload?.id) {
        logger.warn("Bỏ qua notification realtime không có id", { payload });
        return;
      }

      logger.info("Nhận notification realtime", { type: payload.type });

      // Đường chậm nhất trong ba đường dẫn tới màn hình khoá — thường KHÔNG tới
      // được, vì BE đá socket gần như cùng lúc với lúc ban. Vẫn xử lý cho trường
      // hợp socket còn kịp nhận, và để `suspendedUntil` có chỗ hiển thị: hai
      // đường kia không mang theo chi tiết này.
      if (
        payload.type === "account_suspended" ||
        payload.type === "account_banned"
      ) {
        clearAuthSession();
        lockAccountSession({
          kind: payload.type === "account_banned" ? "banned" : "suspended",
          reason: payload.relatedData?.reason,
          suspendedUntil: payload.relatedData?.suspendedUntil,
        });
        return;
      }

      // Badge: cộng 1 nếu tin mới chưa đọc.
      if (!payload.isRead) {
        queryClient.setQueryData<{ count: number } | undefined>(
          notificationKeys.unreadCount(),
          (prev) => ({ count: (prev?.count ?? 0) + 1 })
        );
      }

      // Danh sách/thống kê: để TanStack tự nạp lại, tránh phải đoán đúng mọi
      // biến thể filter đang cache — nhưng gộp lại theo burst.
      scheduleInvalidate();
    };

    const handlePaymentReleased = (payload: {
      orderId: string;
      sellerPayout: string | number;
      platformFee?: string | number;
    }) => {
      logger.info("Nhận payment:released realtime", { payload });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      const payoutAmount = getValidNumber(payload?.sellerPayout);
      toast.success(
        `Đã nhận ${formatCurrency(payoutAmount)} từ đơn #${payload?.orderId || ""}`
      );
    };

    socket.on(WEBSOCKET_EVENTS.NOTIFICATION, handleNotification);
    socket.on(WEBSOCKET_EVENTS.PAYMENT_RELEASED, handlePaymentReleased);

    return () => {
      socket.off(WEBSOCKET_EVENTS.NOTIFICATION, handleNotification);
      socket.off(WEBSOCKET_EVENTS.PAYMENT_RELEASED, handlePaymentReleased);
    };
  }, [socket, isConnected, queryClient, scheduleInvalidate]);
}

export default useRealtimeNotifications;
