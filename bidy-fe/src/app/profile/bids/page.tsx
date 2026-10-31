"use client";

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/services/user';
import { LoadingState, Skeleton } from '@/components/common/loading';
import PaginationCustom from '@/components/common/pagination-custom';
import {
  Trophy,
  XCircle,
  Zap,
  ShoppingCart,
  Gavel,
  Activity,
  SortAsc,
  SortDesc,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatDateTime,
  formatVietnameseRevenue,
  getValidNumber,
  getValidText,
} from '@/utils';
import { APP_ROUTES } from '@/constants';
import { useDebouncedValue } from '@/hooks';
import { useUserBidHistory } from '@/services/bid-history/bid-history.query';
import type {
  BidHistoryItem,
  GetUserBidHistoryParams,
} from '@/services/bid-history/bid-history.service';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

// Action type configuration
const actionConfig = {
  place_bid: {
    label: 'Đặt giá thủ công',
    icon: Gavel,
    tone: 'bg-muted text-muted-foreground',
  },
  auto_bid: {
    label: 'Đấu giá tự động',
    icon: Zap,
    tone: 'bg-info text-info-foreground',
  },
  won: {
    label: 'Thắng đấu giá',
    icon: Trophy,
    tone: 'bg-success text-success-foreground',
  },
  lost: {
    label: 'Thua đấu giá',
    icon: XCircle,
    tone: 'bg-destructive text-destructive-foreground',
  },
  buy_now: {
    label: 'Mua ngay',
    icon: ShoppingCart,
    tone: 'bg-accent text-accent-foreground',
  },
} as const;

type FilterActionType = 'all' | keyof typeof actionConfig;

function BidHistoryRow({ history }: { history: BidHistoryItem }) {
  const router = useRouter();
  const config = actionConfig[history.actionType] || actionConfig.place_bid;
  const Icon = config?.icon || Activity;

  const handleViewAuction = () => {
    if (history.auctionId) {
      router.push(APP_ROUTES.PRODUCT_DETAIL(history.auctionId));
    }
  };

  const rawAuctionName = history.auction?.product?.name;
  const auctionName = getValidText(rawAuctionName) || 'Sản phẩm đấu giá';
  const auctionImage = history.auction?.product?.primaryImage;

  return (
    <div
      className="group flex cursor-pointer items-center gap-4 border-b border-border p-4 transition-colors last:border-b-0 hover:bg-accent"
      onClick={handleViewAuction}
    >
      {/* Action icon */}
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center',
          config?.tone
        )}
      >
        <Icon size={18} aria-hidden />
      </div>

      {/* Auction image */}
      <div className="relative size-12 shrink-0 overflow-hidden border border-border bg-muted">
        <ImageWithFallback
          src={auctionImage}
          alt={auctionName}
          fill
          className="object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="min-w-0 truncate text-sm font-semibold text-foreground">
            {auctionName}
          </h4>
          <span
            className={cn(
              'shrink-0 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
              config?.tone
            )}
          >
            {config?.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold tabular-nums text-foreground">
            {formatVietnameseRevenue(getValidNumber(history.amount))}
          </span>
          {history.position ? (
            <span className="text-xs text-foreground-secondary">
              Vị trí #{history.position}
            </span>
          ) : null}
          <span className="text-xs text-foreground-secondary">
            {formatDateTime(history.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BidHistoryPage() {
  const { isLoading: profileLoading } = useProfile();
  const [filterType, setFilterType] = useState<FilterActionType>('all');
  const [auctionStatus, setAuctionStatus] = useState<'happening' | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'createdAt' | 'amount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const itemsPerPage = 10;

  const { debouncedValue: debouncedSearch } = useDebouncedValue(searchTerm, 400);

  const queryParams: GetUserBidHistoryParams = useMemo(() => {
    return {
      page: currentPage,
      limit: itemsPerPage,
      actionType: filterType === 'all' ? undefined : filterType,
      auctionStatus: auctionStatus,
      sortBy: sortBy,
      sortOrder: sortOrder,
      search: debouncedSearch.trim() || undefined,
      dateFrom: dateRange.start || undefined,
      dateTo: dateRange.end || undefined,
    };
  }, [
    currentPage,
    itemsPerPage,
    filterType,
    auctionStatus,
    sortBy,
    sortOrder,
    debouncedSearch,
    dateRange.start,
    dateRange.end,
  ]);

  // Use real API data with server-side filtering, sorting, pagination
  const {
    data: bidHistoryData,
    isLoading: historyLoading,
    isError,
    error,
    refetch,
  } = useUserBidHistory(queryParams);

  const historyList = useMemo(() => bidHistoryData?.history || [], [bidHistoryData?.history]);
  const stats = useMemo(
    () =>
      bidHistoryData?.stats || {
        total: 0,
        won: 0,
        lost: 0,
        active: 0,
        buy_now: 0,
        place_bid: 0,
        auto_bid: 0,
      },
    [bidHistoryData?.stats]
  );
  const pagination = bidHistoryData?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const totalItems = pagination?.totalItems || 0;

  // Reset to first page when filters change
  const handleFilterChange = useCallback((newFilter: FilterActionType) => {
    setFilterType(newFilter);
    setCurrentPage(1);
  }, []);

  const handleToggleHappening = useCallback(() => {
    setAuctionStatus((prev) => (prev === 'happening' ? undefined : 'happening'));
    setCurrentPage(1);
  }, []);

  const handleSortChange = useCallback((newSortBy: 'createdAt' | 'amount') => {
    if (sortBy === newSortBy) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  }, [sortBy]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setDateRange({ start: '', end: '' });
    setFilterType('all');
    setAuctionStatus(undefined);
    setCurrentPage(1);
  }, []);

  if (profileLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full" />
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const hasActiveFilters =
    Boolean(searchTerm) ||
    Boolean(dateRange.start) ||
    Boolean(dateRange.end) ||
    filterType !== 'all' ||
    Boolean(auctionStatus);

  const statCards = [
    { label: 'Tổng', value: stats.total },
    { label: 'Đang tham gia', value: stats.active },
    { label: 'Thắng', value: stats.won },
    { label: 'Thua', value: stats.lost },
    { label: 'Mua ngay', value: stats.buy_now },
  ];

  const listSkeleton = (
    <div className="flex flex-col border border-border bg-card">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center gap-4 border-b border-border p-4 last:border-b-0"
        >
          <Skeleton className="size-10 shrink-0" />
          <Skeleton className="size-12 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold text-foreground">Lịch sử đấu thầu</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Mọi lượt đặt giá, bị vượt giá và kết quả của bạn.
        </p>
      </header>

      {/* Stats - Toàn bộ lịch sử */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground-secondary">
            Toàn bộ lịch sử
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-5">
          {statCards.map((card) => (
            <div key={card.label} className="flex flex-col gap-1 bg-card px-4 py-3">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {card.value}
              </span>
              <span className="text-xs text-foreground-secondary">{card.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Search + filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-secondary"
            aria-hidden
          />
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-full border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Từ ngày"
            value={dateRange.start}
            onChange={(e) => {
              setDateRange({ ...dateRange, start: e.target.value });
              setCurrentPage(1);
            }}
            className="h-10 border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-foreground-secondary">–</span>
          <input
            type="date"
            aria-label="Đến ngày"
            value={dateRange.end}
            onChange={(e) => {
              setDateRange({ ...dateRange, end: e.target.value });
              setCurrentPage(1);
            }}
            className="h-10 border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <select
            aria-label="Sắp xếp theo"
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as 'createdAt' | 'amount')}
            className="h-10 border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="createdAt">Thời gian</option>
            <option value="amount">Số tiền</option>
          </select>
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            aria-label={sortOrder === 'desc' ? 'Đang giảm dần' : 'Đang tăng dần'}
            className="inline-flex size-10 items-center justify-center border border-border text-foreground transition-colors hover:bg-accent"
          >
            {sortOrder === 'desc' ? <SortDesc size={18} /> : <SortAsc size={18} />}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-10 border border-border px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Action type & status tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={filterType === 'all'}
            onClick={() => handleFilterChange('all')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              filterType === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground-secondary hover:bg-accent'
            )}
          >
            Tất cả ({stats.total})
          </button>
          {(Object.entries(actionConfig) as [keyof typeof actionConfig, (typeof actionConfig)[keyof typeof actionConfig]][]).map(
            ([key, config]) => {
              const count = stats[key] ?? 0;
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filterType === key}
                  onClick={() => handleFilterChange(key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
                    filterType === key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground-secondary hover:bg-accent'
                  )}
                >
                  <Icon size={14} aria-hidden />
                  {config.label} ({count})
                </button>
              );
            }
          )}

          <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" aria-hidden />

          <button
            type="button"
            aria-pressed={auctionStatus === 'happening'}
            onClick={handleToggleHappening}
            className={cn(
              'inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium transition-colors',
              auctionStatus === 'happening'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-foreground-secondary hover:bg-accent'
            )}
          >
            <Activity size={14} aria-hidden />
            Đang diễn ra ({stats.active})
          </button>
        </div>

        <span className="text-sm text-foreground-secondary tabular-nums">
          {totalItems} kết quả
        </span>
      </div>

      {/* Timeline / List with LoadingState */}
      <LoadingState
        isLoading={historyLoading}
        isError={isError}
        error={error}
        isEmpty={historyList.length === 0}
        onRetry={refetch}
        loadingFallback={listSkeleton}
        emptyFallback={
          <div className="border border-dashed border-border px-6 py-14 text-center">
            <Activity className="mx-auto size-8 text-foreground-secondary" aria-hidden />
            <p className="mt-3 text-base font-medium text-foreground">
              Không tìm thấy kết quả
            </p>
            <p className="mt-1 text-sm text-foreground-secondary">
              {hasActiveFilters
                ? 'Thử đổi bộ lọc hoặc từ khoá tìm kiếm.'
                : 'Bắt đầu tham gia đấu giá để xem lịch sử hoạt động tại đây.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-4 inline-flex h-10 items-center bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Xoá bộ lọc
              </button>
            )}
          </div>
        }
      >
        <div className="border border-border bg-card">
          {historyList.map((history: BidHistoryItem) => (
            <BidHistoryRow key={history.id} history={history} />
          ))}

          {totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
              <p className="text-sm text-foreground-secondary tabular-nums">
                {(currentPage - 1) * itemsPerPage + 1}
                {' – '}
                {Math.min(currentPage * itemsPerPage, totalItems)}
                {' / '}
                {totalItems}
              </p>

              <PaginationCustom
                totalPages={totalPages}
                currentPage={currentPage}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}
        </div>
      </LoadingState>
    </div>
  );
}