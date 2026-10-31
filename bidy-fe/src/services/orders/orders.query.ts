import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchWonAuctions,
  fetchOrderPaymentQr,
  fetchOrderStatus,
  payOrder,
  type OrderPaymentQrData,
  type OrderStatusData,
  type PayOrderData,
} from "./orders.service";

export const orderKeys = {
  wonAuctions: ["won-auctions"] as const,
  paymentQr: (id: string) => ["orders", "payment-qr", id] as const,
  status: (id: string) => ["orders", "status", id] as const,
};

/**
 * Hook to fetch won auctions (orders)
 * Optimized refetch interval to prevent rate limiting (429 errors)
 */
export const useWonAuctions = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: orderKeys.wonAuctions,
    queryFn: fetchWonAuctions,
    refetchInterval: 120000, // Refetch every 2 minutes (reduced from 30s to prevent rate limiting)
    staleTime: 60000, // Cache for 1 minute (increased from 10s)
    refetchOnWindowFocus: true, // Still refetch when user focuses window
    refetchOnReconnect: true, // Refetch when connection restored
    enabled: options?.enabled,
  });
};

/**
 * Hook lấy mã VietQR để thanh toán đơn hàng
 */
export const useOrderPaymentQr = (orderId: string, enabled = true) => {
  return useQuery<OrderPaymentQrData>({
    queryKey: orderKeys.paymentQr(orderId),
    queryFn: () => fetchOrderPaymentQr(orderId),
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(orderId) && enabled,
  });
};

/**
 * Hook lấy trạng thái thanh toán và vận chuyển của đơn hàng
 */
export const useOrderStatus = (
  orderId: string,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) => {
  return useQuery<OrderStatusData | null>({
    queryKey: orderKeys.status(orderId),
    queryFn: () => fetchOrderStatus(orderId),
    enabled: Boolean(orderId) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval,
  });
};

/**
 * Hook mutation thanh toán đơn hàng bằng số dư ví Bidy
 */
export const usePayOrder = () => {
  const queryClient = useQueryClient();

  return useMutation<PayOrderData, unknown, string>({
    mutationFn: (orderId: string) => payOrder(orderId),
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.wonAuctions });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: orderKeys.status(orderId) });
    },
  });
};