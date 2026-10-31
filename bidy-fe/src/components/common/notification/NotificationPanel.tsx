import type { ReactNode } from "react";
import { Bell } from "lucide-react";

import { Skeleton } from "@/components/common/loading";
import { cn } from "@/lib/utils";

import {
  NotificationItem,
  type NotificationItemData,
} from "./NotificationItem";

export interface NotificationPanelProps {
  notifications: NotificationItemData[];
  isLoading?: boolean;
  unreadCount?: number;
  title?: string;
  onSelect?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  /** Ví dụ: link "Xem tất cả". Render dưới danh sách, dính đáy panel. */
  footer?: ReactNode;
  className?: string;
}

/** Skeleton khớp layout item thật (ô 40px + 2 dòng chữ) để không giật layout. */
function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <Skeleton className="size-10 shrink-0 rounded-none" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3 rounded-none" />
        <Skeleton className="h-3 w-full rounded-none" />
        <Skeleton className="h-3 w-1/3 rounded-none" />
      </div>
    </div>
  );
}

/**
 * Khung panel thông báo dùng chung cho dropdown chuông của user và panel của
 * admin. Chỉ nhận dữ liệu đã chuẩn hoá — không gọi API, không biết
 * TanStack Query hay context nào: hai nơi dùng lấy dữ liệu từ hai nguồn khác
 * hẳn nhau.
 */
export function NotificationPanel({
  notifications,
  isLoading = false,
  unreadCount = 0,
  title = "Thông báo",
  onSelect,
  onDismiss,
  onMarkAllAsRead,
  footer,
  className,
}: NotificationPanelProps) {
  return (
    <div
      className={cn(
        "flex max-h-[28rem] w-[22rem] flex-col border border-border bg-popover shadow-lg",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-wide text-popover-foreground uppercase">
            {title}
          </h3>
          {unreadCount > 0 && (
            <span className="bg-primary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        {onMarkAllAsRead && unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="cursor-pointer text-xs text-primary transition-colors hover:text-primary-hover"
          >
            Đánh dấu đã đọc
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <NotificationSkeleton key={i} />
          ))
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Bell className="size-7 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Chưa có thông báo nào
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onSelect={onSelect}
              onDismiss={onDismiss}
            />
          ))
        )}
      </div>

      {footer && (
        <div className="shrink-0 border-t border-border">{footer}</div>
      )}
    </div>
  );
}
