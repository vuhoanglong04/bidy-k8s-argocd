import { mapAuctionToFrontend } from "@/services/auction.mapper";
import { useProductsByCategory } from "@/services/product";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { handleErrorMessage } from "@/utils/error.utils";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchCategories,
  fetchMyAuctions,
  fetchAuctionCart,
  fetchAuctionByStatus,
  fetchAuctionById,
  fetchAuctionSearch,
  fetchAuctionEnd,
  buyNow,
  placeBid,
  deleteMyAuction,
  cancelAuction,
  updateProduct,
  fetchUserAuctionByStatus,
  fetchUserBuyAuction,
  fetchUserSellAuction,
} from "./bid.fetcher";
import { PlaceBidPayload } from "@/types";
import { API_ROUTES } from "@/constants";

export const useAuctionCategories = () => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_CATEGORIES],
    queryFn: fetchCategories,
  });

  return {
    categories: data?.data ?? null,
    refetchCategories: refetch,
    isLoading,
  };
};

export const useMyAuctions = () => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_MY],
    queryFn: fetchMyAuctions,
    enabled: isAuthenticated,
  });

  return {
    // Endpoint trả auction với product LỒNG BÊN TRONG (`product.name`,
    // `product.images[].imageUrl`, `startingPrice`…). Trước đây trả thẳng
    // payload thô ra card vốn đọc shape phẳng cũ, nên tên/ảnh/giá đều undefined.
    myAuctions: (data?.data?.auction ?? []).map(mapAuctionToFrontend),
    // Backend trả `totalAuctions` (số nhiều); đọc `totalAuction` luôn ra 0.
    totalAuctions: data?.data?.totalAuctions ?? 0,
    totalPages: data?.data?.totalPages ?? 0,
    currentPage: data?.data?.currentPage ?? 0,
    refetchMyAuctions: refetch,
    isLoading,
  };
};

export const useAuctionCart = () => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_CART],
    queryFn: fetchAuctionCart,
    enabled: isAuthenticated,
  });

  return {
    cart: data?.data ?? null,
    refetchCart: refetch,
    isLoading,
  };
};

export const useAuctionByStatus = (status: string) => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_LIST, status],
    queryFn: () => fetchAuctionByStatus(status),
    enabled: !!status,
  });

  return {
    auctions: data?.data?.items?.map(mapAuctionToFrontend) ?? null,
    refetchAuctions: refetch,
    isLoading,
  };
};
export const useUserAuctionByStatus = (id: string, status: string) => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_USER_BY_STATUS(id, status)],
    queryFn: () => fetchUserAuctionByStatus(id, status),
    enabled: !!id && !!status,
  });

  return {
    auctions: data?.data?.auction ?? null,
    refetchAuctions: refetch,
    isLoading,
  };
};
export const useUserBuyAuction = (id: string) => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_USER_BUY(id)],
    queryFn: () => fetchUserBuyAuction(id),
    enabled: !!id,
  });

  return {
    auctionsBuy: data?.data?.orders ?? null,
    refetchAuctions: refetch,
    isLoading,
  };
};
export const useUserSellAuction = (id: string) => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_USER_SELL(id)],
    queryFn: () => fetchUserSellAuction(id),
    enabled: !!id,
  });

  return {
    auctionsSell: data?.data?.auction ?? null,
    refetchAuctions: refetch,
    isLoading,
  };
};

/**
 * @deprecated Trùng với `useProductsByCategory` trong `@/services/product`.
 * Giữ lại làm alias để không phá call-site cũ; dùng hook kia cho code mới.
 */
export const useAuctionByCategory = (category: string) => {
  const { categoryProducts, pagination, refetchCategoryProducts, isLoading } =
    useProductsByCategory(category);

  return {
    products: categoryProducts,
    pagination,
    refetchProducts: refetchCategoryProducts,
    isLoading,
  };
};

export const useAuctionById = (id: string) => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_BY_ID, id],
    queryFn: () => fetchAuctionById(id),
    enabled: !!id,
  });

  return {
    product: data?.data ?? null,
    refetchProduct: refetch,
    isLoading,
  };
};

export const useAuctionSearch = (keyword: string) => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_SEARCH, keyword],
    queryFn: () => fetchAuctionSearch(keyword),
    enabled: !!keyword,
  });

  return {
    searchResults: data?.data ?? null,
    refetchSearch: refetch,
    isLoading,
  };
};

export const useAuctionEnd = () => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_LIST, 'ended'],
    queryFn: fetchAuctionEnd,
  });

  return {
    auctionEnd: data?.data?.items?.map(mapAuctionToFrontend) ?? null,
    refetchAuctionEnd: refetch,
    isLoading,
  };
};

export const useUpdateProduct = () =>
  useMutation({
    mutationFn: (payload: { id: string; formData: FormData }) =>
      updateProduct(payload.id, payload.formData),
    onError: (error) => handleErrorMessage(error),
    onSuccess: (data) =>
      toast.success(data?.messages ?? "Product updated successfully!"),
  });

export const useBuyNow = () =>
  useMutation({
    mutationFn: buyNow,
    onError: (error) => handleErrorMessage(error),
    onSuccess: () => toast.success("Bought successfully!"),
  });

export const usePlaceBid = () =>
  useMutation({
    mutationFn: ({ id, amount }: PlaceBidPayload) => placeBid(id, { amount }),
    onError: (error) => handleErrorMessage(error),
    onSuccess: () => toast.success("Đã đặt giá thành công!"),
  });

export const useDeleteMyAuction = () =>
  useMutation({
    mutationFn: deleteMyAuction,
    onError: (error) => handleErrorMessage(error),
    onSuccess: () => toast.success("Deleted successfully!"),
  });

const CANCEL_ERROR_MESSAGES: Record<string, string> = {
  AUCTION_HAS_BIDS: "Phiên đã có người đặt giá, không thể huỷ",
  AUCTION_NOT_CANCELLABLE: "Phiên đã kết thúc hoặc đã huỷ",
  AUCTION_NOT_FOUND: "Không tìm thấy phiên đấu giá",
};

export const useCancelAuction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelAuction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.AUCTION_MY] });
      toast.success("Huỷ phiên đấu giá thành công!");
    },
    onError: (error: Error) => {
      if (isAxiosError<{ error_code?: string; message?: string }>(error)) {
        const errorCode = error.response?.data?.error_code;
        if (errorCode && CANCEL_ERROR_MESSAGES[errorCode]) {
          toast.error(CANCEL_ERROR_MESSAGES[errorCode]);
          return;
        }
      }
      handleErrorMessage(error);
    },
  });
};
