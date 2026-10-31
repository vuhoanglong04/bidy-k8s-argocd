/**
 * Bộ đếm tổng quan của trang admin — mỗi nhóm là một endpoint riêng
 * (`GET /admin/overview/{users,auctions,categories}`), backend chạy đúng một
 * truy vấn aggregate cho mỗi nhóm. Đây là counters, không có phân trang.
 */
export interface IAdminOverviewUsers {
  totalUser: number;
  activeUser: number;
  suspendedUser: number;
}

export interface IAdminOverviewAuctions {
  totalAuction: number;
  happeningAuction: number;
  endedAuction: number;
}

export interface IAdminOverviewCategories {
  totalCategories: number;
  activeCategories: number;
  inactiveCategories: number;
}

export interface IStatisticAuction {
  month: string;
  amount: string;
}
export type IStatisticAuctions = IStatisticAuction[];
