"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import {
  useAdminEscrowReport,
  useReleaseAdminOrder,
  useRefundAdminOrder,
  type EscrowOrder,
  type OrderReleaseResultData,
  type OrderRefundResultData,
} from "@/services/admin-wallet";
import { formatCurrency, formatDateTime, getValidNumber } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState, Spinner } from "@/components/common/loading";
import AdminPanel from "./AdminPanel";
import StatTile from "./StatTile";
import { FundStatusPill } from "./StatusPill";

export default function AdminFinanceEscrow() {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminEscrowReport({ cursor, limit: 20 });

  // Mutations
  const releaseMutation = useReleaseAdminOrder();
  const refundMutation = useRefundAdminOrder();

  // Dialog states for confirming actions
  const [orderToRelease, setOrderToRelease] = useState<EscrowOrder | null>(null);
  const [orderToRefund, setOrderToRefund] = useState<EscrowOrder | null>(null);

  // Dialog states for displaying execution results
  const [releaseResult, setReleaseResult] =
    useState<OrderReleaseResultData | null>(null);
  const [refundResult, setRefundResult] =
    useState<OrderRefundResultData | null>(null);

  const handleNextPage = () => {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, cursor || ""]);
      setCursor(data.nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const prevCursor = cursorHistory[cursorHistory.length - 1];
      setCursorHistory((prev) => prev.slice(0, -1));
      setCursor(prevCursor || undefined);
    }
  };

  const confirmRelease = async () => {
    if (!orderToRelease?.id) return;
    try {
      const result = await releaseMutation.mutateAsync(orderToRelease.id);
      setOrderToRelease(null);
      setReleaseResult(result);
      toast.success(`Đã chuyển tiền thành công cho người bán đơn hàng #${orderToRelease.id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Không thể chuyển tiền cho người bán. Vui lòng thử lại.";
      toast.error(msg);
    }
  };

  const confirmRefund = async () => {
    if (!orderToRefund?.id) return;
    try {
      const result = await refundMutation.mutateAsync(orderToRefund.id);
      setOrderToRefund(null);
      setRefundResult(result);
      toast.success(
        `Đã hoàn tiền thành công cho đơn hàng #${orderToRefund.id}`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Không thể hoàn tiền đơn hàng. Vui lòng thử lại.";
      toast.error(msg);
    }
  };

  const totalEscrowNum = getValidNumber(data?.totalEscrow);
  const platformBalanceNum = getValidNumber(data?.platformWalletBalance);
  const isEscrowCovered = data?.isEscrowCovered ?? true;
  const orders = data?.orders ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* CẢNH BÁO NỔI BẬT NẾU SỐ DƯ VÍ SÀN THIẾU HỤT */}
      {!isEscrowCovered && (
        <div className="flex items-start gap-3.5 border-2 border-destructive bg-destructive/15 p-4 text-foreground">
          <ShieldAlert className="size-6 shrink-0 text-destructive mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold uppercase tracking-wide text-destructive">
              Cảnh báo: Số dư của sàn không đủ chi trả tiền tạm giữ
            </h4>
            <p className="text-xs text-foreground leading-relaxed">
              Số dư thực tế của sàn (
              <strong className="text-destructive font-mono">
                {formatCurrency(platformBalanceNum)}
              </strong>
              ) đang <strong>thấp hơn</strong> tổng số tiền tạm giữ của các
              đơn hàng (
              <strong className="font-mono">
                {formatCurrency(totalEscrowNum)}
              </strong>
              ). Hiện tại sàn không đủ tiền để chuyển cho người bán!
            </p>
          </div>
        </div>
      )}

      {/* Số liệu thống kê tiền tạm giữ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Tổng tiền tạm giữ"
          value={formatCurrency(totalEscrowNum)}
          icon={<DollarSign size={16} />}
        />
        <StatTile
          label="Đơn hàng đang giữ tiền"
          value={getValidNumber(data?.heldOrderCount).toLocaleString("vi-VN")}
          icon={<CreditCard size={16} />}
        />
        <StatTile
          label="Số dư của sàn"
          value={formatCurrency(platformBalanceNum)}
          icon={<PackageCheck size={16} />}
        />
        <StatTile
          label="Khả năng chi trả"
          value={isEscrowCovered ? "Đủ tiền chi trả" : "Thiếu tiền chi trả"}
          icon={
            isEscrowCovered ? (
              <ShieldCheck size={16} className="text-success" />
            ) : (
              <AlertTriangle size={16} className="text-destructive" />
            )
          }
          breakdown={[
            {
              label: "Tình trạng",
              value: isEscrowCovered ? "Đảm bảo 100%" : "Thiếu hụt",
              tone: isEscrowCovered ? "success" : "destructive",
            },
          ]}
        />
      </div>

      {/* Bảng danh sách đơn hàng đang giữ tiền */}
      <AdminPanel
        title="Danh sách đơn hàng đang giữ tiền"
        description="Ưu tiên đơn hàng đã giao thành công nhưng chưa chuyển tiền cho người bán"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="cursor-pointer rounded-none text-xs"
          >
            <RefreshCw
              size={14}
              className={`mr-1.5 ${isFetching ? "animate-spin" : ""}`}
            />
            Làm mới
          </Button>
        }
        flush
      >
        <LoadingState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={orders.length === 0}
          onRetry={refetch}
          emptyMessage="Hiện không có đơn hàng nào đang giữ tiền."
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Mã đơn</TableHead>
                <TableHead className="text-right">Tiền tạm giữ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Trạng thái giao hàng</TableHead>
                <TableHead>Người mua / Bán</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="pr-5 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const isDelivered = Boolean(order.delivered_at);
                const totalAmt = getValidNumber(order.total_amount);

                return (
                  <TableRow
                    key={order.id}
                    className={
                      isDelivered
                        ? "bg-warning/5 hover:bg-warning/10"
                        : "hover:bg-muted/40"
                    }
                  >
                    <TableCell className="pl-5 font-mono text-xs font-semibold">
                      #{order.id}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-foreground">
                      {formatCurrency(totalAmt)}
                    </TableCell>
                    <TableCell>
                      <FundStatusPill status={order.fund_status} />
                    </TableCell>
                    <TableCell>
                      {isDelivered ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 text-xs font-semibold text-warning">
                            <CheckCircle2 size={13} /> Đã giao hàng
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDateTime(order.delivered_at!)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Chưa giao hàng
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>Mua: #{order.buyer_id || "---"}</div>
                      <div>Bán: #{order.seller_id || "---"}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {order.created_at ? formatDateTime(order.created_at) : "---"}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setOrderToRelease(order)}
                          className="h-8 cursor-pointer rounded-none text-xs font-semibold bg-success text-success-foreground hover:bg-success/90"
                        >
                          <DollarSign size={13} className="mr-1" /> Chuyển tiền
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOrderToRefund(order)}
                          className="h-8 cursor-pointer rounded-none text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                        >
                          <Undo2 size={13} className="mr-1" /> Hoàn tiền
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Phân trang con trỏ (Cursor Pagination) */}
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>
              {orders.length > 0
                ? `Hiển thị ${orders.length} đơn hàng`
                : "Không có đơn hàng"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={cursorHistory.length === 0}
                onClick={handlePrevPage}
                className="h-8 cursor-pointer rounded-none text-xs"
              >
                <ChevronLeft size={14} className="mr-1" /> Trang trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data?.nextCursor}
                onClick={handleNextPage}
                className="h-8 cursor-pointer rounded-none text-xs"
              >
                Trang tiếp <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        </LoadingState>
      </AdminPanel>

      {/* ALERT DIALOG XÁC NHẬN CHUYỂN TIỀN CHO NGƯỜI BÁN */}
      <AlertDialog
        open={Boolean(orderToRelease)}
        onOpenChange={(open) => !open && setOrderToRelease(null)}
      >
        <AlertDialogContent className="rounded-none sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Xác nhận chuyển tiền đơn hàng #{orderToRelease?.id}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2">
              <p>
                Bạn đang thực hiện chuyển số tiền{" "}
                <strong className="text-foreground">
                  {formatCurrency(getValidNumber(orderToRelease?.total_amount))}
                </strong>{" "}
                cho người bán.
              </p>
              <p className="border border-border p-2.5 bg-muted/40 text-foreground text-[11px]">
                Hệ thống sẽ tự động trừ <strong>5% phí sàn</strong>, phần còn
                lại được cộng trực tiếp vào ví của người bán.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={releaseMutation.isPending}
              className="rounded-none text-xs"
            >
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRelease}
              disabled={releaseMutation.isPending}
              className="rounded-none text-xs font-semibold bg-success text-success-foreground hover:bg-success/90"
            >
              {releaseMutation.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="xs" tone="onColor" /> Đang chuyển tiền...
                </span>
              ) : (
                "Xác nhận chuyển tiền"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG XÁC NHẬN HOÀN TIỀN CHO NGƯỜI MUA */}
      <AlertDialog
        open={Boolean(orderToRefund)}
        onOpenChange={(open) => !open && setOrderToRefund(null)}
      >
        <AlertDialogContent className="rounded-none sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-destructive">
              Xác nhận hoàn tiền đơn hàng #{orderToRefund?.id}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2">
              <p>
                Bạn có chắc chắn muốn hoàn lại 100% số tiền{" "}
                <strong className="text-foreground">
                  {formatCurrency(getValidNumber(orderToRefund?.total_amount))}
                </strong>{" "}
                vào ví của người mua?
              </p>
              <p className="border border-destructive/30 p-2.5 bg-destructive/10 text-foreground text-[11px]">
                Lưu ý: Không thể hoàn tác sau khi đã xác nhận hoàn tiền.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={refundMutation.isPending}
              className="rounded-none text-xs"
            >
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRefund}
              disabled={refundMutation.isPending}
              className="rounded-none text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {refundMutation.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="xs" tone="onColor" /> Đang hoàn tiền...
                </span>
              ) : (
                "Xác nhận hoàn tiền"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG KẾT QUẢ CHUYỂN TIỀN */}
      <Dialog
        open={Boolean(releaseResult)}
        onOpenChange={(open) => !open && setReleaseResult(null)}
      >
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-success">
              <CheckCircle2 size={18} /> Chuyển tiền thành công
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Chi tiết kết quả chuyển tiền đơn hàng #{releaseResult?.orderId}
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border border border-border bg-card text-xs">
            <div className="flex justify-between p-3">
              <span className="text-muted-foreground">Tiền người bán thực nhận:</span>
              <span className="font-bold font-mono text-success text-sm">
                +{formatCurrency(getValidNumber(releaseResult?.sellerPayout))}
              </span>
            </div>
            <div className="flex justify-between p-3">
              <span className="text-muted-foreground">Phí sàn thu:</span>
              <span className="font-bold font-mono text-info">
                {formatCurrency(getValidNumber(releaseResult?.platformFee))}
              </span>
            </div>
            {releaseResult?.feeRate && (
              <div className="flex justify-between p-3">
                <span className="text-muted-foreground">Tỷ lệ phí sàn:</span>
                <span className="font-mono">
                  {(getValidNumber(releaseResult.feeRate) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            <div className="flex justify-between p-3">
              <span className="text-muted-foreground">Trạng thái:</span>
              <span className="font-semibold text-success">
                {releaseResult?.fundStatus === "released"
                  ? "Đã chuyển tiền"
                  : releaseResult?.fundStatus || "---"}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setReleaseResult(null)}
              className="rounded-none text-xs"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG KẾT QUẢ HOÀN TIỀN */}
      <Dialog
        open={Boolean(refundResult)}
        onOpenChange={(open) => !open && setRefundResult(null)}
      >
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-info">
              <CheckCircle2 size={18} /> Hoàn tiền thành công
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Chi tiết kết quả hoàn tiền đơn hàng #{refundResult?.orderId}
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border border border-border bg-card text-xs">
            <div className="flex justify-between p-3">
              <span className="text-muted-foreground">Tiền hoàn vào ví người mua:</span>
              <span className="font-bold font-mono text-info text-sm">
                +{formatCurrency(getValidNumber(refundResult?.totalAmount))}
              </span>
            </div>
            <div className="flex justify-between p-3">
              <span className="text-muted-foreground">Trạng thái thanh toán:</span>
              <span className="font-semibold text-info">
                {refundResult?.paymentStatus === "refunded"
                  ? "Đã hoàn tiền"
                  : refundResult?.paymentStatus === "completed"
                  ? "Đã thanh toán"
                  : refundResult?.paymentStatus || "---"}
              </span>
            </div>
            <div className="flex justify-between p-3">
              <span className="text-muted-foreground">Trạng thái:</span>
              <span className="font-semibold text-info">
                {refundResult?.fundStatus === "refunded"
                  ? "Đã hoàn tiền"
                  : refundResult?.fundStatus || "---"}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setRefundResult(null)}
              className="rounded-none text-xs"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
