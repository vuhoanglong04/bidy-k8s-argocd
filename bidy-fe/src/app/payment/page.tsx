"use client";

import React, { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Package,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { APP_ROUTES } from "@/constants/routes.constants";
import { useAuth } from "@/hooks";
import {
  useWonAuctions,
  useOrderStatus,
} from "@/services/orders/orders.query";
import {
  getOrderAmount,
  toMoney,
} from "@/services/orders/orders.service";
import { OrderPaymentPanel } from "@/components/payment/OrderPaymentPanel";
import { Spinner } from "@/components/common/loading";

function PaymentContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId") || "";
  const orderIdParam = searchParams.get("orderId") || "";
  const amountParam = searchParams.get("amount") || "";
  const nameParam = searchParams.get("name") || "";

  const { isAuthenticated } = useAuth();
  const [paymentCompletedLocal, setPaymentCompletedLocal] = useState(false);

  const {
    data: wonAuctionsData,
    isLoading: isLoadingWonAuctions,
    isError: isWonAuctionsError,
    error: wonAuctionsError,
    refetch: refetchWonAuctions,
  } = useWonAuctions({ enabled: isAuthenticated });

  // Dò tìm đơn hàng khớp với productId (auctionId / bidId.id) hoặc orderIdParam (id)
  const matchedOrder = useMemo(() => {
    const orders = wonAuctionsData?.orders || [];
    const targetOrder = String(orderIdParam || "");
    const targetProd = String(productId || "");

    if (!targetOrder && !targetProd) return null;

    return (
      orders.find((o) => {
        if (targetOrder && o.id === targetOrder) {
          return true;
        }
        if (
          targetProd &&
          (o.auctionId === targetProd ||
            o.bidId?.id === targetProd ||
            o.id === targetProd)
        ) {
          return true;
        }
        return false;
      }) ?? null
    );
  }, [wonAuctionsData?.orders, orderIdParam, productId]);

  const resolvedOrderId = matchedOrder?.id || orderIdParam || "";

  const {
    data: orderStatus,
    isLoading: isLoadingOrderStatus,
    isError: isOrderStatusError,
    error: orderStatusError,
    refetch: refetchOrderStatus,
  } = useOrderStatus(resolvedOrderId, {
    enabled: isAuthenticated && Boolean(resolvedOrderId),
  });

  const isPaymentCompleted = useMemo(() => {
    if (paymentCompletedLocal) return true;
    if (orderStatus?.isPaid || orderStatus?.paymentStatus === "paid") return true;
    if (matchedOrder?.paymentStatus === "paid") return true;
    return false;
  }, [paymentCompletedLocal, orderStatus, matchedOrder]);

  const effectiveOrderId = useMemo(() => {
    return matchedOrder?.id || orderIdParam || null;
  }, [matchedOrder, orderIdParam]);

  const effectiveAmount = useMemo(() => {
    if (matchedOrder) return getOrderAmount(matchedOrder);
    if (amountParam) return toMoney(amountParam);
    return 0;
  }, [matchedOrder, amountParam]);

  const effectiveProductName = useMemo(() => {
    return matchedOrder?.bidId?.name || nameParam || "Sản phẩm đấu giá Bidy";
  }, [matchedOrder, nameParam]);

  const isLoadingOrder =
    isLoadingWonAuctions || (Boolean(resolvedOrderId) && isLoadingOrderStatus);

  const isQueryError =
    isWonAuctionsError || (Boolean(resolvedOrderId) && isOrderStatusError);

  const handleRetry = () => {
    if (isWonAuctionsError) {
      refetchWonAuctions();
    }
    if (resolvedOrderId && isOrderStatusError) {
      refetchOrderStatus();
    }
  };

  const errorMessage = useMemo(() => {
    if (wonAuctionsError instanceof Error) return wonAuctionsError.message;
    if (orderStatusError instanceof Error) return orderStatusError.message;
    return "Đã có lỗi xảy ra khi tải dữ liệu đơn hàng. Vui lòng thử lại.";
  }, [wonAuctionsError, orderStatusError]);

  // Màn hình Thanh toán thành công (Xác nhận từ Socket / API)
  if (isPaymentCompleted) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md border border-border bg-card p-8 text-center space-y-6 rounded-none animate-in fade-in zoom-in-95 duration-200">
          <div className="size-16 bg-primary/10 text-primary mx-auto flex items-center justify-center rounded-none">
            <CheckCircle2 className="size-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Thanh toán thành công!
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Hệ thống đã ghi nhận thanh toán đơn hàng{" "}
              <span className="font-semibold text-foreground">
                {effectiveOrderId ? `#${effectiveOrderId}` : effectiveProductName}
              </span>
              . Tiền được lưu giữ an toàn tại sàn Bidy (Escrow) cho đến khi đơn hàng được giao và hoàn tất.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href={APP_ROUTES.PROFILE}
              className="inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-semibold py-2.5 px-4 hover:bg-primary-hover transition-colors rounded-none"
            >
              Xem đơn hàng của tôi <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation Breadcrumb & Back button */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <Link
              href={APP_ROUTES.HOME}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" /> Quay lại sàn đấu giá
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            <span>Thanh toán an toàn với cơ chế bảo vệ giao dịch (Escrow)</span>
          </div>
        </div>

        {/* Page Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-foreground">
            Thanh toán đơn hàng
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Thanh toán bằng số dư Ví Bidy hoặc chuyển khoản VietQR tự động.
          </p>
        </div>

        {/* Main 2-column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Payment Panel (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {isLoadingOrder ? (
              <div className="border border-border bg-card p-12 flex flex-col items-center justify-center space-y-3">
                <Spinner size="lg" />
                <p className="text-xs text-muted-foreground">
                  Đang tải thông tin đơn hàng...
                </p>
              </div>
            ) : isQueryError ? (
              <div className="border border-destructive/30 bg-card p-8 text-center space-y-4">
                <div className="size-12 bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
                  <AlertCircle className="size-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Không thể tải thông tin đơn hàng
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {errorMessage}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors rounded-none"
                  >
                    Thử lại
                  </button>
                </div>
              </div>
            ) : matchedOrder ? (
              <OrderPaymentPanel
                orders={[matchedOrder]}
                onPaid={() => setPaymentCompletedLocal(true)}
              />
            ) : (
              <div className="border border-border bg-card p-8 text-center space-y-4">
                <div className="size-12 bg-warning/10 text-warning mx-auto flex items-center justify-center">
                  <AlertCircle className="size-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Không tìm thấy đơn hàng cần thanh toán
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Đơn hàng có thể đã được thanh toán hoặc không thuộc về tài khoản của bạn.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href={APP_ROUTES.PROFILE}
                    className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors rounded-none"
                  >
                    Xem danh sách đơn hàng
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Order Summary & Product preview (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="border border-border bg-card p-6 space-y-6 sticky top-24 rounded-none">
              <div className="border-b border-border pb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground uppercase tracking-wide">
                  Tóm tắt đơn hàng
                </h3>
                {isLoadingOrder && <Spinner size="xs" />}
              </div>

              {/* Product preview */}
              <div className="flex gap-4 items-start pb-4 border-b border-border">
                <div className="size-16 bg-muted border border-border shrink-0 relative overflow-hidden flex items-center justify-center rounded-none">
                  <Package className="size-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                    {effectiveProductName}
                  </h4>
                  {effectiveOrderId && (
                    <span className="text-[11px] text-muted-foreground font-mono block mt-1">
                      Mã đơn: #{effectiveOrderId}
                    </span>
                  )}
                </div>
              </div>

              {/* Cost breakdown */}
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Giá trúng thầu:</span>
                  <span className="font-medium text-foreground">
                    {effectiveAmount.toLocaleString("vi-VN")} đ
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Phí dịch vụ sàn Bidy:</span>
                  <span className="font-semibold text-success">Miễn phí</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Phí vận chuyển:</span>
                  <span className="text-xs text-muted-foreground">Tính khi giao hàng</span>
                </div>
                <div className="border-t border-border pt-3 flex items-baseline justify-between">
                  <span className="text-base font-bold text-foreground uppercase">Tổng thanh toán:</span>
                  <span className="text-xl font-bold text-primary tracking-tight">
                    {effectiveAmount.toLocaleString("vi-VN")} đ
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  href={APP_ROUTES.PROFILE}
                  className="block w-full border border-border bg-background hover:bg-muted py-2.5 text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-none"
                >
                  Quay lại danh sách đơn hàng
                </Link>
              </div>

              {/* Security guarantee note */}
              <div className="pt-4 border-t border-border flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-4 text-primary shrink-0" />
                <span>Bảo vệ quyền lợi người mua 100% — tiền chỉ giải ngân khi nhận hàng thành công.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const PaymentLoading = () => (
  <main className="min-h-screen bg-background py-12 px-4">
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="h-8 bg-muted w-64 animate-pulse rounded-none"></div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="h-48 bg-muted animate-pulse rounded-none"></div>
          <div className="h-96 bg-muted animate-pulse rounded-none"></div>
        </div>
        <div className="lg:col-span-4 h-80 bg-muted animate-pulse rounded-none"></div>
      </div>
    </div>
  </main>
);

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentLoading />}>
      <PaymentContent />
    </Suspense>
  );
}
