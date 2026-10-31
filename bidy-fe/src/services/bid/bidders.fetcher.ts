import axiosClient from "@/lib/axios-client";
import { API_ROUTES } from "@/constants";
import type { components } from "@/types/openapi";

type BidderDTO = components["schemas"]["Bidder"];
type BidderStatsDTO = components["schemas"]["BidderStats"];

/** Một người đấu giá trong bảng xếp hạng của phiên. */
export interface AuctionBidder {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  bidCount: number;
  highestAmount: number;
  /** Backend sort sẵn từ 1 và gán TRƯỚC khi cap — không được sort lại ở client. */
  rank: number;
  latestBidTime?: string;
}

/** Người vừa đặt giá gần nhất. `null` ở snapshot lúc join room. */
export interface LastBid {
  userId: string;
  userName: string;
  amount: number;
  at?: string;
  /** true khi đây là proxy tự nâng giá, không phải user tự bấm. */
  isAuto: boolean;
}

export interface AuctionBidders {
  /** Tổng số người đã đặt giá — không bị cap. */
  totalBidders: number;
  /** Tổng số lượt bid (cả tay lẫn proxy) — không bị cap. */
  totalBids: number;
  /** Top người dẫn đầu, backend cap ở 20. */
  bidders: AuctionBidder[];
  /** true khi còn người ngoài danh sách đã cap. */
  truncated: boolean;
  /** Số người đang xem phiên. Đếm in-process nên chỉ đúng khi backend chạy 1 instance. */
  watcherCount: number;
  /** Chỉ có ở payload realtime — dùng để highlight hàng vừa đổi. */
  lastBid: LastBid | null;
  /** Số tiền hợp lệ nhỏ nhất kế tiếp tại thời điểm nhận payload. */
  minNextBid: number | null;
}

/**
 * Payload realtime `bidderUpdate` = BidderStats + phần bổ sung của socket.
 * Snapshot lúc join room cũng bắn event này (`currentBidderStats` đã bị bỏ).
 */
export interface BidderUpdatePayload extends BidderStatsDTO {
  type?: string;
  auctionId?: string;
  minNextBid?: number;
  /** Giá chốt hiện tại — number, không phải string decimal như `GET /auctions/{id}`. */
  currentPrice?: number;
  /**
   * Trạng thái phiên tại thời điểm bắn. Chỉ để đồng bộ khi hai nguồn về cùng
   * lúc — nguồn chính cho chuyển trạng thái vẫn là `auctionStatusUpdate`, vì
   * event đó bắn cả khi không ai bid (phiên hết giờ lúc vắng người).
   */
  status?: string;
  serverTime?: string;
  timestamp?: string;
  lastBid?: {
    userId?: string;
    userName?: string;
    amount?: number;
    at?: string;
    isAuto?: boolean;
  } | null;
}

const EMPTY: AuctionBidders = {
  totalBidders: 0,
  totalBids: 0,
  bidders: [],
  truncated: false,
  watcherCount: 0,
  lastBid: null,
  minNextBid: null,
};

function mapBidder(bidder: BidderDTO, index: number): AuctionBidder {
  return {
    userId: bidder.userId ?? String(index),
    userName: bidder.userName || "Người dùng ẩn danh",
    avatarUrl: bidder.avatarUrl ?? null,
    bidCount: bidder.bidCount ?? 0,
    highestAmount: bidder.highestAmount ?? 0,
    rank: bidder.rank ?? index + 1,
    latestBidTime: bidder.latestBidTime,
  };
}

/**
 * Chuẩn hoá payload bidders. Dùng chung cho REST snapshot và event socket —
 * backend cố ý trả về cùng một shape cho cả hai.
 */
export function mapAuctionBidders(
  raw: BidderUpdatePayload | null | undefined
): AuctionBidders {
  if (!raw) return EMPTY;

  return {
    totalBidders: raw.totalBidders ?? 0,
    totalBids: raw.totalBids ?? 0,
    bidders: (raw.uniqueBidders ?? []).map(mapBidder),
    truncated: raw.truncated ?? false,
    watcherCount: raw.watcherCount ?? 0,
    minNextBid: raw.minNextBid ?? null,
    lastBid: raw.lastBid
      ? {
          userId: raw.lastBid.userId ?? "",
          userName: raw.lastBid.userName || "Người dùng ẩn danh",
          amount: raw.lastBid.amount ?? 0,
          at: raw.lastBid.at,
          isAuto: raw.lastBid.isAuto ?? false,
        }
      : null,
  };
}

/** GET /auctions/{id}/bidders — snapshot danh sách người đấu giá. */
export const fetchAuctionBidders = async (id: string): Promise<AuctionBidders> => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_BIDDERS(id));
  return mapAuctionBidders(res.data?.data ?? res.data);
};
