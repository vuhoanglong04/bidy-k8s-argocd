/**
 * Types cho module Quản lý Phiên đấu giá và Thống kê của Admin.
 *
 * LƯU Ý RÀNG BUỘC TỪ BACKEND:
 * - `id`, `product.id`, `category.id`, `seller.id` đều là string (bigint Postgres), KHÔNG parseInt hay so sánh === với number.
 * - Các trường giá đều là number (đã được Number() sẵn từ backend); `buyNowPrice` và `reservePrice` có thể là null.
 * - `product`, `category`, `seller` đều có thể là null (auction mồ côi khi product bị soft-delete). UI phải xử lý an toàn khi null.
 * - `primaryImage` là URL presigned hết hạn sau 1 tiếng (hoặc null khi chưa có ảnh). Render trực tiếp, KHÔNG cache vào store/redux.
 * - `seller` dùng trường `username` và `fullname` (chữ n thường).
 */

import type { STATUS_AUCTIONS } from "@/constants/app.enum";

export interface AdminAuctionProduct {
  /** ID sản phẩm (string bigint Postgres, không parseInt). */
  id: string;
  name: string;
  /** URL ảnh chính (presigned URL hết hạn sau 1 tiếng, không cache vào store/redux, null nếu chưa có ảnh). */
  primaryImage: string | null;
}

export interface AdminAuctionCategory {
  /** ID danh mục (string bigint Postgres, không parseInt). */
  id: string;
  name: string;
}

export interface AdminAuctionSeller {
  /** ID người bán (string bigint Postgres, không parseInt). */
  id: string;
  username: string;
  fullname: string;
  email: string;
}

export interface AdminAuction {
  /** ID phiên đấu giá (string bigint Postgres, không parseInt). */
  id: string;
  status: STATUS_AUCTIONS;
  startingPrice: number;
  currentPrice: number;
  buyNowPrice: number | null;
  reservePrice: number | null;
  bidIncrement: number;
  quantity: number;
  bidderCount: number;
  totalBids: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  /** Thông tin sản phẩm (nullable do auction mồ côi khi product bị soft-delete; primaryImage presigned 1 tiếng, không cache vào store/redux). */
  product: AdminAuctionProduct | null;
  /** Thông tin danh mục (nullable). */
  category: AdminAuctionCategory | null;
  /** Thông tin người bán (nullable). */
  seller: AdminAuctionSeller | null;
}

export interface AdminAuctionPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AdminAuctionListResponse {
  status: string;
  message: string;
  data: {
    items: AdminAuction[];
    pagination: AdminAuctionPagination;
  };
}

export interface AdminAuctionsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  categoryId?: string;
  sellerId?: string;
  sortBy?:
    | "createdAt"
    | "startDate"
    | "endDate"
    | "currentPrice"
    | "startingPrice"
    | "bidderCount"
    | "totalBids";
  sortOrder?: "asc" | "desc";
}

export interface AdminStatisticPoint {
  month: string;
  amount: number;
}

export interface AdminStatisticsResponse {
  status: string;
  message: string;
  data: AdminStatisticPoint[];
}
