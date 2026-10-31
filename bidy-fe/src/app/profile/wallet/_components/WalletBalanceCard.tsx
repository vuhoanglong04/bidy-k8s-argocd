"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/common/loading";
import { formatCurrency, getValidNumber } from "@/utils";
import type { WalletData } from "@/services/wallet";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, ShieldCheck, ShieldAlert } from "lucide-react";

interface WalletBalanceCardProps {
  wallet?: WalletData;
  isLoading: boolean;
  hasOpenWithdrawal?: boolean;
  onOpenTopup: () => void;
  onOpenWithdraw: () => void;
}

export function WalletBalanceCard({
  wallet,
  isLoading,
  hasOpenWithdrawal = false,
  onOpenTopup,
  onOpenWithdraw,
}: WalletBalanceCardProps) {
  const isLocked = wallet?.status === "locked";
  const numBalance = getValidNumber(wallet?.balance);
  const canWithdraw = !isLocked && numBalance > 0 && !hasOpenWithdrawal;

  return (
    <div className="border border-border bg-card p-6 shadow-xs">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        {/* Balance & Status */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-foreground-secondary">
                Số dư khả dụng
              </span>
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <Skeleton className="h-8 w-40" />
                ) : (
                  <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {formatCurrency(numBalance)}
                  </h2>
                )}

                {!isLoading && (
                  <Badge
                    variant="outline"
                    className={
                      isLocked
                        ? "border-destructive text-destructive bg-destructive/10"
                        : "border-success text-success bg-success/10"
                    }
                  >
                    {isLocked ? (
                      <>
                        <ShieldAlert className="mr-1 size-3" />
                        Bị khoá
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-1 size-3" />
                        Hoạt động
                      </>
                    )}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-foreground-secondary">
            Mã ví: <span className="font-mono text-foreground">{wallet?.id ? `#${wallet.id}` : "---"}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={onOpenTopup}
            disabled={isLocked || isLoading}
            className="bg-primary text-primary-foreground hover:bg-primary-hover font-semibold px-5"
          >
            <ArrowDownToLine className="mr-2 size-4" />
            Nạp tiền
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onOpenWithdraw}
            disabled={!canWithdraw || isLoading}
            className="font-semibold border-border hover:bg-secondary text-foreground"
          >
            <ArrowUpFromLine className="mr-2 size-4" />
            Rút tiền
          </Button>
        </div>
      </div>

      {/* Warnings / Notices */}
      {isLocked && (
        <div className="mt-4 border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          Ví của bạn đang ở trạng thái bị khoá. Mọi giao dịch nạp rút và thanh toán đều bị tạm dừng. Vui lòng liên hệ bộ phận hỗ trợ để biết thêm chi tiết.
        </div>
      )}

      {hasOpenWithdrawal && !isLocked && (
        <div className="mt-4 border border-warning/20 bg-warning/10 p-3 text-xs text-warning">
          Bạn đang có một yêu cầu rút tiền đang chờ xử lý. Theo quy định, mỗi người dùng chỉ có thể mở 1 yêu cầu rút tiền tại một thời điểm.
        </div>
      )}
    </div>
  );
}
