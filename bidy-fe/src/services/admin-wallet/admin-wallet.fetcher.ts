import axiosClient from "@/lib/axios-client";
import { API_ROUTES } from "@/constants";
import type { paths } from "@/types/openapi";
import type { WithdrawalRequest } from "@/services/wallet/wallet.fetcher";

export type AdminOverviewParams = {
  from?: string;
  to?: string;
};

export type AdminOverviewData = NonNullable<
  paths["/api/v1/admin/wallet/overview"]["get"]["responses"][200]["content"]["application/json"]["data"]
>;

export type DailySummaryItem = NonNullable<
  AdminOverviewData["dailySummaries"]
>[number];

export type EscrowReportParams = {
  cursor?: string;
  limit?: number;
};

export type EscrowReportData = NonNullable<
  paths["/api/v1/admin/wallet/escrow"]["get"]["responses"][200]["content"]["application/json"]["data"]
>;

export type EscrowOrder = NonNullable<EscrowReportData["orders"]>[number];

export type AdjustmentPayload = {
  walletId: string;
  amount: string | number;
  reason: string;
  bank_reference?: string;
};

export type AdjustmentResultData = NonNullable<
  paths["/api/v1/admin/wallet/adjustment"]["post"]["responses"][200]["content"]["application/json"]["data"]
>;

export type AdminWithdrawalsParams = {
  status?: string;
  overdue?: string;
  cursor?: string;
  limit?: number;
};

export type AdminWithdrawalListData = NonNullable<
  paths["/api/v1/admin/wallet/withdrawals"]["get"]["responses"][200]["content"]["application/json"]["data"]
>;

export type AdminWithdrawalItem = NonNullable<
  AdminWithdrawalListData["items"]
>[number];

export type CompleteWithdrawalPayload = {
  proof_file_id: string;
};

export type RejectWithdrawalPayload = {
  reject_reason?: string;
};

export type OrderReleaseResultData = NonNullable<
  paths["/api/v1/admin/orders/{id}/release"]["post"]["responses"][200]["content"]["application/json"]["data"]
>;

export type OrderRefundResultData = NonNullable<
  paths["/api/v1/admin/orders/{id}/refund"]["post"]["responses"][200]["content"]["application/json"]["data"]
>;

/**
 * Lấy báo cáo tổng quan tài chính cho admin
 */
export const fetchAdminWalletOverview = async (
  params?: AdminOverviewParams
): Promise<AdminOverviewData> => {
  const res = await axiosClient.get<{ data: AdminOverviewData }>(
    API_ROUTES.ADMIN_WALLET_OVERVIEW,
    { params }
  );
  return res.data.data;
};

/**
 * Lấy báo cáo số dư Escrow và danh sách các đơn hàng đang bị giữ tiền
 */
export const fetchAdminEscrowReport = async (
  params?: EscrowReportParams
): Promise<EscrowReportData> => {
  const res = await axiosClient.get<{ data: EscrowReportData }>(
    API_ROUTES.ADMIN_WALLET_ESCROW,
    { params }
  );
  return res.data.data;
};

/**
 * Điều chỉnh số dư thủ công (manual adjustment)
 */
export const createAdminAdjustment = async (
  payload: AdjustmentPayload
): Promise<AdjustmentResultData> => {
  const body = {
    walletId: payload.walletId,
    amount: payload.amount,
    reason: payload.reason,
    bank_reference: payload.bank_reference || "",
  };
  const res = await axiosClient.post<{ data: AdjustmentResultData }>(
    API_ROUTES.ADMIN_WALLET_ADJUSTMENT,
    body
  );
  return res.data.data;
};

/**
 * Lấy danh sách yêu cầu rút tiền của toàn bộ người dùng
 */
export const fetchAdminWithdrawals = async (
  params?: AdminWithdrawalsParams
): Promise<AdminWithdrawalListData> => {
  const res = await axiosClient.get<{ data: AdminWithdrawalListData }>(
    API_ROUTES.ADMIN_WALLET_WITHDRAWALS,
    { params }
  );
  return res.data.data;
};

/**
 * Chuyển trạng thái yêu cầu rút tiền sang processing
 */
export const processAdminWithdrawal = async (
  id: string
): Promise<WithdrawalRequest> => {
  const res = await axiosClient.patch<{ data: WithdrawalRequest }>(
    API_ROUTES.ADMIN_WALLET_WITHDRAWAL_PROCESS(id)
  );
  return res.data.data;
};

/**
 * Xác nhận hoàn tất yêu cầu rút tiền kèm biên lai chuyển khoản (proof_file_id)
 */
export const completeAdminWithdrawal = async (
  id: string,
  payload: CompleteWithdrawalPayload
): Promise<WithdrawalRequest> => {
  const body = {
    proof_file_id: payload.proof_file_id,
  };
  const res = await axiosClient.post<{ data: WithdrawalRequest }>(
    API_ROUTES.ADMIN_WALLET_WITHDRAWAL_COMPLETE(id),
    body
  );
  return res.data.data;
};

/**
 * Từ chối yêu cầu rút tiền và hoàn lại 100% số dư cho người dùng
 */
export const rejectAdminWithdrawal = async (
  id: string,
  payload?: RejectWithdrawalPayload
): Promise<WithdrawalRequest> => {
  const body = payload?.reject_reason
    ? {
        reject_reason: payload.reject_reason,
      }
    : {};
  const res = await axiosClient.post<{ data: WithdrawalRequest }>(
    API_ROUTES.ADMIN_WALLET_WITHDRAWAL_REJECT(id),
    body
  );
  return res.data.data;
};

/**
 * Giải ngân tiền Escrow của đơn hàng cho người bán
 */
export const releaseAdminOrder = async (
  orderId: string
): Promise<OrderReleaseResultData> => {
  const res = await axiosClient.post<{ data: OrderReleaseResultData }>(
    API_ROUTES.ADMIN_ORDER_RELEASE(orderId)
  );
  return res.data.data;
};

/**
 * Hoàn tiền Escrow của đơn hàng cho người mua
 */
export const refundAdminOrder = async (
  orderId: string
): Promise<OrderRefundResultData> => {
  const res = await axiosClient.post<{ data: OrderRefundResultData }>(
    API_ROUTES.ADMIN_ORDER_REFUND(orderId)
  );
  return res.data.data;
};
