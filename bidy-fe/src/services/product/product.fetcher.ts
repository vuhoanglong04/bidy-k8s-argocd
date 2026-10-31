import { API_ROUTES } from "@/constants";
import { STATUS_AUCTIONS } from "@/constants/app.enum";
import axiosClient from "@/lib/axios-client";

// Get all products (featured products for home page)
export const fetchFeaturedProducts = async () => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_LIST, {
    params: { status: STATUS_AUCTIONS.HAPPENING },
  });
  return res.data;
};

// Get products by category
/**
 * Query params dùng chung cho GET /auctions và GET /auctions/category/{id} —
 * hai endpoint giờ nhận cùng bộ param và trả cùng envelope.
 *
 * Bỏ `sortBy` thì backend giữ default theo status: `ended` -> endDate DESC,
 * còn lại -> endDate ASC.
 */
export interface AuctionListParams {
  page?: number;
  limit?: number;
  status?: 'pending' | 'happening' | 'ended' | 'cancelled';
  sortBy?: 'endDate' | 'createdAt' | 'currentPrice' | 'bidderCount' | 'totalBids';
  sortOrder?: 'asc' | 'desc';
}

/**
 * `category` là **categoryId** (bigint dạng string), không phải slug.
 * Endpoint phủ toàn bộ cây con, nên truyền id của danh mục cha sẽ trả về cả
 * auction của các danh mục con.
 */
export const fetchProductsByCategory = async (category: string, params: AuctionListParams = {}) => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_BY_CATEGORY(category), { params });
  return res.data;
};

/**
 * Danh sách auction có phân trang. Bỏ `status` thì backend trả về mọi trạng
 * thái — khác `fetchProductsByStatus` vốn luôn ghim một trạng thái.
 */
export const fetchAuctions = async (params: AuctionListParams = {}) => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_LIST, { params });
  return res.data;
};

// Get products by status
export const fetchProductsByStatus = async (status: string, params: Omit<AuctionListParams, 'status'> = {}) => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_LIST, { params: { status, ...params } });
  return res.data;
};

// Get product by ID
export const fetchProductById = async (id: string) => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_BY_ID(id));
  return res.data;
};

export interface ProductSearchParams {
  limit?: number;
  status?: 'pending' | 'happening' | 'ended' | 'cancelled';
}

// Search products
export const fetchProductSearch = async (keyword: string, params?: ProductSearchParams) => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_SEARCH(keyword), { params });
  return res.data;
};

// Get categories
export const fetchProductCategories = async () => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_CATEGORIES);
  return res.data;
};

// Place a manual bid
export const fetchBid = async (id: string, amount: number) => {
  const res = await axiosClient.post(API_ROUTES.AUCTION_BID(id), { amount });
  return res.data;
};

// Buy now
export const fetchBuyNow = async (id: string) => {
  const res = await axiosClient.post(API_ROUTES.AUCTION_BUY_NOW(id));
  return res.data;
};

// NOTE: auto-bid đã chuyển sang `services/bid/autobid.fetcher.ts`.
// Hàm `fetchAutoBid` cũ đã xoá: nó tính giá khởi đầu ở client (race với người
// bid xen vào giữa GET và POST) và log nguyên payload response ra console —
// `GET /auctions/{id}` có mảng `bids[].user` chứa email/phone.