import {
  ArrowDownCircle,
  ArrowDownLeft,
  ArrowUpFromLine,
  Bell,
  Clock,
  CreditCard,
  Ban,
  Lock,
  PlayCircle,
  TrendingUp,
  Trophy,
  Unlock,
  UserX,
  Wallet,
  Wrench,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

import type { NotificationType } from "@/constants";
import { cn } from "@/lib/utils";

/**
 * Icon chọn theo `type`, KHÔNG theo `priority`: `auction_ending_soon` mang 2
 * priority khác nhau tuỳ người nhận (chủ phiên `normal`, người đã bid `high`),
 * nên priority không phải khoá ổn định để chọn hình.
 */
const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  auction_started: PlayCircle,
  auction_ending_soon: Clock,
  auction_won: Trophy,
  auction_lost: XCircle,
  new_bid: TrendingUp,
  bid_outbid: ArrowDownCircle,
  payment_reminder: CreditCard,
  account_locked: Lock,
  account_unlocked: Unlock,
  account_suspended: UserX,
  account_banned: Ban,
  system_maintenance: Wrench,
  // 6 types mới
  payment_released: Wallet,
  withdrawal_completed: ArrowUpFromLine,
  withdrawal_rejected: XCircle,
  topup_success: ArrowDownLeft,
  withdrawal_sla_overdue: AlertTriangle,
  wallet_reconciliation_failed: ShieldAlert,
  // Luồng duyệt phiên
  auction_request_approved: CheckCircle2,
  auction_request_rejected: XCircle,
};

/**
 * Tone theo ý nghĩa của type, dùng token trạng thái thay vì màu Tailwind trần.
 * Type lạ (BE thêm mới mà FE chưa cập nhật) rơi về Bell + muted, không vỡ.
 */
const TYPE_TONES: Record<NotificationType, string> = {
  auction_started: "text-info",
  auction_ending_soon: "text-warning",
  auction_won: "text-success",
  auction_lost: "text-muted-foreground",
  new_bid: "text-info",
  bid_outbid: "text-destructive",
  payment_reminder: "text-warning",
  account_locked: "text-warning",
  account_unlocked: "text-success",
  account_suspended: "text-destructive",
  account_banned: "text-destructive",
  system_maintenance: "text-muted-foreground",
  // 6 types mới
  payment_released: "text-success",
  withdrawal_completed: "text-success",
  withdrawal_rejected: "text-destructive",
  topup_success: "text-success",
  withdrawal_sla_overdue: "text-destructive",
  wallet_reconciliation_failed: "text-destructive",
  // Luồng duyệt phiên
  auction_request_approved: "text-success",
  auction_request_rejected: "text-destructive",
};

export interface NotificationIconProps {
  /** Nhận `string` chứ không chỉ `NotificationType`: panel admin dùng thang
   *  type riêng của support-chat, và BE có thể thêm type trước khi FE kịp. */
  type: string;
  className?: string;
}

export function NotificationIcon({ type, className }: NotificationIconProps) {
  const Icon = TYPE_ICONS[type as NotificationType] ?? Bell;
  const tone = TYPE_TONES[type as NotificationType] ?? "text-muted-foreground";

  return <Icon className={cn("size-4 shrink-0", tone, className)} aria-hidden />;
}
