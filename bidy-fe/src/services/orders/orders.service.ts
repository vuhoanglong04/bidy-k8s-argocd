import axiosClient from "@/lib/axios-client";
import { API_ROUTES } from "@/constants";
import { isAxiosError } from "axios";
import type { paths, components } from "@/types/openapi";

/** Khớp `paymentStatus` trong WonAuctionOrder của backend. */
export type OrderPaymentStatus =
  components["schemas"]["WonAuctionOrder"]["paymentStatus"];

export type OrderItem = components["schemas"]["WonAuctionOrder"];
export type OrdersSummary = components["schemas"]["WonAuctionsSummary"];
export type OrderFundStatus = OrderItem["fundStatus"];

type WonAuctionsResponse =
  paths["/api/v1/orders/won-auctions"]["get"]["responses"][200]["content"]["application/json"];

export const toMoney = (v: string | number | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? n : 0;
};

export type OrderAmountSource = Partial<
  Pick<OrderItem, "totalAmount" | "price" | "bidId">
>;

/**
 * Helper tính số tiền của đơn hàng
 */
export const getOrderAmount = (order: OrderAmountSource): number => {
  return (
    toMoney(order.totalAmount) ||
    toMoney(order.price) ||
    toMoney(order.bidId?.price) ||
    0
  );
};

/**
 * Fetch won auctions (orders) for the current user
 */
export const fetchWonAuctions = async (): Promise<{
  orders: OrderItem[];
  summary: OrdersSummary;
}> => {
  const response = await axiosClient.get<WonAuctionsResponse>(
    API_ROUTES.ORDER_WON_AUCTIONS
  );
  return response.data.data;
};

export type OrderPaymentQrData = NonNullable<
  paths["/api/v1/orders/{id}/payment-qr"]["get"]["responses"][200]["content"]["application/json"]["data"]
>;

/**
 * Generate VietQR payment info for an order from backend (SePay).
 * Ném lỗi để component/hook xử lý theo HTTP status code.
 */
export const fetchOrderPaymentQr = async (
  orderId: string
): Promise<OrderPaymentQrData> => {
  const response = await axiosClient.get<{ data: OrderPaymentQrData }>(
    API_ROUTES.ORDER_PAYMENT_QR(orderId)
  );
  return response.data.data;
};

export type OrderStatusData = NonNullable<
  paths["/api/v1/orders/{id}/status"]["get"]["responses"][200]["content"]["application/json"]["data"]
>;

/**
 * Get current payment/fulfillment status of an order
 */
export const fetchOrderStatus = async (
  orderId: string
): Promise<OrderStatusData | null> => {
  try {
    const response = await axiosClient.get<{ data: OrderStatusData }>(
      API_ROUTES.ORDER_STATUS(orderId)
    );
    return response.data.data;
  } catch (error) {
    console.warn("Could not fetch order status:", error);
    return null;
  }
};

export type PayOrderData = NonNullable<
  paths["/api/v1/orders/{id}/pay"]["post"]["responses"][200]["content"]["application/json"]["data"]
>;

/**
 * Thanh toán đơn hàng bằng số dư ví Bidy
 */
export const payOrder = async (orderId: string): Promise<PayOrderData> => {
  const response = await axiosClient.post<{ data: PayOrderData }>(
    API_ROUTES.ORDER_PAY(orderId)
  );
  return response.data.data;
};

export const ORDER_PAY_ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_BALANCE: "Số dư ví không đủ để thanh toán đơn này.",
  ORDER_NOT_PAYABLE: "Đơn hàng không ở trạng thái chờ thanh toán.",
  ORDER_PAYMENT_DEADLINE_EXPIRED: "Đã quá hạn thanh toán đơn hàng.",
  FORBIDDEN: "Bạn không phải người mua của đơn này.",
  ORDER_NOT_FOUND: "Không tìm thấy đơn hàng.",
};

/**
 * Phân tích lỗi trả về từ API thanh toán đơn hàng bằng ví
 */
export const getPayOrderError = (
  error: unknown
): { code: string | null; message: string } => {
  if (isAxiosError(error)) {
    const respData = error.response?.data as
      | { message?: string; status?: string }
      | undefined;
    const rawMsg =
      typeof respData?.message === "string" ? respData.message : null;
    const status = error.response?.status;

    let code: string | null = null;
    if (rawMsg && ORDER_PAY_ERROR_MESSAGES[rawMsg]) {
      code = rawMsg;
    } else if (status === 403) {
      code = "FORBIDDEN";
    } else if (status === 404) {
      code = "ORDER_NOT_FOUND";
    } else if (rawMsg) {
      code = rawMsg;
    }

    const message =
      (code && ORDER_PAY_ERROR_MESSAGES[code]) ||
      rawMsg ||
      "Có lỗi xảy ra khi thanh toán đơn hàng.";

    return { code, message };
  }

  return {
    code: null,
    message: "Có lỗi xảy ra khi thanh toán đơn hàng.",
  };
};