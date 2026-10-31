"use client";

import React, { useState } from "react";
import {
  useWalletTransactions,
  type LedgerEntry,
} from "@/services/wallet";
import {
  LEDGER_TYPES,
  LEDGER_TYPE_CONFIG,
} from "@/constants/wallet.constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LoadingState, Skeleton, Spinner } from "@/components/common/loading";
import { formatCurrency, formatDateTime, getValidNumber } from "@/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Clock,
  ReceiptText,
} from "lucide-react";

export function WalletTransactionsTab() {
  const [selectedType, setSelectedType] = useState<string>("all");

  const queryParams =
    selectedType === "all"
      ? undefined
      : { type: selectedType as LedgerEntry["type"] };

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useWalletTransactions(queryParams);

  const transactions: LedgerEntry[] =
    data?.pages.flatMap((page) => page.items ?? []) ?? [];

  return (
    <div className="space-y-4">
      {/* Header and Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Lịch sử giao dịch
          </h3>
          <p className="text-xs text-foreground-secondary">
            Biến động số dư và các giao dịch phát sinh trên tài khoản ví của bạn
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Select
            value={selectedType}
            onValueChange={(val) => setSelectedType(val)}
          >
            <SelectTrigger className="w-full bg-background border-border text-foreground">
              <SelectValue placeholder="Lọc loại giao dịch" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border max-h-72">
              {LEDGER_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Transaction List with LoadingState */}
      <LoadingState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={transactions.length === 0}
        onRetry={refetch}
        loadingFallback={<TransactionsSkeleton />}
        emptyMessage="Không tìm thấy lịch sử giao dịch nào phù hợp."
      >
        <div className="divide-y divide-border border border-border bg-card">
          {transactions.map((entry, index) => {
            const rawAmount = getValidNumber(entry.amount);
            const isPositive = rawAmount > 0;
            const isNegative = rawAmount < 0;

            const typeConfig = entry.type
              ? LEDGER_TYPE_CONFIG[entry.type]
              : undefined;
            const typeLabel = typeConfig?.label || entry.type || "Giao dịch";
            const description = typeConfig?.description;

            return (
              <div
                key={entry.id || entry.idempotencyKey || `tx-${index}`}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Left: Icon & Info */}
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex size-9 shrink-0 items-center justify-center ${
                      isPositive
                        ? "bg-success/10 text-success"
                        : isNegative
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isPositive ? (
                      <ArrowDownLeft className="size-4" />
                    ) : isNegative ? (
                      <ArrowUpRight className="size-4" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {typeLabel}
                      </span>
                      {entry.referenceType && (
                        <span className="text-[11px] font-mono text-foreground-secondary border border-border px-1.5 py-0.2 bg-muted/40">
                          {entry.referenceType}
                          {entry.referenceId ? ` #${entry.referenceId}` : ""}
                        </span>
                      )}
                    </div>

                    {description && (
                      <p className="text-xs text-foreground-secondary">
                        {description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-secondary">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {entry.createdAt
                          ? formatDateTime(entry.createdAt)
                          : "---"}
                      </span>
                      {entry.id && (
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <ReceiptText className="size-3" />
                          Mã GD: #{entry.id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Balance after */}
                <div className="flex flex-row items-baseline justify-between sm:flex-col sm:items-end gap-1">
                  <span
                    className={`text-base font-bold tabular-nums ${
                      isPositive
                        ? "text-success"
                        : isNegative
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {formatCurrency(rawAmount)}
                  </span>

                  {entry.balanceAfter !== undefined && entry.balanceAfter !== null && (
                    <span className="text-xs text-foreground-secondary tabular-nums">
                      Số dư sau GD:{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(getValidNumber(entry.balanceAfter))}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Load more button */}
        {hasNextPage && (
          <div className="pt-4 text-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full sm:w-auto min-w-40 border-border text-foreground hover:bg-secondary"
            >
              {isFetchingNextPage ? (
                <>
                  <Spinner size="xs" tone="primary" className="mr-2" />
                  Đang tải...
                </>
              ) : (
                "Tải thêm giao dịch"
              )}
            </Button>
          </div>
        )}
      </LoadingState>
    </div>
  );
}

function TransactionsSkeleton() {
  return (
    <div className="divide-y divide-border border border-border bg-card">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-9" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
