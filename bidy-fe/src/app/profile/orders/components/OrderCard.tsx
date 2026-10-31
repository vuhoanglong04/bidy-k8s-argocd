"use client";

import { Package } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PaymentCountdownTimer from "./PaymentCountdownTimer";
import { cn } from "@/lib/utils";
import { getOrderAmount, type OrderItem } from "@/services/orders/orders.service";

interface OrderCardProps {
  order: OrderItem;
  selected: boolean;
  onSelect: (orderId: string) => void;
  compact?: boolean;
}

export default function OrderCard({
  order,
  selected,
  onSelect,
  compact = false,
}: OrderCardProps) {
  const isSelectable = order.paymentStatus === "pending" && !order.isOverdue;
  const effectiveFundStatus = order.fundStatus;
  const paymentDeadline = order.paymentDeadline;

  const handleSelect = () => {
    if (isSelectable) {
      onSelect(order.id);
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("vi-VN") + "đ";
  };

  return (
    <article
      className={cn(
        "relative border transition-colors",
        selected
          ? "border-primary bg-accent-subtle"
          : "border-border bg-card",
        !isSelectable && "opacity-70",
        isSelectable && "cursor-pointer hover:bg-accent",
        compact ? "p-3" : "p-4"
      )}
      onClick={handleSelect}
    >
      <div className={cn("flex items-start", compact ? "gap-3" : "gap-4")}>
        {/* Selection Checkbox */}
        {isSelectable && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect(order.id)}
            disabled={!isSelectable}
            aria-label={`Chọn ${order.bidId?.name || "đơn hàng"}`}
            className="mt-1 size-5 shrink-0"
          />
        )}

        {/* Product Image Placeholder */}
        <div
          className={cn(
            "relative shrink-0 overflow-hidden border border-border bg-muted flex items-center justify-center",
            compact ? "size-16" : "size-24"
          )}
        >
          <Package className="size-6 text-muted-foreground" aria-hidden />
        </div>

        {/* Product Info */}
        <div className="min-w-0 flex-1">
          <h4
            className={cn(
              "truncate font-semibold text-foreground",
              compact ? "text-sm" : "text-base"
            )}
          >
            {order.bidId?.name || "Sản phẩm đấu giá"}
          </h4>

          <p
            className={cn(
              "mt-1 font-semibold tabular-nums text-foreground",
              compact ? "text-xs" : "text-sm"
            )}
          >
            {formatPrice(getOrderAmount(order))}
          </p>

          <p
            className={cn(
              "mt-0.5 text-foreground-secondary",
              compact ? "text-xs" : "text-sm"
            )}
          >
            Thắng ngày{" "}
            {order.wonDate || order.createdAt
              ? new Date(order.wonDate || order.createdAt).toLocaleDateString("vi-VN")
              : "chưa xác định"}
          </p>
        </div>

        {/* Countdown Timer */}
        {order.paymentStatus === "pending" && !order.isOverdue && paymentDeadline && (
          <div className="shrink-0">
            <PaymentCountdownTimer
              paymentDeadline={paymentDeadline}
              compact={compact}
              showIcon={true}
            />
          </div>
        )}

        {/* Status Badge for Paid/Overdue/Refunded */}
        {(order.paymentStatus !== "pending" || order.isOverdue) && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={cn(
                "px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                order.paymentStatus === "paid"
                  ? "bg-success text-success-foreground"
                  : order.paymentStatus === "refunded"
                  ? "bg-muted text-muted-foreground"
                  : "bg-destructive text-destructive-foreground"
              )}
            >
              {order.paymentStatus === "paid"
                ? "Đã thanh toán"
                : order.paymentStatus === "refunded"
                ? "Đã hoàn tiền"
                : "Quá hạn"}
            </span>
            {order.paymentStatus === "paid" && effectiveFundStatus && effectiveFundStatus !== "none" && (
              <span
                className={cn(
                  "px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                  effectiveFundStatus === "held"
                    ? "bg-info text-info-foreground"
                    : effectiveFundStatus === "released"
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {effectiveFundStatus === "held"
                  ? "Đang giữ tiền"
                  : effectiveFundStatus === "released"
                  ? "Đã giải ngân"
                  : "Đã hoàn tiền"}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
