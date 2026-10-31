import axiosClient from "@/lib/axios-client";
import { API_ROUTES } from "@/constants";

/**
 * Trạng thái proxy bidding của CHÍNH user đang đăng nhập.
 * Không đọc từ `top_ownerships` — payload đó công khai và không chứa `limitBid`.
 */
export interface AutoBidStatus {
  isActive: boolean;
  /** Trần giá user đặt. Chỉ chính chủ đọc được. */
  limitBid: number;
  /** Giá mà proxy đang giữ giúp user. */
  currentAmount: number;
}

const INACTIVE: AutoBidStatus = { isActive: false, limitBid: 0, currentAmount: 0 };

interface RawAutoBidStatus {
  isActive?: boolean;
  limitBid?: number | string;
  currentAmount?: number | string;
}

function toNumber(value: number | string | undefined): number {
  const parsed = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(parsed) ? (parsed as number) : 0;
}

function mapAutoBidStatus(raw: RawAutoBidStatus | null | undefined): AutoBidStatus {
  if (!raw) return INACTIVE;

  return {
    isActive: raw.isActive ?? false,
    limitBid: toNumber(raw.limitBid),
    currentAmount: toNumber(raw.currentAmount),
  };
}

/** GET — trạng thái auto-bid hiện tại của user trên phiên này. */
export const fetchAutoBidStatus = async (id: string): Promise<AutoBidStatus> => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_AUTO_BID(id));
  return mapAutoBidStatus(res.data?.data ?? res.data);
};

/**
 * POST — bật auto-bid. Chỉ gửi trần giá.
 *
 * Cố ý KHÔNG tính giá khởi đầu ở client: đọc giá hiện tại rồi cộng bước tăng
 * là race condition (người khác bid xen vào giữa GET và POST). Bước tăng do
 * backend quy định theo từng phiên (`auction.bid_increment`).
 */
export const enableAutoBid = async (id: string, limitBid: number) => {
  const res = await axiosClient.post(API_ROUTES.AUCTION_AUTO_BID(id), { limitBid });
  return res.data;
};

/** DELETE — tắt auto-bid. */
export const disableAutoBid = async (id: string) => {
  const res = await axiosClient.delete(API_ROUTES.AUCTION_AUTO_BID(id));
  return res.data;
};
