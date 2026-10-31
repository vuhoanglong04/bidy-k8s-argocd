import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchWallet,
  fetchWalletTransactions,
  fetchWalletSummary,
  createWalletTopup,
  fetchWithdrawals,
  createWithdrawal,
  cancelWithdrawal,
  type WalletData,
  type WalletTransactionsParams,
  type WalletTransactionsData,
  type WalletSummaryParams,
  type WalletSummaryData,
  type WalletTopupData,
  type WalletWithdrawalsParams,
  type WalletWithdrawalsData,
  type CreateWithdrawalPayload,
  type WithdrawalRequest,
} from "./wallet.fetcher";

export const walletKeys = {
  all: ["wallet"] as const,
  detail: () => ["wallet", "detail"] as const,
  transactions: (params?: WalletTransactionsParams) =>
    ["wallet", "transactions", params] as const,
  summary: (params?: WalletSummaryParams) =>
    ["wallet", "summary", params] as const,
  withdrawals: (params?: WalletWithdrawalsParams) =>
    ["wallet", "withdrawals", params] as const,
};

/**
 * Hook lấy thông tin chi tiết ví
 */
export const useWallet = (options?: { enabled?: boolean }) => {
  return useQuery<WalletData>({
    queryKey: walletKeys.detail(),
    queryFn: fetchWallet,
    staleTime: 30000,
    ...options,
  });
};

/**
 * Hook lấy lịch sử giao dịch ví với phân trang con trỏ (infinite query)
 */
export const useWalletTransactions = (
  params?: Omit<NonNullable<WalletTransactionsParams>, "cursor">,
  options?: { enabled?: boolean }
) => {
  return useInfiniteQuery<WalletTransactionsData>({
    queryKey: walletKeys.transactions(params),
    queryFn: ({ pageParam }) =>
      fetchWalletTransactions({
        ...params,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    ...options,
  });
};

/**
 * Hook lấy tổng hợp tài chính ví
 */
export const useWalletSummary = (
  params?: WalletSummaryParams,
  options?: { enabled?: boolean }
) => {
  return useQuery<WalletSummaryData>({
    queryKey: walletKeys.summary(params),
    queryFn: () => fetchWalletSummary(params),
    staleTime: 60000,
    ...options,
  });
};

/**
 * Hook lấy danh sách yêu cầu rút tiền với phân trang con trỏ (infinite query)
 */
export const useWithdrawals = (
  params?: Omit<NonNullable<WalletWithdrawalsParams>, "cursor">,
  options?: { enabled?: boolean }
) => {
  return useInfiniteQuery<WalletWithdrawalsData>({
    queryKey: walletKeys.withdrawals(params),
    queryFn: ({ pageParam }) =>
      fetchWithdrawals({
        ...params,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    ...options,
  });
};

/**
 * Mutation khởi tạo nạp tiền vào ví
 */
export const useCreateWalletTopup = () => {
  return useMutation<WalletTopupData, unknown, string | number>({
    mutationFn: (amount: string | number) => createWalletTopup(amount),
  });
};

/**
 * Mutation tạo yêu cầu rút tiền
 */
export const useCreateWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation<WithdrawalRequest, unknown, CreateWithdrawalPayload>({
    mutationFn: (payload: CreateWithdrawalPayload) => createWithdrawal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
};

/**
 * Mutation huỷ yêu cầu rút tiền pending
 */
export const useCancelWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation<WithdrawalRequest, unknown, string>({
    mutationFn: (id: string) => cancelWithdrawal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
};

