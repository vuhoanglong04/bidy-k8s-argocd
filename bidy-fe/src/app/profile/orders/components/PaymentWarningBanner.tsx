"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentWarningBannerProps {
  pendingCount: number;
  nearestDeadline: Date | null;
  hasUrgent: boolean;
}

export default function PaymentWarningBanner({
  pendingCount,
  nearestDeadline,
  hasUrgent
}: PaymentWarningBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!nearestDeadline) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const deadline = new Date(nearestDeadline).getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeRemaining("Đã quá hạn");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeRemaining(`${days} ngày ${hours} giờ`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours} giờ ${minutes} phút`);
      } else {
        setTimeRemaining(`${minutes} phút`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [nearestDeadline]);

  if (dismissed) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start justify-between gap-3 border px-4 py-3",
        hasUrgent
          ? "border-destructive/40 bg-destructive/10"
          : "border-warning/40 bg-warning/10"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 shrink-0",
            hasUrgent ? "text-destructive" : "text-foreground-secondary"
          )}
        >
          {hasUrgent ? <AlertCircle size={20} /> : <Clock size={20} />}
        </span>
        <div>
          <p className="font-semibold text-foreground">
            Bạn có {pendingCount} đơn hàng chưa thanh toán
          </p>
          {nearestDeadline && (
            <p className="mt-0.5 text-sm text-foreground-secondary">
              Hạn gần nhất: {timeRemaining}
            </p>
          )}
          <p className="mt-1 text-xs text-foreground-secondary">
            Tài khoản có thể bị khoá nếu không thanh toán trong 3 ngày.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Đóng cảnh báo"
        className="shrink-0 p-1 text-foreground-secondary transition-colors hover:text-foreground"
      >
        <X size={18} />
      </button>
    </div>
  );
}