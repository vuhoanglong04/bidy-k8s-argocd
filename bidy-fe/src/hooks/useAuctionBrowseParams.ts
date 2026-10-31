"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STATUS_AUCTIONS } from "@/constants/app.enum";
import type { AuctionListParams } from "@/services/product";

/**
 * Bộ lọc của trang duyệt đấu giá, giữ trong URL để chia sẻ và F5 được.
 *
 * Mọi tiêu chí ở đây đều là thứ `GET /auctions` và
 * `GET /auctions/category/{id}` hiểu được (status, sortBy, sortOrder, page) —
 * không lọc thêm phía client, vì client chỉ nhìn thấy một trang dữ liệu.
 */
export type BrowseStatus = "all" | STATUS_AUCTIONS;

export type BrowseSort =
  | "ending-soon"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "hottest";

interface SortPreset {
  label: string;
  sortBy: NonNullable<AuctionListParams["sortBy"]>;
  sortOrder: NonNullable<AuctionListParams["sortOrder"]>;
}

export const SORT_PRESETS: Record<BrowseSort, SortPreset> = {
  "ending-soon": { label: "Sắp kết thúc", sortBy: "endDate", sortOrder: "asc" },
  newest: { label: "Mới đăng", sortBy: "createdAt", sortOrder: "desc" },
  hottest: { label: "Nhiều người đấu", sortBy: "bidderCount", sortOrder: "desc" },
  "price-asc": { label: "Giá thấp → cao", sortBy: "currentPrice", sortOrder: "asc" },
  "price-desc": { label: "Giá cao → thấp", sortBy: "currentPrice", sortOrder: "desc" },
};

export const STATUS_TABS: { value: BrowseStatus; label: string }[] = [
  { value: STATUS_AUCTIONS.HAPPENING, label: "Đang diễn ra" },
  { value: STATUS_AUCTIONS.INITIAL, label: "Sắp diễn ra" },
  { value: STATUS_AUCTIONS.ENDED, label: "Đã kết thúc" },
  { value: "all", label: "Tất cả" },
];

const DEFAULT_STATUS: BrowseStatus = STATUS_AUCTIONS.HAPPENING;
const DEFAULT_SORT: BrowseSort = "ending-soon";

const isBrowseStatus = (value: string | null): value is BrowseStatus =>
  value === "all" ||
  (Object.values(STATUS_AUCTIONS) as string[]).includes(value ?? "");

const isBrowseSort = (value: string | null): value is BrowseSort =>
  Boolean(value && value in SORT_PRESETS);

export function useAuctionBrowseParams(pageSize = 24) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const statusParam = searchParams.get("status");
  const sortParam = searchParams.get("sort");
  const pageParam = Number(searchParams.get("page"));

  const status: BrowseStatus = isBrowseStatus(statusParam)
    ? statusParam
    : DEFAULT_STATUS;
  const sort: BrowseSort = isBrowseSort(sortParam) ? sortParam : DEFAULT_SORT;
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const keyword = searchParams.get("q") ?? "";

  const setParams = useCallback(
    (next: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(next).forEach(([key, value]) => {
        if (value === null || value === "") params.delete(key);
        else params.set(key, String(value));
      });

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  /** Đổi bộ lọc thì trang cũ không còn nghĩa gì — luôn về trang 1. */
  const setStatus = useCallback(
    (value: BrowseStatus) =>
      setParams({ status: value === DEFAULT_STATUS ? null : value, page: null }),
    [setParams]
  );

  const setSort = useCallback(
    (value: BrowseSort) =>
      setParams({ sort: value === DEFAULT_SORT ? null : value, page: null }),
    [setParams]
  );

  const setKeyword = useCallback(
    (value: string) => setParams({ q: value || null, page: null }),
    [setParams]
  );

  const setPage = useCallback(
    (value: number) => setParams({ page: value > 1 ? value : null }),
    [setParams]
  );

  const resetFilters = useCallback(
    () => setParams({ status: null, sort: null, q: null, page: null }),
    [setParams]
  );

  const listParams: AuctionListParams = useMemo(
    () => ({
      page,
      limit: pageSize,
      ...(status === "all" ? {} : { status }),
      sortBy: SORT_PRESETS[sort].sortBy,
      sortOrder: SORT_PRESETS[sort].sortOrder,
    }),
    [page, pageSize, status, sort]
  );

  const hasActiveFilters =
    status !== DEFAULT_STATUS || sort !== DEFAULT_SORT || Boolean(keyword);

  return {
    status,
    sort,
    page,
    keyword,
    listParams,
    hasActiveFilters,
    setStatus,
    setSort,
    setPage,
    setKeyword,
    resetFilters,
  };
}

export default useAuctionBrowseParams;
