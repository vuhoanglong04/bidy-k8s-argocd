"use client";

import React from "react";
import { Skeleton } from "@/components/common/loading";
import { formatCurrency, getValidNumber } from "@/utils";
import type { WalletSummaryData } from "@/services/wallet";
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  RotateCcw,
  Landmark,
} from "lucide-react";

interface WalletSummaryGridProps {
  summary?: WalletSummaryData;
  isLoading: boolean;
  /**
   * Số tiền của yêu cầu rút đang chờ/đang xử lý, BE chỉ cho tối đa 1
   */
  openWithdrawalAmount?: number;
}

export function WalletSummaryGrid({
  summary,
  isLoading,
  openWithdrawalAmount,
}: WalletSummaryGridProps) {
  const byType = summary?.byType || {};

  const topup = byType["topup_success"];
  const sales = byType["payment_release"];
  const payment = byType["payment"];
  const refund = byType["payment_refund"];
  const withdrawHold = byType["withdraw_hold"];
  const withdrawSuccess = byType["withdraw_success"];
  const withdrawFailed = byType["withdraw_failed"];
  const withdrawCancelled = byType["withdraw_cancelled"];

  const heldTotal = Math.abs(getValidNumber(withdrawHold?.totalAmount));
  const refundedTotal =
    getValidNumber(withdrawFailed?.totalAmount) +
    getValidNumber(withdrawCancelled?.totalAmount);
  const pendingAmount = getValidNumber(openWithdrawalAmount);
  const withdrawnAmount = Math.max(0, heldTotal - refundedTotal - pendingAmount);

  const cards = [
    {
      title: "Tổng nạp tiền",
      amount: getValidNumber(topup?.totalAmount),
      count: topup?.count || 0,
      icon: ArrowDownLeft,
      colorClass: "text-success",
      bgClass: "bg-success/10",
    },
    {
      title: "Doanh thu bán hàng",
      amount: getValidNumber(sales?.totalAmount),
      count: sales?.count || 0,
      icon: TrendingUp,
      colorClass: "text-success",
      bgClass: "bg-success/10",
    },
    {
      title: "Thanh toán mua hàng",
      amount: Math.abs(getValidNumber(payment?.totalAmount)),
      count: payment?.count || 0,
      icon: ArrowUpRight,
      colorClass: "text-destructive",
      bgClass: "bg-destructive/10",
    },
    {
      title: "Tiền hoàn lại",
      amount: getValidNumber(refund?.totalAmount),
      count: refund?.count || 0,
      icon: RotateCcw,
      colorClass: "text-info",
      bgClass: "bg-info/10",
    },
    {
      title: "Đã rút tiền",
      amount: withdrawnAmount,
      count: withdrawSuccess?.count || 0,
      icon: Landmark,
      colorClass: "text-warning",
      bgClass: "bg-warning/10",
      countLabel: `${withdrawSuccess?.count || 0} lần rút thành công`,
      note:
        pendingAmount > 0
          ? `Đang chờ duyệt: ${formatCurrency(pendingAmount)}`
          : undefined,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 border border-border bg-card p-4"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="flex flex-col justify-between border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground-secondary line-clamp-1">
                {card.title}
              </span>
              <div
                className={`flex size-7 shrink-0 items-center justify-center ${card.bgClass} ${card.colorClass}`}
              >
                <Icon className="size-3.5" />
              </div>
            </div>

            <div className="mt-3 space-y-0.5">
              <p className="text-base font-bold tabular-nums text-foreground sm:text-lg">
                {formatCurrency(card.amount)}
              </p>
              <p className="text-[11px] text-foreground-secondary">
                {card.countLabel ?? `${card.count} giao dịch`}
              </p>
              {card.note && (
                <p className="text-[11px] text-warning">{card.note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
