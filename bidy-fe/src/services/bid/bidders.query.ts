import { useQuery } from "@tanstack/react-query";
import { API_ROUTES } from "@/constants";
import { STATUS_AUCTIONS } from "@/constants/app.enum";
import { fetchAuctionBidders, type AuctionBidders } from "./bidders.fetcher";

const EMPTY_BIDDERS: AuctionBidders = {
  totalBidders: 0,
  totalBids: 0,
  bidders: [],
  truncated: false,
  watcherCount: 0,
  lastBid: null,
  minNextBid: null,
};

/**
 * Snapshot người đấu giá của một phiên. Chỉ chạy khi phiên đang diễn ra;
 * cập nhật tiếp theo đến qua socket (`bidderUpdate`), không polling.
 */
export const useAuctionBidders = (auctionId: string, auctionStatus: STATUS_AUCTIONS) => {
  const enabled = !!auctionId && auctionStatus === STATUS_AUCTIONS.HAPPENING;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [API_ROUTES.AUCTION_BIDDERS(auctionId)],
    queryFn: () => fetchAuctionBidders(auctionId),
    enabled,
    staleTime: 5000,
  });

  return {
    bidders: data ?? EMPTY_BIDDERS,
    isLoading: enabled && isLoading,
    isError,
    refetchBidders: refetch,
  };
};
