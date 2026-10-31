import { API_ROUTES } from "@/constants";
import axiosClient from "@/lib/axios-client";
import {
  IAdminOverviewAuctions,
  IAdminOverviewCategories,
  IAdminOverviewUsers,
} from "@/types/statistics";

/**
 * Bộ đếm tổng quan của dashboard admin.
 *
 * Ba endpoint tách rời để mỗi cái là đúng một truy vấn aggregate phía backend.
 * Envelope theo chuẩn `apiResponse`: `{ status, message, data }`.
 */

export const fetchAdminOverviewUsers = async (): Promise<IAdminOverviewUsers> => {
  const res = await axiosClient.get(API_ROUTES.ADMIN_OVERVIEW_USERS);
  return res.data?.data;
};

export const fetchAdminOverviewAuctions =
  async (): Promise<IAdminOverviewAuctions> => {
    const res = await axiosClient.get(API_ROUTES.ADMIN_OVERVIEW_AUCTIONS);
    return res.data?.data;
  };

export const fetchAdminOverviewCategories =
  async (): Promise<IAdminOverviewCategories> => {
    const res = await axiosClient.get(API_ROUTES.ADMIN_OVERVIEW_CATEGORIES);
    return res.data?.data;
  };
