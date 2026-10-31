import Image from "next/image";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

import { NotificationIcon } from "./NotificationIcon";

/**
 * Mức nổi bật của badge. Cố ý KHÔNG trùng tên với `priority` của bất kỳ nguồn
 * nào: notification user dùng thang `normal|high|urgent`, support-chat của
 * admin dùng `low|medium|high` — hai thang khác nhau, caller tự map về tone.
 */
export type NotificationTone = "neutral" | "warning" | "critical";

const TONE_CLASSES: Record<NotificationTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-warning text-warning-foreground",
  critical: "bg-destructive text-destructive-foreground",
};

export interface NotificationItemData {
  id: string;
  /** Khoá chọn icon. Chuỗi tự do để dùng được cho cả 2 thang type. */
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  /** Đã format sẵn ở caller — item không tự biết locale/thư viện thời gian. */
  timeLabel: string;
  /** Nhãn badge; bỏ trống thì không render badge. */
  badgeLabel?: string;
  badgeTone?: NotificationTone;
  /** URL ảnh ĐÃ presign. Không có thì item hiển thị icon thay chỗ. */
  imageUrl?: string | null;
}

export interface NotificationItemProps {
  notification: NotificationItemData;
  onSelect?: (id: string) => void;
  /** Bỏ trống thì không render nút xoá (panel admin có, panel user chưa cần). */
  onDismiss?: (id: string) => void;
  className?: string;
}

export function NotificationItem({
  notification,
  onSelect,
  onDismiss,
  className,
}: NotificationItemProps) {
  const {
    id,
    type,
    title,
    message,
    isRead,
    timeLabel,
    badgeLabel,
    badgeTone = "neutral",
    imageUrl,
  } = notification;

  return (
    <div
      className={cn(
        "group relative flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0",
        onSelect && "cursor-pointer hover:bg-accent",
        !isRead && "bg-accent-subtle",
        className
      )}
      onClick={onSelect ? () => onSelect(id) : undefined}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(id);
              }
            }
          : undefined
      }
    >
      {/* Ảnh phiên nếu có, không thì icon theo type. `payment_reminder` và các
          type account không kèm ảnh nên nhánh icon là đường đi thường gặp. */}
      {imageUrl ? (
        <div className="relative size-10 shrink-0 overflow-hidden border border-border bg-muted">
          <Image
            src={imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="40px"
            unoptimized
          />
        </div>
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center border border-border bg-muted">
          <NotificationIcon type={type} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm text-foreground",
              !isRead && "font-semibold"
            )}
          >
            {title}
          </p>
          <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
            {timeLabel}
          </span>
        </div>

        <p className="mt-0.5 line-clamp-2 text-sm text-foreground-secondary">
          {message}
        </p>

        {(badgeLabel || !isRead) && (
          <div className="mt-2 flex items-center gap-2">
            {badgeLabel && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                  TONE_CLASSES[badgeTone]
                )}
              >
                {badgeLabel}
              </span>
            )}
            {!isRead && (
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-label="Chưa đọc"
              />
            )}
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          aria-label="Xoá thông báo"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(id);
          }}
          className="shrink-0 cursor-pointer p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
