"use client";

import { useState, useMemo, useEffect } from "react";
import { useProfile } from "@/services/user";
import { LoadingState, Skeleton } from "@/components/common/loading";
import { toast } from "sonner";
import OrdersList from "./components/OrdersList";
import PaymentWarningBanner from "./components/PaymentWarningBanner";
import PaymentSummaryBar from "./components/PaymentSummaryBar";
import OrderFilters from "./components/OrderFilters";
import PaymentModal from "@/components/payment/PaymentModal";
import { useWonAuctions } from "@/services/orders/orders.query";
import { getOrderAmount } from "@/services/orders/orders.service";
import { useWebSocketCore } from "@/hooks/useWebSocketCore";
import { WEBSOCKET_EVENTS } from "@/constants/app.enum";
import { useQueryClient } from "@tanstack/react-query";

export default function OrdersPage() {
  const { isLoading: profileLoading } = useProfile();
  const { socket } = useWebSocketCore();
  const queryClient = useQueryClient();
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid">("all");
  const [sortBy, setSortBy] = useState<"deadline" | "price" | "date">("deadline");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Fetch real orders from API
  const { data: ordersData, isLoading, isError, error, refetch } = useWonAuctions();
  const orders = useMemo(() => ordersData?.orders || [], [ordersData?.orders]);
  const apiSummary = ordersData?.summary;

  // Lắng nghe WebSocket Realtime: tự động làm mới danh sách khi có đơn được thanh toán hoặc hoàn tiền
  useEffect(() => {
    if (!socket) return;

    const handleOrderPaid = (payload: { orderId: string; amount?: number; status?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["won-auctions"] });

      setSelectedOrders((prev) => {
        if (!prev.has(payload.orderId)) return prev;
        const next = new Set(prev);
        next.delete(payload.orderId);
        return next;
      });
    };

    const handleOrderRefunded = () => {
      queryClient.invalidateQueries({ queryKey: ["won-auctions"] });
    };

    socket.on(WEBSOCKET_EVENTS.ORDER_PAID, handleOrderPaid);
    socket.on(WEBSOCKET_EVENTS.ORDER_REFUNDED, handleOrderRefunded);

    return () => {
      socket.off(WEBSOCKET_EVENTS.ORDER_PAID, handleOrderPaid);
      socket.off(WEBSOCKET_EVENTS.ORDER_REFUNDED, handleOrderRefunded);
    };
  }, [socket, queryClient]);

  // Show notifications for pending/overdue orders
  useEffect(() => {
    if (!ordersData || isLoading) return;

    const pendingCount = apiSummary?.pending || 0;
    const overdueCount = apiSummary?.overdue || 0;

    // Check if we've already shown notification in this session
    const notificationShown = sessionStorage.getItem("payment-notification-shown");

    if (!notificationShown && (pendingCount > 0 || overdueCount > 0)) {
      if (overdueCount > 0) {
        toast.error(`Bạn có ${overdueCount} đơn hàng quá hạn thanh toán!`, {
          description: "Tài khoản có thể bị khóa. Vui lòng thanh toán ngay!",
          duration: 10000,
        });
      } else if (pendingCount > 0) {
        // Check for urgent orders (less than 24 hours)
        const urgentOrders = orders.filter((order) => {
          if (order.paymentStatus !== "pending") return false;
          const deadline = new Date(order.paymentDeadline);
          const now = new Date();
          const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
          return hoursRemaining < 24;
        });

        if (urgentOrders.length > 0) {
          toast.warning(`Bạn có ${urgentOrders.length} đơn hàng sắp hết hạn thanh toán!`, {
            description: "Vui lòng thanh toán trong vòng 24 giờ tới.",
            duration: 8000,
          });
        } else {
          toast.info(`Bạn có ${pendingCount} đơn hàng chờ thanh toán`, {
            description: "Nhớ thanh toán đúng hạn để tránh bị khóa tài khoản.",
            duration: 6000,
          });
        }
      }

      // Mark notification as shown for this session
      sessionStorage.setItem("payment-notification-shown", "true");
    }
  }, [ordersData, isLoading, apiSummary, orders]);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    let filtered = [...orders];

    // Apply filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((order) => order.paymentStatus === filterStatus);
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "deadline":
          return (
            new Date(a.paymentDeadline).getTime() -
            new Date(b.paymentDeadline).getTime()
          );
        case "price":
          return getOrderAmount(b) - getOrderAmount(a);
        case "date":
          return (
            new Date(b.wonDate || b.createdAt || 0).getTime() -
            new Date(a.wonDate || a.createdAt || 0).getTime()
          );
        default:
          return 0;
      }
    });

    return filtered;
  }, [orders, filterStatus, sortBy]);

  // Calculate summary
  const summary = useMemo(() => {
    const pending = filteredOrders.filter((o) => o.paymentStatus === "pending");
    const selected = pending.filter((o) => selectedOrders.has(o.id));
    const totalAmount = selected.reduce(
      (sum, order) => sum + getOrderAmount(order),
      0
    );

    const nearestDeadline =
      pending.length > 0
        ? pending.reduce((nearest, order) => {
            const deadline = new Date(order.paymentDeadline);
            return deadline < nearest ? deadline : nearest;
          }, new Date(pending[0].paymentDeadline))
        : null;

    return {
      pendingCount: pending.length,
      selectedCount: selected.length,
      totalAmount,
      nearestDeadline,
      hasUrgent: pending.some((order) => {
        const deadline = new Date(order.paymentDeadline);
        const now = new Date();
        const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursRemaining < 24;
      }),
      overdue: apiSummary?.overdue || 0,
    };
  }, [filteredOrders, selectedOrders, apiSummary?.overdue]);

  // Handle selection
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const pendingOrders = filteredOrders
      .filter((o) => o.paymentStatus === "pending")
      .map((o) => o.id);

    if (selectedOrders.size === pendingOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(pendingOrders));
    }
  };

  // Handle payment
  const handlePayment = () => {
    if (selectedOrders.size === 0) {
      toast.error("Vui lòng chọn ít nhất một đơn hàng để thanh toán");
      return;
    }
    setIsPaymentModalOpen(true);
  };

  const handlePaidOrders = (paidIds: string[]) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      paidIds.forEach((id) => next.delete(id));
      return next;
    });
    queryClient.invalidateQueries({ queryKey: ["won-auctions"] });
  };

  return (
    <LoadingState
      isLoading={profileLoading || isLoading}
      isError={isError}
      error={error}
      onRetry={refetch}
      loadingFallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-16 w-full rounded-none" />
          <Skeleton className="h-12 w-full rounded-none" />
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-none" />
            ))}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pb-24">
        <header className="border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Đơn hàng của tôi</h1>
            {summary.pendingCount > 0 && (
              <span className="bg-destructive px-2 py-0.5 text-[11px] font-semibold tabular-nums text-destructive-foreground">
                {summary.pendingCount} chưa thanh toán
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-foreground-secondary">
            Các phiên bạn đã thắng. Chọn đơn để thanh toán bằng ví hoặc VietQR.
          </p>
        </header>

        {/* Warning Banner */}
        {summary.pendingCount > 0 && (
          <PaymentWarningBanner
            pendingCount={summary.pendingCount}
            nearestDeadline={summary.nearestDeadline}
            hasUrgent={summary.hasUrgent}
          />
        )}

        {/* Filters and Sort */}
        <OrderFilters
          filterStatus={filterStatus}
          onFilterChange={setFilterStatus}
          sortBy={sortBy}
          onSortChange={setSortBy}
          counts={{
            all: orders?.length || 0,
            pending: orders?.filter((o) => o.paymentStatus === "pending").length || 0,
            paid: orders?.filter((o) => o.paymentStatus === "paid").length || 0,
          }}
        />

        {/* Orders List */}
        <OrdersList
          orders={filteredOrders}
          selectedOrders={selectedOrders}
          onSelectOrder={handleSelectOrder}
          onSelectAll={handleSelectAll}
        />

        {/* Fixed Payment Summary Bar */}
        {summary.selectedCount > 0 && (
          <PaymentSummaryBar
            selectedCount={summary.selectedCount}
            totalAmount={summary.totalAmount}
            hasUrgent={summary.hasUrgent}
            onPayment={handlePayment}
          />
        )}

        {/* Payment Modal */}
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          selectedOrders={filteredOrders.filter((o) => selectedOrders.has(o.id))}
          onPaid={handlePaidOrders}
        />
      </div>
    </LoadingState>
  );
}