import axiosClient from "@/lib/axios-client";
import { API_ROUTES } from "@/constants";
import { isAxiosError } from "axios";
import type { paths, components } from "@/types/openapi";

export type WalletData = NonNullable<
  paths["/api/v1/wallet"]["get"]["responses"][200]["content"]["application/json"]["data"]
>;

export type WalletTransactionsParams =
  paths["/api/v1/wallet/transactions"]["get"]["parameters"]["query"];

export type WalletTransactionsData = NonNullable<
  paths["/api/v1/wallet/transactions"]["get"]["responses"][200]["content"]["application/json"]["data"]
>;

export type WalletSummaryParams =
  paths["/api/v1/wallet/summary"]["get"]["parameters"]["query"];

export type WalletSummaryData = NonNullable<
  paths["/api/v1/wallet/summary"]["get"]["responses"][200]["content"]["application/json"]["data"]
>;

export type WalletTopupData = NonNullable<
  paths["/api/v1/wallet/topup"]["post"]["responses"][200]["content"]["application/json"]["data"]
>;

export type CreateWithdrawalPayload = {
  amount: string | number;
  bankAccountNo: string;
  bankAccountName: string;
  bankCode: string;
  bank_account_no?: string;
  bank_account_name?: string;
  bank_code?: string;
};

export type WithdrawalRequest = NonNullable<
  paths["/api/v1/wallet/withdrawals"]["post"]["responses"][201]["content"]["application/json"]["data"]
>;

export type WalletWithdrawalsParams =
  paths["/api/v1/wallet/withdrawals"]["get"]["parameters"]["query"];

export type WalletWithdrawalsData = NonNullable<
  paths["/api/v1/wallet/withdrawals"]["get"]["responses"][200]["content"]["application/json"]["data"]
>;

export type LedgerEntry = components["schemas"]["LedgerEntry"];

/**
 * Lấy thông tin ví của người dùng hiện tại
 */
export const fetchWallet = async (): Promise<WalletData> => {
  const res = await axiosClient.get<{ data: WalletData }>(API_ROUTES.WALLET);
  return res.data.data;
};

/**
 * Lấy lịch sử biến động số dư theo con trỏ (cursor pagination)
 */
export const fetchWalletTransactions = async (
  params?: WalletTransactionsParams
): Promise<WalletTransactionsData> => {
  const res = await axiosClient.get<{ data: WalletTransactionsData }>(
    API_ROUTES.WALLET_TRANSACTIONS,
    { params }
  );
  return res.data.data;
};

/**
 * Lấy báo cáo tổng hợp tài chính của ví
 */
export const fetchWalletSummary = async (
  params?: WalletSummaryParams
): Promise<WalletSummaryData> => {
  const res = await axiosClient.get<{ data: WalletSummaryData }>(
    API_ROUTES.WALLET_SUMMARY,
    { params }
  );
  return res.data.data;
};

/**
 * Tạo yêu cầu nạp tiền vào ví qua chuyển khoản VietQR
 */
export const createWalletTopup = async (
  amount: string | number
): Promise<WalletTopupData> => {
  const res = await axiosClient.post<{ data: WalletTopupData }>(
    API_ROUTES.WALLET_TOPUP,
    { amount }
  );
  return res.data.data;
};

/**
 * Lấy danh sách yêu cầu rút tiền theo con trỏ
 */
export const fetchWithdrawals = async (
  params?: WalletWithdrawalsParams
): Promise<WalletWithdrawalsData> => {
  const res = await axiosClient.get<{ data: WalletWithdrawalsData }>(
    API_ROUTES.WALLET_WITHDRAWALS,
    { params }
  );
  return res.data.data;
};

/**
 * Tạo yêu cầu rút tiền về tài khoản ngân hàng
 */
export const createWithdrawal = async (
  payload: CreateWithdrawalPayload
): Promise<WithdrawalRequest> => {
  const res = await axiosClient.post<{ data: WithdrawalRequest }>(
    API_ROUTES.WALLET_WITHDRAWALS,
    payload
  );
  return res.data.data;
};

/**
 * Huỷ yêu cầu rút tiền đang ở trạng thái pending
 */
export const cancelWithdrawal = async (
  id: string
): Promise<WithdrawalRequest> => {
  const res = await axiosClient.delete<{ data: WithdrawalRequest }>(
    API_ROUTES.WALLET_WITHDRAWAL_BY_ID(id)
  );
  return res.data.data;
};

/**
 * Chuyển đổi mã lỗi nạp tiền sang thông báo tiếng Việt
 */
export const getTopupErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 403) {
      return "Ví đang bị khoá, vui lòng liên hệ hỗ trợ.";
    }
    if (status === 429) {
      return "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.";
    }
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "Có lỗi xảy ra khi tạo yêu cầu nạp tiền.";
};

/**
 * Chuyển đổi mã lỗi rút tiền sang thông báo tiếng Việt
 */
export const getWithdrawalErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      if (message === "WITHDRAWAL_ALREADY_PENDING") {
        return "Bạn đang có một yêu cầu rút tiền đang chờ xử lý. Vui lòng đợi hoàn tất trước khi tạo yêu cầu mới.";
      }
      if (message === "INSUFFICIENT_BALANCE") {
        return "Số dư khả dụng không đủ để thực hiện yêu cầu rút tiền này.";
      }
      if (message === "WALLET_LOCKED") {
        return "Ví đang bị khoá, không thể thực hiện giao dịch rút tiền.";
      }
      return message;
    }
    if (status === 403) {
      return "Ví đang bị khoá hoặc bạn không có quyền thực hiện thao tác này.";
    }
    if (status === 429) {
      return "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.";
    }
  }
  return "Có lỗi xảy ra khi thực hiện yêu cầu rút tiền.";
};
