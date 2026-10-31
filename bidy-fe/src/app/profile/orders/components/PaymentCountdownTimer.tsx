"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentCountdownProps {
  paymentDeadline: Date | string;
  className?: string;
  compact?: boolean;
  onExpired?: () => void;
  showIcon?: boolean;
}

export default function PaymentCountdownTimer({
  paymentDeadline,
  className = "",
  compact = false,
  onExpired,
  showIcon = true
}: PaymentCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [urgencyLevel, setUrgencyLevel] = useState<"safe" | "warning" | "urgent" | "critical">("safe");
  const [isExpired, setIsExpired] = useState(false);

  const calculateTimeRemaining = useCallback(() => {
    const now = new Date().getTime();
    const deadline = new Date(paymentDeadline).getTime();
    const diff = deadline - now;

    if (diff <= 0) {
      setIsExpired(true);
      onExpired?.();
      return "Đã quá hạn";
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Set urgency level
    if (days >= 2) {
      setUrgencyLevel("safe");
    } else if (days >= 1) {
      setUrgencyLevel("warning");
    } else if (hours >= 3) {
      setUrgencyLevel("urgent");
    } else {
      setUrgencyLevel("critical");
    }

    // Format time string
    if (compact) {
      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m ${seconds}s`;
    }

    if (days > 0) {
      return `${days} ngày ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [paymentDeadline, compact, onExpired]);

  useEffect(() => {
    const updateTimer = () => {
      setTimeRemaining(calculateTimeRemaining());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [calculateTimeRemaining]);

  /**
   * Mức khẩn tô bằng token trạng thái, không phải màu tuỳ chọn — đọc được ở cả
   * light lẫn dark mà không cần cặp `dark:`.
   */
  const getUrgencyStyles = () => {
    if (isExpired) {
      return { container: "border-border bg-muted text-muted-foreground", Icon: AlertCircle };
    }

    switch (urgencyLevel) {
      case "safe":
        return { container: "border-border bg-card text-foreground", Icon: Clock };
      case "warning":
        return {
          container: "border-warning/40 bg-warning/10 text-foreground",
          Icon: Clock
        };
      case "urgent":
        return {
          container: "border-warning bg-warning text-warning-foreground",
          Icon: AlertTriangle
        };
      case "critical":
        return {
          container: "border-destructive bg-destructive text-destructive-foreground",
          Icon: AlertTriangle
        };
    }
  };

  const styles = getUrgencyStyles();
  const Icon = styles.Icon;

  if (compact) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-1 text-sm font-medium tabular-nums",
        styles.container,
        className
      )}>
        {showIcon && <Icon className="size-3.5" aria-hidden />}
        {timeRemaining}
      </span>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 border px-3 py-2",
      styles.container,
      className
    )}>
      {showIcon && <Icon className="size-5 shrink-0" aria-hidden />}
      <div className="flex flex-col">
        <span className="text-xs opacity-80">Thời hạn thanh toán</span>
        <span className="font-mono text-base font-bold tabular-nums">
          {timeRemaining}
        </span>
      </div>
    </div>
  );
}