"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Wallet,
  QrCode,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/loading";
import { BankTransferDetails } from "./BankTransferDetails";
import { TopupDialog } from "@/components/wallet";
import { useWallet } from "@/services/wallet";
import {
  useOrderPaymentQr,
  useOrderStatus,
  usePayOrder,
} from "@/services/orders/orders.query";
import {
  getOrderAmount,
  getPayOrderError,
  fetchOrderStatus,
  toMoney,
  type OrderItem,
} from "@/services/orders/orders.service";
import { useWebSocketCore } from "@/hooks/useWebSocketCore";
import { useWalletTopupListener } from "@/hooks/useWalletTopupListener";
import { WEBSOCKET_EVENTS } from "@/constants/app.enum";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isAxiosError } from "axios";

export interface OrderPaymentPanelProps {
  orders: OrderItem[];
  onPaid: (paidOrderIds: string[]) => void;
  className?: string;
}

export function OrderPaymentPanel({
  orders,
  onPaid,
  className,
}: OrderPaymentPanelProps) {
  const [channel, setChannel] = useState<"wallet" | "qr">("wallet");
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [topupDefaultAmount, setTopupDefaultAmount] = useState(0);
  const [isPayingSequential, setIsPayingSequential] = useState(false);
  const [paidIdsState, setPaidIdsState] = useState<string[]>([]);
  const [underpaid, setUnderpaid] = useState<{ received: number } | null>(null);

  const completedRef = useRef(false);

  const complete = useCallback(
    (ids: string[]) => {
      if (completedRef.current) return;
      completedRef.current = true;
      toast.success(
        ids.length === 1
          ? "Thanh toán đơn hàng thành công!"
          : `Đã thanh toán thành công tất cả ${ids.length} đơn hàng!`
      );
      onPaid(ids);
    },
    [onPaid]
  );

  const isSingleOrder = orders.length === 1;
  const singleOrderId = isSingleOrder ? orders[0].id : null;

  // 1. Wallet Data & Status
  const { data: wallet, isLoading: isLoadingWallet, refetch: refetchWallet } = useWallet();
  const walletBalance = toMoney(wallet?.balance);
  const isWalletLocked = wallet?.status === "locked";

  // 2. Single Order Status (để lấy totalAmount chính xác từ BE nếu có)
  const { data: singleOrderStatus } = useOrderStatus(singleOrderId || "", {
    enabled: isSingleOrder,
  });

  // Lọc danh sách các đơn chưa được thanh toán trong panel instance này
  const unpaidOrders = useMemo(
    () => orders.filter((o) => !paidIdsState.includes(o.id)),
    [orders, paidIdsState]
  );

  // Tính tổng số tiền cần thanh toán trên các đơn chưa thanh toán
  const remainingTotal = useMemo(() => {
    if (isSingleOrder && singleOrderStatus?.totalAmount != null && paidIdsState.length === 0) {
      return toMoney(singleOrderStatus.totalAmount);
    }
    return unpaidOrders.reduce((sum, o) => sum + getOrderAmount(o), 0);
  }, [unpaidOrders, isSingleOrder, singleOrderStatus?.totalAmount, paidIdsState.length]);

  const shortfall = Math.max(0, remainingTotal - walletBalance);
  const isShortfall = shortfall > 0;

  // 3. QR Data cho đơn đơn lẻ
  const {
    data: qrData,
    isLoading: isLoadingQr,
    error: qrError,
    refetch: refetchQr,
  } = useOrderPaymentQr(singleOrderId || "", channel === "qr" && isSingleOrder);

  // 4. Polling trạng thái đơn hàng khi đang ở kênh QR (fallback mỗi 10s)
  const {
    data: polledOrderStatus,
    refetch: refetchOrderStatusManual,
    isFetching: isCheckingStatus,
  } = useOrderStatus(singleOrderId || "", {
    enabled: channel === "qr" && isSingleOrder,
    refetchInterval: channel === "qr" && isSingleOrder ? 10000 : false,
  });

  // Tự động chuyển về kênh ví nếu có nhiều hơn 1 đơn hàng
  useEffect(() => {
    if (!isSingleOrder && channel === "qr") {
      setChannel("wallet");
    }
  }, [isSingleOrder, channel]);

  // Kiểm tra nếu mã lỗi QR là 400 (đã thanh toán)
  const handleCheckAlreadyPaid = useCallback(async () => {
    if (!singleOrderId) return;
    try {
      const status = await fetchOrderStatus(singleOrderId);
      if (status?.isPaid || status?.paymentStatus === "paid") {
        complete([singleOrderId]);
      }
    } catch {
      // Bỏ qua lỗi
    }
  }, [singleOrderId, complete]);

  useEffect(() => {
    if (qrError && isAxiosError(qrError) && qrError.response?.status === 400) {
      handleCheckAlreadyPaid();
    }
  }, [qrError, handleCheckAlreadyPaid]);

  // Nếu polled status phát hiện đơn đã trả tiền
  useEffect(() => {
    if (
      channel === "qr" &&
      singleOrderId &&
      (polledOrderStatus?.isPaid || polledOrderStatus?.paymentStatus === "paid")
    ) {
      complete([singleOrderId]);
    }
  }, [channel, singleOrderId, polledOrderStatus, complete]);

  // 5. Socket: Realtime order:paid
  const { socket } = useWebSocketCore();
  useEffect(() => {
    if (!socket || !singleOrderId || channel !== "qr") return;

    socket.emit(WEBSOCKET_EVENTS.JOIN_ORDER, { orderId: singleOrderId });

    const handleOrderPaid = (payload: {
      orderId: string;
      amount?: number;
      status?: string;
    }) => {
      if (String(payload.orderId) === String(singleOrderId)) {
        complete([singleOrderId]);
      }
    };

    socket.on(WEBSOCKET_EVENTS.ORDER_PAID, handleOrderPaid);

    return () => {
      socket.emit(WEBSOCKET_EVENTS.LEAVE_ORDER, { orderId: singleOrderId });
      socket.off(WEBSOCKET_EVENTS.ORDER_PAID, handleOrderPaid);
    };
  }, [socket, singleOrderId, channel, complete]);

  // 6. Socket: Lắng nghe topup_success khi đang ở kênh thanh toán VietQR
  // Khi người dùng chuyển thiếu tiền qua QR, BE ghi nhận nạp ví qua wallet:topup_success
  useWalletTopupListener((payload) => {
    if (channel === "qr" && singleOrderId && !completedRef.current) {
      const rec = toMoney(payload.amount);
      setUnderpaid({ received: rec });
      refetchWallet();
    }
  });

  // 7. Thực hiện thanh toán bằng ví (tuần tự từng đơn)
  const payOrderMutation = usePayOrder();

  const handlePayWithWallet = async () => {
    if (isWalletLocked) {
      toast.error("Ví đang bị khoá. Vui lòng liên hệ hỗ trợ.");
      return;
    }

    if (isShortfall) {
      setTopupDefaultAmount(shortfall);
      setIsTopupOpen(true);
      return;
    }

    setIsPayingSequential(true);
    let currentPaid = [...paidIdsState];
    let hasError = false;

    for (const ord of orders) {
      if (currentPaid.includes(ord.id)) {
        continue;
      }

      try {
        await payOrderMutation.mutateAsync(ord.id);
        currentPaid = [...currentPaid, ord.id];
        setPaidIdsState(currentPaid);
      } catch (err) {
        hasError = true;
        const errorInfo = getPayOrderError(err);
        toast.error(`Thanh toán đơn #${ord.id} không thành công`, {
          description: errorInfo.message,
        });

        if (errorInfo.code === "INSUFFICIENT_BALANCE") {
          const freshWallet = await refetchWallet();
          const freshBalance = toMoney(freshWallet.data?.balance);
          const remainingUnpaid = orders.filter((o) => !currentPaid.includes(o.id));
          const remTotal = remainingUnpaid.reduce((sum, o) => sum + getOrderAmount(o), 0);
          setTopupDefaultAmount(Math.max(1, remTotal - freshBalance));
        }
        break;
      }
    }

    setIsPayingSequential(false);

    if (currentPaid.length === orders.length) {
      complete(orders.map((o) => o.id));
    } else if (hasError && currentPaid.length > 0) {
      toast.info(
        `Đã thanh toán ${currentPaid.length}/${orders.length} đơn. Đơn còn lại chưa được thanh toán.`
      );
    }
  };

  const handleManualCheckStatus = async () => {
    if (!singleOrderId || isCheckingStatus) return;
    try {
      const res = await refetchOrderStatusManual();
      if (res.data?.isPaid || res.data?.paymentStatus === "paid") {
        complete([singleOrderId]);
      } else {
        toast.info(
          "Hệ thống chưa nhận được thanh toán. Quý khách vui lòng chờ trong giây lát!"
        );
      }
    } catch {
      toast.error("Không thể kiểm tra trạng thái vào lúc này. Vui lòng thử lại!");
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Kênh thanh toán */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Phương thức thanh toán
          </h3>
          <span className="text-xs text-muted-foreground">
            {orders.length} đơn hàng
          </span>
        </div>

        <RadioGroup
          value={channel}
          onValueChange={(val) => setChannel(val as "wallet" | "qr")}
        >
          <div className="space-y-2">
            {/* Kênh 1: Ví Bidy */}
            <Label
              htmlFor="channel-wallet"
              className={cn(
                "flex items-start gap-3.5 p-3.5 border cursor-pointer transition-all duration-150 rounded-none",
                channel === "wallet"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-muted/40"
              )}
            >
              <RadioGroupItem
                value="wallet"
                id="channel-wallet"
                className="mt-0.5"
              />
              <div className="p-2 border border-border bg-background shrink-0">
                <Wallet className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      channel === "wallet" ? "text-primary" : "text-foreground"
                    )}
                  >
                    Ví Bidy
                  </span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/30 rounded-none">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trừ trực tiếp số dư ví, tiền giữ tại sàn (Escrow) đến khi nhận hàng
                </p>
              </div>
            </Label>

            {/* Kênh 2: Chuyển khoản VietQR */}
            <Label
              htmlFor="channel-qr"
              className={cn(
                "flex items-start gap-3.5 p-3.5 border transition-all duration-150 rounded-none",
                !isSingleOrder
                  ? "opacity-60 cursor-not-allowed border-border bg-card"
                  : channel === "qr"
                  ? "border-primary bg-primary/5 cursor-pointer"
                  : "border-border bg-card hover:bg-muted/40 cursor-pointer"
              )}
            >
              <RadioGroupItem
                value="qr"
                id="channel-qr"
                disabled={!isSingleOrder}
                className="mt-0.5"
              />
              <div className="p-2 border border-border bg-background shrink-0">
                <QrCode className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      channel === "qr" ? "text-primary" : "text-foreground"
                    )}
                  >
                    Chuyển khoản VietQR
                  </span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-muted text-muted-foreground border border-border rounded-none">
                    Tự động
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isSingleOrder
                    ? "Quét mã QR chuyển khoản trực tiếp qua ngân hàng"
                    : "Chuyển khoản VietQR chỉ hỗ trợ thanh toán từng đơn hàng riêng lẻ"}
                </p>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* CHI TIẾT KÊNH: VÍ BIDY */}
      {channel === "wallet" && (
        <div className="space-y-4 border border-border bg-card p-5">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Thông tin số dư ví Bidy
            </h4>
            {isLoadingWallet && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Spinner size="xs" /> Đang cập nhật...
              </span>
            )}
          </div>

          {/* Cảnh báo ví bị khoá */}
          {isWalletLocked && (
            <div className="border border-destructive bg-destructive/10 p-3.5 text-foreground flex items-start gap-2.5 text-xs">
              <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Ví đang bị khoá</p>
                <p className="text-muted-foreground mt-0.5">
                  Ví của bạn hiện đang bị tạm khoá giao dịch. Vui lòng liên hệ bộ phận hỗ trợ khách hàng để được mở lại.
                </p>
              </div>
            </div>
          )}

          {/* Danh sách đơn đã thanh toán thành công trong phiên này nếu có */}
          {paidIdsState.length > 0 && paidIdsState.length < orders.length && (
            <div className="border border-info/40 bg-info/10 p-3.5 space-y-2 text-xs text-foreground">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-4 text-info shrink-0" />
                <span>
                  Đã thanh toán ({paidIdsState.length}/{orders.length} đơn):
                </span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                {orders
                  .filter((o) => paidIdsState.includes(o.id))
                  .map((o) => (
                    <li key={o.id} className="truncate">
                      <span className="text-foreground font-medium">
                        {o.bidId?.name || `Đơn #${o.id}`}
                      </span>{" "}
                      ({getOrderAmount(o).toLocaleString("vi-VN")} đ) - Đã thanh toán
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Hộp số dư và tổng thanh toán */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-background border border-border">
              <span className="text-[11px] text-muted-foreground block">
                Số dư khả dụng:
              </span>
              <span className="text-base font-bold text-foreground">
                {walletBalance.toLocaleString("vi-VN")} đ
              </span>
            </div>

            <div className="p-3 bg-background border border-border">
              <span className="text-[11px] text-muted-foreground block">
                {paidIdsState.length > 0
                  ? `Còn lại cần thanh toán (${unpaidOrders.length}/${orders.length} đơn):`
                  : `Tổng tiền thanh toán (${orders.length} đơn):`}
              </span>
              <span className="text-base font-bold text-primary">
                {remainingTotal.toLocaleString("vi-VN")} đ
              </span>
            </div>
          </div>

          {/* Thông báo thiếu số dư */}
          {isShortfall && !isWalletLocked && (
            <div className="p-3.5 border border-warning/40 bg-warning/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    Số dư ví không đủ để thanh toán.
                  </span>
                  <p className="text-muted-foreground mt-0.5">
                    Cần thêm:{" "}
                    <span className="font-bold text-foreground">
                      {shortfall.toLocaleString("vi-VN")} đ
                    </span>
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setTopupDefaultAmount(shortfall);
                  setIsTopupOpen(true);
                }}
                className="rounded-none text-xs shrink-0 border-warning text-foreground hover:bg-warning/20 font-semibold"
              >
                <PlusCircle className="size-3.5" /> Nạp thêm
              </Button>
            </div>
          )}

          {/* Nút hành động */}
          <div className="pt-2">
            <Button
              type="button"
              disabled={isPayingSequential || isWalletLocked || unpaidOrders.length === 0}
              onClick={handlePayWithWallet}
              className="w-full rounded-none h-11 text-xs uppercase font-bold bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              {isPayingSequential ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" tone="onColor" />
                  Đang xử lý thanh toán ví...
                </span>
              ) : isShortfall ? (
                `Nạp thêm ${shortfall.toLocaleString("vi-VN")} đ & Thanh toán`
              ) : (
                `Thanh toán ${remainingTotal.toLocaleString("vi-VN")} đ bằng ví`
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
            <ShieldCheck className="size-3.5 text-primary shrink-0" />
            <span>
              Tiền thanh toán sẽ được giữ an toàn (Escrow) bởi Bidy cho đến khi bạn xác nhận đã nhận hàng thành công.
            </span>
          </div>
        </div>
      )}

      {/* CHI TIẾT KÊNH: CHUYỂN KHOẢN VIETQR */}
      {channel === "qr" && isSingleOrder && (
        <div className="space-y-4">
          {isLoadingQr ? (
            <div className="border border-border bg-card p-12 flex flex-col items-center justify-center space-y-3">
              <Spinner size="lg" />
              <p className="text-xs text-muted-foreground">
                Đang tạo mã VietQR thanh toán cho đơn hàng #{singleOrderId}...
              </p>
            </div>
          ) : qrError && (!isAxiosError(qrError) || qrError.response?.status !== 400) ? (
            <div className="border border-destructive/40 bg-destructive/10 p-6 text-center space-y-3">
              <AlertCircle className="size-6 text-destructive mx-auto" />
              <p className="text-xs text-muted-foreground">
                Không thể tạo mã VietQR cho đơn hàng này. Vui lòng thử lại hoặc chọn thanh toán bằng ví.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => refetchQr()}
                  className="rounded-none text-xs"
                >
                  Thử lại
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setChannel("wallet")}
                  className="rounded-none text-xs"
                >
                  Chuyển sang thanh toán ví
                </Button>
              </div>
            </div>
          ) : qrData ? (
            <div className="space-y-4">
              {/* Trường hợp nhận thiếu tiền qua QR */}
              {underpaid && (
                <div className="border border-warning bg-warning/10 p-4 space-y-3 text-xs text-foreground">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Đã nhận được một phần thanh toán vào ví:</p>
                      <p className="text-muted-foreground mt-1">
                        Hệ thống đã ghi nhận{" "}
                        <strong>{underpaid.received.toLocaleString("vi-VN")} đ</strong> vào ví nhưng còn thiếu{" "}
                        <strong>
                          {Math.max(0, remainingTotal - underpaid.received).toLocaleString("vi-VN")} đ
                        </strong>{" "}
                        để hoàn tất đơn hàng. Bạn có thể nạp thêm hoặc thanh toán bằng số dư ví.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setChannel("wallet")}
                      className="rounded-none text-xs"
                    >
                      Thanh toán bằng số dư ví
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTopupDefaultAmount(
                          Math.max(0, remainingTotal - underpaid.received)
                        );
                        setIsTopupOpen(true);
                      }}
                      className="rounded-none text-xs"
                    >
                      Nạp thêm tiền
                    </Button>
                  </div>
                </div>
              )}

              {/* Component hiển thị thông tin VietQR và Ngân hàng */}
              <BankTransferDetails
                qrCodeUrl={qrData.qrCodeUrl}
                bankInfo={qrData.bankInfo}
                amount={toMoney(qrData.amount) || remainingTotal}
                paymentCode={qrData.paymentCode || ""}
                amountNote={
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    * Nếu chuyển thừa, phần tiền dư sẽ được lưu giữ an toàn trong số dư ví Bidy của bạn.
                  </span>
                }
              />

              {/* Trạng thái kiểm tra thủ công & Socket */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-card border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="relative flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full size-2 bg-success"></span>
                  </span>
                  <span>Đang tự động nhận diện thanh toán realtime...</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleManualCheckStatus}
                  disabled={isCheckingStatus}
                  className="rounded-none text-xs font-semibold w-full sm:w-auto"
                >
                  {isCheckingStatus ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner size="xs" /> Đang kiểm tra...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="size-3.5" /> Kiểm tra trạng thái
                    </span>
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Topup Dialog khi cần nạp thêm */}
      <TopupDialog
        open={isTopupOpen}
        onOpenChange={setIsTopupOpen}
        defaultAmount={topupDefaultAmount}
        onCredited={() => {
          refetchWallet();
        }}
      />
    </div>
  );
}

export default OrderPaymentPanel;
