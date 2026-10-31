"use client";

import React, { useState } from "react";
import {
  useWallet,
  useWalletSummary,
  useWithdrawals,
} from "@/services/wallet";
import { useWalletTopupListener } from "@/hooks/useWalletTopupListener";
import { TopupDialog, WithdrawDialog } from "@/components/wallet";
import { WalletBalanceCard } from "./WalletBalanceCard";
import { WalletSummaryGrid } from "./WalletSummaryGrid";
import { WalletTransactionsTab } from "./WalletTransactionsTab";
import { WalletWithdrawalsTab } from "./WalletWithdrawalsTab";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatCurrency, getValidNumber } from "@/utils";
import { History, ArrowUpFromLine } from "lucide-react";

export function WalletView() {
  const [activeTab, setActiveTab] = useState<"transactions" | "withdrawals">(
    "transactions"
  );
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  const {
    data: wallet,
    isLoading: isWalletLoading,
    refetch: refetchWallet,
  } = useWallet();

  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useWalletSummary();

  const {
    data: withdrawalsData,
  } = useWithdrawals();

  // Kiểm tra xem có yêu cầu rút tiền nào đang mở (pending hoặc processing) không
  const openWithdrawal = withdrawalsData?.pages
    ?.flatMap((page) => page.items ?? [])
    ?.find((w) => w.status === "pending" || w.status === "processing");
  const hasOpenWithdrawal = Boolean(openWithdrawal);

  // Lắng nghe WebSocket topup realtime nếu user đang mở trang Ví
  useWalletTopupListener((payload) => {
    if (!isTopupOpen) {
      const creditedAmount = getValidNumber(payload.amount);
      toast.success(
        `Số dư ví vừa được cộng ${formatCurrency(creditedAmount)}`
      );
      refetchWallet();
      refetchSummary();
    }
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold text-foreground">Ví của tôi</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Quản lý số dư, nạp rút tiền và theo dõi biến động tài chính tài khoản
        </p>
      </header>

      {/* Balance Card */}
      <WalletBalanceCard
        wallet={wallet}
        isLoading={isWalletLoading}
        hasOpenWithdrawal={hasOpenWithdrawal}
        onOpenTopup={() => setIsTopupOpen(true)}
        onOpenWithdraw={() => setIsWithdrawOpen(true)}
      />

      {/* Summary Metrics */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Tổng quan biến động tài chính
        </h3>
        <WalletSummaryGrid
          summary={summary}
          isLoading={isSummaryLoading}
          openWithdrawalAmount={
            openWithdrawal ? getValidNumber(openWithdrawal.amount) : 0
          }
        />
      </div>

      {/* Main Tabs Navigation */}
      <div className="space-y-4 pt-2">
        <div
          role="tablist"
          aria-label="Quản lý giao dịch ví"
          className="-mb-px flex flex-wrap gap-1 border-b border-border"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "transactions"}
            onClick={() => setActiveTab("transactions")}
            className={cn(
              "flex items-center gap-2 cursor-pointer border-b-2 px-5 py-3 text-sm font-medium transition-colors",
              activeTab === "transactions"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-foreground-secondary hover:text-foreground"
            )}
          >
            <History className="size-4" />
            Lịch sử giao dịch
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "withdrawals"}
            onClick={() => setActiveTab("withdrawals")}
            className={cn(
              "flex items-center gap-2 cursor-pointer border-b-2 px-5 py-3 text-sm font-medium transition-colors",
              activeTab === "withdrawals"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-foreground-secondary hover:text-foreground"
            )}
          >
            <ArrowUpFromLine className="size-4" />
            Yêu cầu rút tiền
            {hasOpenWithdrawal && (
              <span className="size-2 rounded-full bg-warning inline-block" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "transactions" && <WalletTransactionsTab />}
        {activeTab === "withdrawals" && <WalletWithdrawalsTab />}
      </div>

      {/* Topup Dialog */}
      <TopupDialog
        open={isTopupOpen}
        onOpenChange={setIsTopupOpen}
        onCredited={() => {
          refetchWallet();
          refetchSummary();
        }}
      />

      {/* Withdraw Dialog */}
      <WithdrawDialog
        open={isWithdrawOpen}
        onOpenChange={setIsWithdrawOpen}
        balance={wallet?.balance || 0}
        onSuccess={() => {
          refetchWallet();
          refetchSummary();
          setActiveTab("withdrawals");
        }}
      />
    </div>
  );
}
