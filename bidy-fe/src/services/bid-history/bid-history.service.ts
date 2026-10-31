import { API_ROUTES } from '@/constants';
import axiosClient from '@/lib/axios-client';
import type { ApiPagination } from '@/services/auction.mapper';

/**
 * Chi tiết sản phẩm trong phiên đấu giá của dòng lịch sử.
 * Lưu ý: id là string bigint (PostgreSQL), không parseInt.
 * primaryImage là URL presigned có hạn 1 tiếng, không cache vào store.
 */
export interface BidHistoryProduct {
  id: string;
  ownerId?: string;
  categoryId?: string;
  name: string;
  slug?: string;
  description?: string;
  condition?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  /** Presigned URL (hết hạn 1 tiếng), null khi chưa có ảnh. Render trực tiếp, không cache vào store. */
  primaryImage?: string | null;
}

/**
 * Phiên đấu giá trong dòng lịch sử đấu giá.
 * id là string bigint (PostgreSQL), không parseInt.
 * Các trường giá trị tiền là number.
 */
export interface BidHistoryAuction {
  id: string;
  productId?: string;
  product?: BidHistoryProduct | null;
  startingPrice?: number;
  currentPrice?: number;
  buyNowPrice?: number | null;
  reservePrice?: number | null;
  bidIncrement?: number;
  quantity?: number;
  status?: string;
  bidderCount?: number;
  totalBids?: number;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Metadata bổ sung cho dòng lịch sử.
 * NULLABLE: chỉ có trên 'won' | 'lost' | 'auto_bid'; với 'place_bid' và 'buy_now' luôn null.
 * Đúng 3 key hợp lệ: total_bidders, auto_bid_config_id, limit_bid.
 */
export interface BidHistoryMetadata {
  total_bidders?: number;
  auto_bid_config_id?: string;
  limit_bid?: number;
}

/**
 * Một dòng lịch sử đấu giá của người dùng.
 * id, userId, auctionId là string bigint (PostgreSQL), không parseInt.
 * amount là number.
 * metadata nullable (chỉ có trên won, lost, auto_bid).
 */
export interface BidHistoryItem {
  id: string;
  auctionId: string;
  auction?: BidHistoryAuction | null;
  userId: string;
  amount: number;
  actionType: 'place_bid' | 'auto_bid' | 'won' | 'lost' | 'buy_now';
  position?: number | null;
  metadata?: BidHistoryMetadata | null;
  createdAt: string;
}

export interface BidHistoryStats {
  total: number;
  won: number;
  lost: number;
  active: number;
  buy_now: number;
  place_bid: number;
  auto_bid: number;
}

export type BidHistoryPagination = ApiPagination;

export interface GetUserBidHistoryParams {
  page?: number;
  limit?: number;
  actionType?: 'place_bid' | 'auto_bid' | 'won' | 'lost' | 'buy_now';
  auctionStatus?: 'pending' | 'happening' | 'ended' | 'cancelled';
  sortBy?: 'createdAt' | 'amount';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface BidHistoryData {
  history: BidHistoryItem[];
  stats: BidHistoryStats;
  pagination: BidHistoryPagination | null;
}

export interface BidHistoryResponse {
  status: string;
  message: string;
  data: BidHistoryData;
}

/**
 * Lấy lịch sử đấu giá của người dùng hiện tại (nằm sau middleware auth -> cần Bearer token).
 */
export const getUserBidHistory = async (
  params?: GetUserBidHistoryParams
): Promise<BidHistoryData> => {
  try {
    const response = await axiosClient.get<BidHistoryResponse>(
      API_ROUTES.AUCTION_USER_BID_HISTORY,
      { params }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching bid history:', error);
    // Return empty data instead of throwing
    return {
      history: [],
      stats: {
        total: 0,
        won: 0,
        lost: 0,
        active: 0,
        buy_now: 0,
        place_bid: 0,
        auto_bid: 0,
      },
      pagination: null,
    };
  }
};

/**
 * Lấy lịch sử đấu giá của phiên đấu giá (public, không cần auth).
 */
export const getAuctionBidHistory = async (auctionId: string): Promise<BidHistoryItem[]> => {
  try {
    const response = await axiosClient.get<{ data: { history: BidHistoryItem[] } }>(
      API_ROUTES.AUCTION_BID_HISTORY(auctionId)
    );
    return response.data.data.history;
  } catch (error) {
    console.error('Error fetching auction bid history:', error);
    return [];
  }
};