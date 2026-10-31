"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminWalletOverview,
  fetchAdminEscrowReport,
  fetchAdminWithdrawals,
  processAdminWithdrawal,
  completeAdminWithdrawal,
  rejectAdminWithdrawal,
  createAdminAdjustment,
  releaseAdminOrder,
  refundAdminOrder,
  type AdminOverviewParams,
  type EscrowReportParams,
  type AdminWithdrawalsParams,
  type AdjustmentPayload,
  type CompleteWithdrawalPayload,
  type RejectWithdrawalPayload,
} from "./admin-wallet.fetcher";

export const adminWalletKeys = {
  all: ["admin-wallet"] as const,
  overview: (params?: AdminOverviewParams) =>
    [...adminWalletKeys.all, "overview", params] as const,
  escrow: (params?: EscrowReportParams) =>
    [...adminWalletKeys.all, "escrow", params] as const,
  withdrawals: (params?: AdminWithdrawalsParams) =>
    [...adminWalletKeys.all, "withdrawals", params] as const,
};

/**
 * Hook truy vấn tổng quan tài chính cho admin
 */
export const useAdminWalletOverview = (params?: AdminOverviewParams) => {
  return useQuery({
    queryKey: adminWalletKeys.overview(params),
    queryFn: () => fetchAdminWalletOverview(params),
  });
};

/**
 * Hook truy vấn báo cáo số dư Escrow và đơn hàng đang giữ
 */
export const useAdminEscrowReport = (params?: EscrowReportParams) => {
  return useQuery({
    queryKey: adminWalletKeys.escrow(params),
    queryFn: () => fetchAdminEscrowReport(params),
  });
};

/**
 * Hook truy vấn danh sách yêu cầu rút tiền của người dùng
 */
export const useAdminWithdrawals = (params?: AdminWithdrawalsParams) => {
  return useQuery({
    queryKey: adminWalletKeys.withdrawals(params),
    queryFn: () => fetchAdminWithdrawals(params),
  });
};

/**
 * Hook chuyển trạng thái yêu cầu rút tiền sang processing
 */
export const useProcessAdminWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => processAdminWithdrawal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminWalletKeys.all });
    },
  });
};

/**
 * Hook xác nhận hoàn tất yêu cầu rút tiền kèm proof_file_id
 */
export const useCompleteAdminWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: CompleteWithdrawalPayload;
    }) => completeAdminWithdrawal(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminWalletKeys.all });
    },
  });
};

/**
 * Hook từ chối yêu cầu rút tiền và hoàn tiền
 */
export const useRejectAdminWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload?: RejectWithdrawalPayload;
    }) => rejectAdminWithdrawal(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminWalletKeys.all });
    },
  });
};

/**
 * Hook tạo điều chỉnh số dư ví thủ công
 */
export const useCreateAdminAdjustment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdjustmentPayload) => createAdminAdjustment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminWalletKeys.all });
    },
  });
};

/**
 * Hook giải ngân tiền Escrow cho người bán
 */
export const useReleaseAdminOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => releaseAdminOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminWalletKeys.all });
    },
  });
};

/**
 * Hook hoàn tiền Escrow cho người mua
 */
export const useRefundAdminOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => refundAdminOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminWalletKeys.all });
    },
  });
};
