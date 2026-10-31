"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

import {
  NotificationPanel,
  type NotificationItemData,
  type NotificationTone,
} from "@/components/common/notification";
import {
  APP_ROUTES,
  NOTIFICATION_PRIORITY_LABELS,
  type NotificationPriority,
} from "@/constants";
import { useRealtimeNotifications } from "@/hooks";
import { resolveNotificationActionUrl } from "@/utils";
import {
  useMarkAllAsRead,
  useMarkAsRead,
  useNotifications,
  useUnreadCount,
} from "@/services/notification";
import type { Notification } from "@/services/notification/notification.fetcher";
import { cn } from "@/lib/utils";

/** `normal` không đáng chiếm một badge màu — chỉ high/urgent mới nổi lên. */
const PRIORITY_TONES: Record<NotificationPriority, NotificationTone | null> = {
  normal: null,
  high: "warning",
  urgent: "critical",
};

const formatRelativeTime = (value: string) => {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale: vi });
  } catch {
    return "Vừa xong";
  }
};

/**
 * Chuông + dropdown thông báo cho người dùng thường.
 *
 * Danh sách chỉ nạp khi panel mở (`enabled`): phần lớn phiên duyệt web không
 * ai bấm chuông, không việc gì phải kéo 8 item cho mọi trang. Badge thì luôn
 * sống nhờ `useUnreadCount` + socket.
 */
export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const { data: unreadData } = useUnreadCount();
  const { data, isLoading } = useNotifications(
    { page: 1, limit: 8 },
    { enabled: isOpen }
  );

  // Điểm DUY NHẤT đăng ký listener notification realtime trong app phía user:
  // Header render ở mọi trang, và mỗi listener thừa sẽ cộng badge thêm một lần
  // cho cùng một event. Đừng gọi lại hook này ở trang/panel khác.
  useRealtimeNotifications();

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const unreadCount = unreadData?.count ?? 0;

  const items: NotificationItemData[] = useMemo(
    () =>
      (data?.notifications ?? []).map((n: Notification) => {
        const tone = PRIORITY_TONES[n.priority] ?? null;
        return {
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: n.isRead,
          timeLabel: formatRelativeTime(n.createdAt),
          badgeLabel: tone ? NOTIFICATION_PRIORITY_LABELS[n.priority] : undefined,
          badgeTone: tone ?? undefined,
          // `payment_reminder` và các type account không kèm auction → không ảnh.
          imageUrl: n.relatedData?.auction?.image ?? null,
        };
      }),
    [data?.notifications]
  );

  const handleSelect = (id: string) => {
    const target = data?.notifications.find((n) => n.id === id);
    if (!target) return;

    if (!target.isRead) markAsRead.mutate(id);

    setIsOpen(false);
    if (target.actionUrl) {
      router.push(resolveNotificationActionUrl(target.actionUrl));
    } else if (
      target.type.startsWith("withdrawal_") ||
      target.type === "payment_released" ||
      target.type === "topup_success"
    ) {
      router.push(APP_ROUTES.MY_WALLET);
    }
  };

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        aria-label="Thông báo"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex items-center justify-center cursor-pointer text-foreground transition-colors hover:text-primary"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold tabular-nums text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Bắt click ra ngoài. Panel nằm sau lớp này nên vẫn bấm được. */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <NotificationPanel
            className={cn("absolute right-0 top-[calc(100%+0.75rem)] z-50")}
            notifications={items}
            isLoading={isLoading}
            unreadCount={unreadCount}
            onSelect={handleSelect}
            onMarkAllAsRead={() => markAllAsRead.mutate()}
            footer={
              <Link
                href={APP_ROUTES.NOTIFICATIONS}
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2.5 text-center text-xs font-semibold text-primary transition-colors hover:bg-accent"
              >
                Xem tất cả thông báo
              </Link>
            }
          />
        </>
      )}
    </div>
  );
}
