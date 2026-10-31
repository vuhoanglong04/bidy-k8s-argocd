import { API_ROUTES } from "@/constants/routes.constants";
import axiosClient from "@/lib/axios-client";
import {
  mapAuctionToFrontend,
  type ApiAuction,
  type ApiPagination,
  type MappedAuction,
} from "@/services/auction.mapper";

/**
 * Số lượng phiên đấu giá của người bán phân loại theo trạng thái.
 * `total = pending + happening + ended`, không bao gồm cancelled.
 */
export interface SellerAuctionCounts {
  pending: number;
  happening: number;
  ended: number;
  total: number;
}

/**
 * Hồ sơ công khai của người bán (GET /api/v1/sellers/{sellerId}).
 *
 * Chú ý:
 * - `avatarUrl` là presigned URL hết hạn sau 1 tiếng — render trực tiếp, KHÔNG cache vào store.
 * - KHÔNG có email, số điện thoại, địa chỉ, giới thiệu (about), rating — backend cố ý loại bỏ vì quyền riêng tư.
 */
export interface SellerProfile {
  id: string;
  username: string;
  fullname: string;
  avatarFileId: string | null;
  avatarUrl: string | null;
  createdAt: string;
  auctionCounts: SellerAuctionCounts;
}

/**
 * Tham số truy vấn danh sách phiên đấu giá của người bán.
 * Server hỗ trợ phân trang, lọc theo status và sắp xếp.
 */
export interface SellerAuctionsParams {
  page?: number;
  limit?: number;
  status?: "pending" | "happening" | "ended";
  sortBy?: "endDate" | "createdAt" | "currentPrice" | "bidderCount" | "totalBids";
  sortOrder?: "asc" | "desc";
}

export interface SellerAuctionsResponse {
  items: MappedAuction[];
  pagination: ApiPagination | null;
}

/**
 * Lấy thông tin hồ sơ công khai của người bán.
 * Trả về 404 nếu seller không tồn tại.
 */
export const fetchSellerProfile = async (sellerId: string): Promise<SellerProfile> => {
  const res = await axiosClient.get(API_ROUTES.SELLER_PROFILE(sellerId));
  return res.data.data;
};

/**
 * Lấy danh sách phiên đấu giá công khai của người bán có phân trang & lọc.
 * Tái sử dụng `mapAuctionToFrontend` từ auction.mapper.
 */
export const fetchSellerAuctions = async (
  sellerId: string,
  params: SellerAuctionsParams = {}
): Promise<SellerAuctionsResponse> => {
  const res = await axiosClient.get(API_ROUTES.SELLER_AUCTIONS(sellerId), { params });
  const rawItems: ApiAuction[] = res.data?.data?.items ?? [];
  const pagination: ApiPagination | null = res.data?.data?.pagination ?? null;

  return {
    items: rawItems.map(mapAuctionToFrontend),
    pagination,
  };
};
