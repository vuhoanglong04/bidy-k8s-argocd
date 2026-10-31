import React from "react";

import { cn } from "@/lib/utils";
import {
  STATUS_AUCTIONS,
  USER_STATUS,
  USER_STATUS_LABELS,
} from "@/constants/app.enum";

type StatusTone = "success" | "warning" | "destructive" | "info" | "neutral";

interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

const toneClass: Record<StatusTone, string> = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info",
  neutral: "bg-muted text-muted-foreground",
};

const dotClass: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

/** Nhãn trạng thái dạng pill — ngoại lệ bo góc có chủ đích. */
export default function StatusPill({
  label,
  tone = "neutral",
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClass[tone])} aria-hidden />
      {label}
    </span>
  );
}

/** Trạng thái phiên đấu giá → nhãn tiếng Việt + tone. */
export function AuctionStatusPill({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) {
  switch (status) {
    case STATUS_AUCTIONS.HAPPENING:
      return <StatusPill label="Đang diễn ra" tone="success" className={className} />;
    case STATUS_AUCTIONS.INITIAL:
      return <StatusPill label="Chờ mở" tone="warning" className={className} />;
    case STATUS_AUCTIONS.ENDED:
      return <StatusPill label="Đã kết thúc" tone="neutral" className={className} />;
    case STATUS_AUCTIONS.CANCELLED:
      return <StatusPill label="Đã huỷ" tone="destructive" className={className} />;
    default:
      return <StatusPill label={status || "Không rõ"} tone="neutral" className={className} />;
  }
}

const USER_STATUS_TONE: Record<USER_STATUS, StatusTone> = {
  [USER_STATUS.ACTIVE]: "success",
  [USER_STATUS.INACTIVE]: "neutral",
  [USER_STATUS.SUSPENDED]: "warning",
  [USER_STATUS.BANNED]: "destructive",
  [USER_STATUS.DEACTIVATED]: "neutral",
};

/** Trạng thái tài khoản người dùng (`user.status` dạng enum chuỗi). */
export function UserStatusPill({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) {
  const known = (Object.values(USER_STATUS) as string[]).includes(status ?? "")
    ? (status as USER_STATUS)
    : undefined;

  if (!known) {
    return <StatusPill label={status || "Không rõ"} tone="neutral" className={className} />;
  }

  return (
    <StatusPill
      label={USER_STATUS_LABELS[known]}
      tone={USER_STATUS_TONE[known]}
      className={className}
    />
  );
}

/**
 * Khoá đăng nhập do hệ thống tự đặt sau nhiều lần sai mật khẩu — độc lập với
 * `status`, nên hiển thị như một nhãn riêng bên cạnh.
 */
export function AccountLockedPill({ className }: { className?: string }) {
  return <StatusPill label="Khoá đăng nhập" tone="destructive" className={className} />;
}

/** Trạng thái yêu cầu rút tiền */
export function WithdrawalStatusPill({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) {
  switch (status) {
    case "pending":
      return <StatusPill label="Chờ xử lý" tone="warning" className={className} />;
    case "processing":
      return <StatusPill label="Đang xử lý" tone="info" className={className} />;
    case "completed":
      return <StatusPill label="Hoàn tất" tone="success" className={className} />;
    case "rejected":
      return <StatusPill label="Đã từ chối" tone="destructive" className={className} />;
    case "cancelled":
      return <StatusPill label="Đã huỷ" tone="neutral" className={className} />;
    default:
      return <StatusPill label={status || "Không rõ"} tone="neutral" className={className} />;
  }
}

/** Trạng thái tiền ký quỹ Escrow của đơn hàng */
export function FundStatusPill({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) {
  switch (status) {
    case "held":
      return <StatusPill label="Đang tạm giữ" tone="warning" className={className} />;
    case "released":
      return <StatusPill label="Đã chuyển cho người bán" tone="success" className={className} />;
    case "refunded":
      return <StatusPill label="Đã hoàn tiền" tone="info" className={className} />;
    default:
      return <StatusPill label={status || "Không rõ"} tone="neutral" className={className} />;
  }
}

/** Trạng thái yêu cầu đăng phiên đấu giá */
export function AuctionRequestStatusPill({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) {
  switch (status) {
    case "pending":
      return <StatusPill label="Chờ duyệt" tone="warning" className={className} />;
    case "approved":
      return <StatusPill label="Đã duyệt" tone="success" className={className} />;
    case "rejected":
      return <StatusPill label="Bị từ chối" tone="destructive" className={className} />;
    case "cancelled":
      return <StatusPill label="Đã rút" tone="neutral" className={className} />;
    default:
      return <StatusPill label={status || "Không rõ"} tone="neutral" className={className} />;
  }
}

export type { StatusPillProps, StatusTone };
