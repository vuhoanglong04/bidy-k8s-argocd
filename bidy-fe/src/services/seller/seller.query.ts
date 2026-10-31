import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { API_ROUTES } from "@/constants/routes.constants";
import {
  fetchSellerProfile,
  fetchSellerAuctions,
  type SellerAuctionsParams,
} from "./seller.fetcher";

/**
 * Hook truy vấn hồ sơ công khai của người bán.
 * Expose `isNotFound` để trang gọi `notFound()` đúng lúc.
 */
export const useSellerProfile = (sellerId: string) => {
  const query = useQuery({
    queryKey: [API_ROUTES.SELLER_PROFILE(sellerId)],
    queryFn: () => fetchSellerProfile(sellerId),
    enabled: !!sellerId,
    retry: false,
  });

  const isNotFound = isAxiosError(query.error) && query.error.response?.status === 404;

  return {
    seller: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isNotFound,
    refetch: query.refetch,
  };
};

/**
 * Hook truy vấn danh sách phiên đấu giá của người bán theo các điều kiện lọc và phân trang.
 */
export const useSellerAuctions = (
  sellerId: string,
  params: SellerAuctionsParams = {}
) => {
  const query = useQuery({
    queryKey: [API_ROUTES.SELLER_AUCTIONS(sellerId), params],
    queryFn: () => fetchSellerAuctions(sellerId, params),
    enabled: !!sellerId,
  });

  return {
    auctions: query.data?.items ?? [],
    pagination: query.data?.pagination ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};
