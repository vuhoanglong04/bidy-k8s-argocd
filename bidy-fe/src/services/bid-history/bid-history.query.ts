import { useQuery } from '@tanstack/react-query';
import {
  getUserBidHistory,
  getAuctionBidHistory,
  type GetUserBidHistoryParams,
} from './bid-history.service';

/**
 * Hook to fetch user's bid history with server-side filters, sorting, and pagination.
 */
export const useUserBidHistory = (params?: GetUserBidHistoryParams) => {
  return useQuery({
    queryKey: ['bid-history', 'user', params],
    queryFn: () => getUserBidHistory(params),
    staleTime: 10000,
  });
};

/**
 * Hook to fetch auction's bid history
 */
export const useAuctionBidHistory = (auctionId: string) => {
  return useQuery({
    queryKey: ['bid-history', 'auction', auctionId],
    queryFn: () => getAuctionBidHistory(auctionId),
    enabled: !!auctionId,
    refetchInterval: 10000, // Refetch every 10 seconds for live updates
    staleTime: 5000,
  });
};