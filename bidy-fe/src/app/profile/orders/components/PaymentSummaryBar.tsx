"use client";

import { cn } from "@/lib/utils";
import { CreditCard } from "lucide-react";

interface PaymentSummaryBarProps {
  selectedCount: number;
  totalAmount: number;
  hasUrgent: boolean;
  onPayment: () => void;
}

export default function PaymentSummaryBar({
  selectedCount,
  totalAmount,
  hasUrgent,
  onPayment
}: PaymentSummaryBarProps) {
  const formatPrice = (price: number) => {
    return price.toLocaleString('vi-VN') + 'đ';
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card">
      <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row">
        <div className="text-center sm:text-left">
          <p className="text-sm text-foreground-secondary">
            Đã chọn{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {selectedCount} sản phẩm
            </span>
          </p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {formatPrice(totalAmount)}
          </p>
        </div>

        <button
          type="button"
          onClick={onPayment}
          className={cn(
            "inline-flex h-11 items-center gap-2 px-6 text-sm font-semibold transition-colors",
            hasUrgent
              ? "bg-destructive text-destructive-foreground hover:opacity-90"
              : "bg-primary text-primary-foreground hover:bg-primary-hover"
          )}
        >
          <CreditCard size={18} aria-hidden />
          {hasUrgent
            ? "Thanh toán ngay — sắp hết hạn"
            : `Thanh toán ${selectedCount} sản phẩm`}
        </button>
      </div>
    </div>
  );
}