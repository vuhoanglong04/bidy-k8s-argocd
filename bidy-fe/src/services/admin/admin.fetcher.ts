import { API_ROUTES } from "@/constants";
import axiosClient from "@/lib/axios-client";
import {
  AdminAuctionListResponse,
  AdminAuctionsParams,
  AdminStatisticsResponse,
} from "@/types";

export const fetchAllAuctions = async (
  params?: AdminAuctionsParams
): Promise<AdminAuctionListResponse> => {
  const res = await axiosClient.get<AdminAuctionListResponse>(
    API_ROUTES.ADMIN_AUCTIONS,
    {
      params,
    }
  );
  return res.data;
};

export const fetchStatisticAuctions = async (
  year?: string
): Promise<AdminStatisticsResponse> => {
  const res = await axiosClient.get<AdminStatisticsResponse>(
    API_ROUTES.ADMIN_STATISTICS_AUCTIONS,
    {
      params: { year },
    }
  );
  return res.data;
};

export const fetchStatisticUsers = async (
  year?: string
): Promise<AdminStatisticsResponse> => {
  const res = await axiosClient.get<AdminStatisticsResponse>(
    API_ROUTES.ADMIN_STATISTICS_USERS,
    {
      params: { year },
    }
  );
  return res.data;
};

export const cancelAdminAuction = async (id: string): Promise<unknown> => {
  const res = await axiosClient.patch(API_ROUTES.ADMIN_AUCTION_CANCEL(id));
  return res.data;
};
