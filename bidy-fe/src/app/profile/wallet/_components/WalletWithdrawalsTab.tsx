"use client";

import React, { useState } from "react";
import {
  useWithdrawals,
  useCancelWithdrawal,
  getWithdrawalErrorMessage,
  type WithdrawalRequest,
} from "@/services/wallet";
import { WITHDRAWAL_STATUS_CONFIG } from "@/constants/wallet.constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmationDialog from "@/components/common/confirmation-dialog";
import { LoadingState, Skeleton, Spinner } from "@/components/common/loading";
import { WithdrawalProofDialog } from "@/components/wallet";
import { formatCurrency, formatDateTime, getValidNumber } from "@/utils";
import { toast } from "sonner";
import {
  Landmark,
  Clock,
  AlertTriangle,
  Eye,
  Calendar,
  Ban,
  CheckCircle2,
} from "lucide-react";

export function WalletWithdrawalsTab() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useWithdrawals();

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [viewingProof, setViewingProof] = useState<{
    proofFileId?: string | null;
    proofUrl?: string | null;
  } | null>(null);
  const { mutate: cancelWithdrawal } = useCancelWithdrawal();

  const withdrawals: WithdrawalRequest[] =
    data?.pages.flatMap((page) => page.items ?? []) ?? [];

  const handleCancel = (id?: string) => {
    if (!id) return;
    setCancellingId(id);
    cancelWithdrawal(id, {
      onSuccess: () => {
        toast.success("Đã huỷ yêu cầu rút tiền thành công. Số tiền đã được hoàn lại vào ví.");
        setCancellingId(null);
      },
      onError: (err) => {
        const msg = getWithdrawalErrorMessage(err);
        toast.error(msg);
        setCancellingId(null);
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h3 className="text-base font-bold text-foreground">
          Yêu cầu rút tiền
        </h3>
        <p className="text-xs text-foreground-secondary">
          Danh sách các yêu cầu rút tiền về tài khoản ngân hàng của bạn
        </p>
      </div>

      {/* Withdrawals List */}
      <LoadingState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={withdrawals.length === 0}
        onRetry={refetch}
        loadingFallback={<WithdrawalsSkeleton />}
        emptyMessage="Bạn chưa có yêu cầu rút tiền nào."
      >
        <div className="space-y-3">
          {withdrawals.map((item) => {
            const statusConfig = item.status
              ? WITHDRAWAL_STATUS_CONFIG[item.status]
              : undefined;
            const statusLabel = statusConfig?.label || item.status || "Chờ xử lý";
            const statusClass =
              statusConfig?.className || "border-border text-foreground";

            const isPending = item.status === "pending";
            const isProcessing = item.status === "processing";
            const isCompleted = item.status === "completed";
            const isRejected = item.status === "rejected";

            return (
              <div
                key={item.id}
                className="border border-border bg-card p-4 transition-colors hover:border-border/80 space-y-3"
              >
                {/* Top Row: Amount & Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center bg-primary/10 text-primary">
                      <Landmark className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs text-foreground-secondary">
                        Số tiền rút:
                      </span>
                      <p className="text-lg font-bold tabular-nums text-foreground">
                        {formatCurrency(getValidNumber(item.amount))}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusClass}>
                      {isCompleted && <CheckCircle2 className="mr-1 size-3" />}
                      {isPending && <Clock className="mr-1 size-3" />}
                      {isProcessing && <Spinner size="xs" tone="accent" className="mr-1" />}
                      {isRejected && <AlertTriangle className="mr-1 size-3" />}
                      {statusLabel}
                    </Badge>
                  </div>
                </div>

                {/* Bank Account Info & Timeline Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                  {/* Bank info */}
                  <div className="space-y-1 bg-muted/40 p-3 border border-border">
                    <p className="font-semibold text-foreground">
                      Thông tin thụ hưởng:
                    </p>
                    <p className="text-foreground-secondary">
                      Ngân hàng:{" "}
                      <span className="font-medium text-foreground">
                        {item.bankCode || "---"}
                      </span>
                    </p>
                    <p className="text-foreground-secondary">
                      Số tài khoản:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {item.bankAccountNo || "---"}
                      </span>
                    </p>
                    <p className="text-foreground-secondary">
                      Chủ tài khoản:{" "}
                      <span className="font-medium text-foreground">
                        {item.bankAccountName || "---"}
                      </span>
                    </p>
                  </div>

                  {/* Timeline info */}
                  <div className="space-y-1 bg-muted/40 p-3 border border-border">
                    <p className="font-semibold text-foreground">
                      Thời gian & Tiến độ:
                    </p>
                    <p className="flex items-center gap-1 text-foreground-secondary">
                      <Calendar className="size-3 text-muted-foreground" />
                      Ngày tạo:{" "}
                      <span className="text-foreground">
                        {item.createdAt
                          ? formatDateTime(item.createdAt)
                          : "---"}
                      </span>
                    </p>
                    {item.deadlineAt && (
                      <p className="flex items-center gap-1 text-foreground-secondary">
                        <Clock className="size-3 text-muted-foreground" />
                        Hạn SLA:{" "}
                        <span className="text-foreground">
                          {formatDateTime(item.deadlineAt)}
                        </span>
                      </p>
                    )}
                    {item.processedAt && (
                      <p className="flex items-center gap-1 text-foreground-secondary">
                        <CheckCircle2 className="size-3 text-success" />
                        Xử lý lúc:{" "}
                        <span className="text-foreground">
                          {formatDateTime(item.processedAt)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Reject reason alert if rejected */}
                {isRejected && item.rejectReason && (
                  <div className="flex items-start gap-2 border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Lý do từ chối:</p>
                      <p>{item.rejectReason}</p>
                    </div>
                  </div>
                )}

                {/* Proof URL if completed */}
                {isCompleted && (item.proofUrl || item.proofFileId) && (
                  <div className="flex items-center justify-between border border-success/20 bg-success/10 p-3 text-xs">
                    <span className="text-success font-medium">
                      Đã có chứng từ chuyển khoản ngân hàng
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setViewingProof({
                          proofFileId: item.proofFileId,
                          proofUrl: item.proofUrl,
                        })
                      }
                      className="inline-flex h-auto p-0 items-center gap-1 font-semibold text-primary hover:underline hover:bg-transparent text-xs"
                    >
                      <Eye className="size-3.5" />
                      Xem chứng từ
                    </Button>
                  </div>
                )}

                {/* Pending Cancel Action */}
                {isPending && item.id && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-foreground-secondary">
                      Bạn có thể huỷ yêu cầu khi đang ở trạng thái Chờ xử lý.
                    </span>
                    <ConfirmationDialog
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={cancellingId === item.id}
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-8"
                        >
                          <Ban className="mr-1.5 size-3.5" />
                          {cancellingId === item.id ? "Đang huỷ..." : "Huỷ yêu cầu"}
                        </Button>
                      }
                      title="Huỷ yêu cầu rút tiền?"
                      description={`Bạn có chắc chắn muốn huỷ yêu cầu rút ${formatCurrency(
                        getValidNumber(item.amount)
                      )}? Số tiền sẽ được hoàn lại 100% vào số dư ví của bạn ngay lập tức.`}
                      confirmText="Xác nhận huỷ"
                      cancelText="Đóng"
                      confirmButtonClassName="bg-destructive text-white hover:bg-destructive/90"
                      onConfirm={() => handleCancel(item.id)}
                    />
                  </div>
                )}
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
                "Tải thêm yêu cầu"
              )}
            </Button>
          </div>
        )}
      </LoadingState>

      {/* Proof Dialog */}
      <WithdrawalProofDialog
        open={Boolean(viewingProof)}
        onOpenChange={(open) => !open && setViewingProof(null)}
        proofFileId={viewingProof?.proofFileId}
        proofUrl={viewingProof?.proofUrl}
      />
    </div>
  );
}

function WithdrawalsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border border-border bg-card p-4 space-y-3">
          <div className="flex justify-between items-center pb-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
