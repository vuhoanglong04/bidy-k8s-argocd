import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { API_ROUTES } from "@/constants";
import { AdminAuctionsParams } from "@/types";
import { useAuth } from "@/hooks";
import {
  cancelAdminAuction,
  fetchAllAuctions,
  fetchStatisticAuctions,
  fetchStatisticUsers,
} from "./admin.fetcher";

export const adminAuctionKeys = {
  all: ["admin", "auctions"] as const,
  list: (params?: AdminAuctionsParams) =>
    [...adminAuctionKeys.all, "list", params ?? {}] as const,
};

export const useAdminAuctions = (params?: AdminAuctionsParams) => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.ADMIN_AUCTIONS, params],
    queryFn: () => fetchAllAuctions(params),
    enabled: isAuthenticated,
  });

  return {
    auctions: data?.data?.items ?? [],
    pagination: data?.data?.pagination ?? null,
    refetch,
    isLoading,
  };
};

export const useAdminStatisticAuctions = (year?: string) => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.ADMIN_STATISTICS_AUCTIONS, year],
    queryFn: () => fetchStatisticAuctions(year),
    enabled: isAuthenticated,
  });

  return {
    statisticsAuctions: data?.data ?? [],
    refetchStatsAuctions: refetch,
    isLoading,
  };
};

export const useAdminStatisticUsers = (year?: string) => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.ADMIN_STATISTICS_USERS, year],
    queryFn: () => fetchStatisticUsers(year),
    enabled: isAuthenticated,
  });

  return {
    statisticsUsers: data?.data ?? [],
    refetchStatsUsers: refetch,
    isLoading,
  };
};

interface ErrorResponseBody {
  error_code?: string;
  message?: string;
}

export const useCancelAdminAuction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelAdminAuction(id),
    onSuccess: () => {
      toast.success("Huỷ phiên đấu giá thành công!");
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.ADMIN_AUCTIONS] });
    },
    onError: (error: AxiosError<ErrorResponseBody> | Error) => {
      if (error instanceof AxiosError && error.response?.data) {
        const data = error.response.data;
        const errorCode = data.error_code;
        if (errorCode === "AUCTION_NOT_FOUND") {
          toast.error("Không tìm thấy phiên đấu giá.");
          return;
        }
        if (errorCode === "AUCTION_NOT_CANCELLABLE") {
          toast.error("Không thể huỷ phiên đấu giá đã kết thúc hoặc đã bị huỷ.");
          return;
        }
        if (data.message) {
          toast.error(data.message);
          return;
        }
      }
      toast.error("Huỷ phiên đấu giá thất bại. Vui lòng thử lại.");
    },
  });
};
