"use client";

import { useState } from "react";
import { UnifiedAuctionCard } from "@/components/auction";
import { Grid, List, ChevronDown, ChevronLeft, ChevronRight, Gavel } from "lucide-react";
import { useSellerAuctions } from "@/services/seller";
import { LoadingState } from "@/components/common/loading";

interface SellerProductsProps {
  sellerId: string;
}

type SortKey = "createdAt" | "endDate" | "currentPrice" | "bidderCount" | "totalBids";
type SortOrder = "asc" | "desc";

interface SortConfig {
  key: SortKey;
  order: SortOrder;
  label: string;
}

const SORT_OPTIONS: SortConfig[] = [
  { key: "createdAt", order: "desc", label: "Mới nhất" },
  { key: "endDate", order: "asc", label: "Sắp kết thúc" },
  { key: "currentPrice", order: "asc", label: "Giá tăng dần" },
  { key: "currentPrice", order: "desc", label: "Giá giảm dần" },
  { key: "totalBids", order: "desc", label: "Nhiều lượt đấu giá nhất" },
  { key: "bidderCount", order: "desc", label: "Nhiều người tham gia nhất" },
];

const TYPE_TABS = [
  { key: "happening" as const, label: "Đang diễn ra" },
  { key: "ended" as const, label: "Đã hoàn thành" },
  { key: "pending" as const, label: "Sắp diễn ra" },
];

export default function SellerProducts({ sellerId }: SellerProductsProps) {
  const [activeTab, setActiveTab] = useState<"happening" | "ended" | "pending">("happening");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selectedSort, setSelectedSort] = useState<SortConfig>(SORT_OPTIONS[0]);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 12;

  const { auctions, pagination, isLoading, isError, error, refetch } = useSellerAuctions(
    sellerId,
    {
      status: activeTab,
      sortBy: selectedSort.key,
      sortOrder: selectedSort.order,
      page,
      limit,
    }
  );

  const handleTabChange = (tab: "happening" | "ended" | "pending") => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleSortChange = (option: SortConfig) => {
    setSelectedSort(option);
    setShowSortMenu(false);
    setPage(1);
  };

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="w-full bg-background border border-border shadow-sm p-6 flex flex-col gap-6">
      <div className="text-base font-semibold text-foreground">
        Danh sách phiên đấu giá
      </div>

      {/* Type buttons */}
      <div className="flex flex-wrap gap-2">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleTabChange(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground-secondary hover:bg-muted/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Controls: View toggle & Sort */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* View toggle */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Xem dạng danh sách"
            onClick={() => setView("list")}
            className={`p-2 border border-border transition-colors ${
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground-secondary hover:bg-accent"
            }`}
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Xem dạng lưới"
            onClick={() => setView("grid")}
            className={`p-2 border border-border transition-colors ${
              view === "grid"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground-secondary hover:bg-accent"
            }`}
          >
            <Grid className="size-4" />
          </button>
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-2 bg-card text-foreground border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <span>Sắp xếp: {selectedSort.label}</span>
            <ChevronDown
              className={`size-4 transition-transform ${
                showSortMenu ? "rotate-180" : ""
              }`}
            />
          </button>
          {showSortMenu && (
            <div className="absolute top-full right-0 mt-1 bg-card border border-border shadow-lg z-10 min-w-[220px]">
              {SORT_OPTIONS.map((option, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSortChange(option)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    selectedSort.key === option.key && selectedSort.order === option.order
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-foreground-secondary hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <LoadingState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={auctions.length === 0}
        onRetry={refetch}
        emptyFallback={
          <div className="border border-dashed border-border px-6 py-12 text-center">
            <Gavel className="mx-auto size-8 text-foreground-secondary" aria-hidden />
            <p className="mt-3 text-base font-medium text-foreground">
              Người bán chưa có phiên đấu giá nào trong mục này.
            </p>
          </div>
        }
      >
        {view === "list" ? (
          <div className="flex flex-col gap-4">
            {auctions.map((auction) => (
              <UnifiedAuctionCard
                key={auction.id}
                item={auction}
                layout="horizontal"
                context="list"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map((auction) => (
              <UnifiedAuctionCard
                key={auction.id}
                item={auction}
                layout="vertical"
                context="list"
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav aria-label="Phân trang" className="flex items-center justify-center gap-2 pt-6 border-t border-border">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-border bg-card text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
            >
              <ChevronLeft className="size-4" />
              <span>Trước</span>
            </button>
            <span className="px-3 py-1.5 text-sm font-medium text-foreground-secondary">
              Trang {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-border bg-card text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
            >
              <span>Sau</span>
              <ChevronRight className="size-4" />
            </button>
          </nav>
        )}
      </LoadingState>
    </div>
  );
}
