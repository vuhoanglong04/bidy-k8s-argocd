"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { ProductCardCompact } from "@/components/auction";
import PaginationCustom from "@/components/common/pagination-custom";
import { LoadingState, Skeleton } from "@/components/common/loading";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_ROUTES } from "@/constants/routes.constants";
import {
  SORT_PRESETS,
  STATUS_TABS,
  useAuctionBrowseParams,
  type BrowseSort,
} from "@/hooks/useAuctionBrowseParams";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { findCategoryBySlug, useCategoryTree } from "@/services/category";
import { useAuctionsByCategorySlug } from "@/services/product";
import CategoryRail from "./CategoryRail";

interface AuctionBrowserProps {
  /** Slug danh mục, hoặc `all` cho toàn sàn. */
  slug: string;
  /** Bỏ trống thì lấy tên danh mục từ cây danh mục. */
  title?: string;
  /** Một dòng nói rõ trang này đang cho xem cái gì. */
  subtitle?: string;
}

const PAGE_SIZE = 24;

/**
 * Trang duyệt đấu giá dùng chung cho `/category/all` và `/category/[slug]`.
 *
 * Mọi bộ lọc đều chạy phía server (`status`, `sortBy`, `sortOrder`, `page`) và
 * nằm trong URL. Chủ ý không lọc thêm ở client: client chỉ giữ một trang dữ
 * liệu, nên lọc/sắp xếp tại chỗ sẽ cho ra kết quả sai lệch so với tổng số.
 */
export default function AuctionBrowser({
  slug,
  title,
  subtitle,
}: Readonly<AuctionBrowserProps>) {
  const {
    status,
    sort,
    page,
    listParams,
    hasActiveFilters,
    setStatus,
    setSort,
    setPage,
    resetFilters,
  } = useAuctionBrowseParams(PAGE_SIZE);

  const { auctions, pagination, isLoading, isUnknownCategory } =
    useAuctionsByCategorySlug(slug, listParams);

  // URL mang slug, còn tên hiển thị nằm trong cây danh mục — cùng query mà
  // `CategoryRail` đã dùng nên không phát sinh request thứ hai.
  const { data: tree } = useCategoryTree();
  const { isAuthenticated } = useAuth();
  const heading =
    title ?? (slug === "all" ? "Tất cả phiên đấu giá" : findCategoryBySlug(tree ?? [], slug)?.name ?? "Danh mục");

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Đổi trang thì đưa người xem về đầu lưới, không để họ đứng giữa trang mới.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const totalItems = pagination?.totalItems ?? 0;
  const totalPages = pagination?.totalPages ?? 0;

  if (isUnknownCategory) {
    return (
      <main className="container mx-auto flex flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          Không tìm thấy danh mục này
        </h1>
        <p className="text-sm text-foreground-secondary">
          Danh mục có thể đã được đổi tên hoặc gỡ khỏi sàn.
        </p>
        <Link
          href={APP_ROUTES.CATEGORY_ALL}
          className="border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Xem tất cả phiên đấu giá
        </Link>
      </main>
    );
  }

  const filterPanel = <CategoryRail activeSlug={slug} />;

  return (
    <main className="container mx-auto flex flex-col gap-6 px-4 py-8">
      {/* Tiêu đề trang */}
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-secondary">
            Phiên đấu giá
          </p>
          <h1 className="mt-2 text-3xl font-bold text-foreground lg:text-4xl">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-foreground-secondary">
            {subtitle ??
              (isLoading
                ? "Đang tải…"
                : `${totalItems.toLocaleString("vi-VN")} phiên khớp bộ lọc hiện tại`)}
          </p>
        </div>

        {/* Hai luồng tách riêng: đăng sản phẩm vào kho, hoặc mở phiên đấu giá.
            Cả hai đều cần đăng nhập nên ẩn hẳn với khách. */}
        {isAuthenticated && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href={APP_ROUTES.PRODUCT_NEW}
              className="inline-flex h-10 items-center justify-center border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Đăng sản phẩm
            </Link>
            <Link
              href={APP_ROUTES.AUCTION_NEW}
              className="inline-flex h-10 items-center justify-center bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Đăng phiên đấu giá
            </Link>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Sidebar danh mục */}
        <aside className="hidden w-60 shrink-0 lg:block">{filterPanel}</aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Thanh điều khiển: trạng thái + sắp xếp */}
          <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className="mr-2 inline-flex h-9 items-center gap-2 border border-border px-3 text-sm font-medium text-foreground lg:hidden"
              >
                <SlidersHorizontal className="size-4" aria-hidden />
                Danh mục
              </button>

              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={status === tab.value}
                  onClick={() => setStatus(tab.value)}
                  className={cn(
                    "cursor-pointer px-3 py-1.5 text-sm font-medium transition-colors",
                    status === tab.value
                      ? "bg-foreground text-background"
                      : "text-foreground-secondary hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Đặt lại
                </button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-9 cursor-pointer items-center gap-2 border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent">
                  {SORT_PRESETS[sort].label}
                  <ChevronDown className="size-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[200px]">
                  {(
                    Object.entries(SORT_PRESETS) as [
                      BrowseSort,
                      (typeof SORT_PRESETS)[BrowseSort],
                    ][]
                  ).map(([value, preset]) => (
                    <DropdownMenuItem
                      key={value}
                      onSelect={() => setSort(value)}
                      className={cn(sort === value && "font-medium text-primary")}
                    >
                      {preset.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <LoadingState
            isLoading={isLoading}
            isEmpty={auctions.length === 0}
            loadingFallback={
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 10 }).map((_, index) => (
                  <Skeleton key={index} className="h-64 w-full" />
                ))}
              </div>
            }
            emptyFallback={
              <div className="border border-dashed border-border px-6 py-20 text-center">
                <p className="text-base font-medium text-foreground">
                  Không có phiên nào khớp bộ lọc
                </p>
                <p className="mt-1 text-sm text-foreground-secondary">
                  Thử đổi trạng thái, hoặc xem toàn bộ danh mục.
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-4 border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Đặt lại bộ lọc
                  </button>
                )}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {auctions.map((auction) => (
                <ProductCardCompact key={auction.id} item={auction} />
              ))}
            </div>
          </LoadingState>

          {totalPages > 1 && (
            <PaginationCustom
              totalPages={totalPages}
              currentPage={page}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      {/* Danh mục trên mobile */}
      {isFilterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-overlay lg:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsFilterOpen(false);
          }}
        >
          <div className="max-h-[85vh] w-full overflow-y-auto bg-background p-4 animate-slide-up">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                Chọn danh mục
              </h2>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                aria-label="Đóng"
                className="p-1 text-foreground"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {filterPanel}
          </div>
        </div>
      )}
    </main>
  );
}
