"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks';
import { useMyAuctions, useDeleteMyAuction, useCancelAuction } from '@/services/bid';
import { STATUS_AUCTIONS } from '@/constants';
import { APP_ROUTES } from '@/constants/routes.constants';
import type { MappedAuction } from '@/services/auction.mapper';
import { formatDateTime, getValidText, formatVietnameseRevenue } from '@/utils';
import { toast } from 'sonner';
import { getActiveCategories, toUnifiedCategory } from '@/constants/categories.constants';
import type { UnifiedCategory } from '@/types/category.types';
import { ImageWithFallback } from "@/components/common/ImageWithFallback";

/** Khớp đúng `STATUS_AUCTIONS` backend phát ra: pending | happening | ended. */
type StatusFilter = 'all' | STATUS_AUCTIONS;

interface AuctionStats {
  total: number;
  upcoming: number;
  active: number;
  ended: number;
}

const statusConfig = {
  [STATUS_AUCTIONS.INITIAL]: {
    label: 'Sắp bắt đầu',
    tone: 'bg-warning text-warning-foreground',
  },
  [STATUS_AUCTIONS.HAPPENING]: {
    label: 'Đang diễn ra',
    tone: 'bg-success text-success-foreground',
  },
  [STATUS_AUCTIONS.ENDED]: {
    label: 'Đã kết thúc',
    tone: 'bg-muted text-muted-foreground',
  },
  [STATUS_AUCTIONS.CANCELLED]: {
    label: 'Đã huỷ',
    tone: 'bg-destructive text-destructive-foreground',
  },
};

function AuctionCard({ auction, onEdit, onDelete, onCancel }: {
  auction: MappedAuction;
  onEdit: (productId: string | undefined) => void;
  onDelete: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const router = useRouter();
  
  const status = auction.status as STATUS_AUCTIONS;
  const config = statusConfig[status];

  // `top_ownerships` là shape phẳng cũ, endpoint này không trả. Số liệu thật
  // nằm ở `bidderCount` / `totalBids`, còn giá cao nhất chính là `currentPrice`.
  const hasBids = auction.totalBids > 0;

  const handleView = () => {
    router.push(APP_ROUTES.PRODUCT_DETAIL(auction.id));
  };

  const metrics = [
    {
      label: 'Giá khởi điểm',
      value: formatVietnameseRevenue(String(auction.startingPrice)),
    },
    { label: 'Lượt đấu giá', value: String(auction.totalBids) },
    {
      label: 'Giá cao nhất',
      value: hasBids
        ? formatVietnameseRevenue(String(auction.currentPrice))
        : 'Chưa có',
    },
    { label: 'Kết thúc', value: formatDateTime(auction.endDate) },
  ];

  return (
    <article className="flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row">
      <div className="relative size-24 shrink-0 overflow-hidden border border-border bg-muted">
        <ImageWithFallback
          src={auction.image[0]}
          alt={getValidText(auction.name)}
          fill
          className="object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-base font-semibold text-foreground">
            {auction.name}
          </h3>
          <span
            className={cn(
              'shrink-0 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
              config?.tone ?? 'bg-muted text-muted-foreground'
            )}
          >
            {config?.label || 'Không xác định'}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <dt className="text-xs text-foreground-secondary">{metric.label}</dt>
              <dd className="truncate font-semibold text-foreground">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleView}
            className="h-9 border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Xem chi tiết
          </button>

          {status === STATUS_AUCTIONS.INITIAL && (
            <button
              type="button"
              onClick={() => onEdit(auction.productId)}
              className="h-9 bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Chỉnh sửa
            </button>
          )}

          {(status === STATUS_AUCTIONS.HAPPENING || status === STATUS_AUCTIONS.INITIAL) && auction.totalBids === 0 && (
            <button
              type="button"
              onClick={() => onCancel(auction.id)}
              className="h-9 border border-border px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Huỷ phiên
            </button>
          )}

          {(status === STATUS_AUCTIONS.INITIAL || status === STATUS_AUCTIONS.ENDED) && (
            <button
              type="button"
              onClick={() => onDelete(auction.id)}
              className="h-9 border border-border px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Xoá
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function AuctionStatsCard({ stats }: { stats: AuctionStats }) {
  const items = [
    { label: 'Tổng cộng', value: stats.total },
    { label: 'Sắp diễn ra', value: stats.upcoming },
    { label: 'Đang diễn ra', value: stats.active },
    { label: 'Đã kết thúc', value: stats.ended },
  ];

  return (
    <div className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1 bg-card px-4 py-3">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {item.value}
          </span>
          <span className="text-xs text-foreground-secondary">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function AuctionSkeleton() {
  return (
    <div className="flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row">
      <Skeleton className="size-24 shrink-0" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="h-9 w-48" />
      </div>
    </div>
  );
}

export default function MyAuctionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cancellingAuctionId, setCancellingAuctionId] = useState<string | null>(null);
  
  const { myAuctions, isLoading, refetchMyAuctions } = useMyAuctions();
  const deleteAuctionMutation = useDeleteMyAuction();
  const cancelAuctionMutation = useCancelAuction();
  
  // Get categories for dropdown
  const categories: UnifiedCategory[] = useMemo(() => {
    const activeCategories = getActiveCategories();
    return activeCategories.map(toUnifiedCategory);
  }, []);

  const stats = useMemo((): AuctionStats => {
    if (!myAuctions || !Array.isArray(myAuctions)) return { total: 0, upcoming: 0, active: 0, ended: 0 };
    
    const upcoming = myAuctions.filter((a) => a.status === STATUS_AUCTIONS.INITIAL).length;
    const active = myAuctions.filter((a) => a.status === STATUS_AUCTIONS.HAPPENING).length;
    const ended = myAuctions.filter((a) => a.status === STATUS_AUCTIONS.ENDED).length;
    
    return {
      total: myAuctions.length,
      upcoming,
      active,
      ended,
    };
  }, [myAuctions]);

  const filteredAuctions = useMemo(() => {
    if (!myAuctions || !Array.isArray(myAuctions)) return [];
    
    let filtered = myAuctions;
    
    // Filter by status
    if (activeFilter !== 'all') {
      filtered = filtered.filter((auction) => auction.status === activeFilter);
    }
    
    // Filter by category
    if (selectedCategory !== 'all') {
      // Mapper đã kéo `categoryId` từ `product` lên, không phải tự đào lại.
      filtered = filtered.filter((auction) => auction.categoryId === selectedCategory);
    }
    
    return filtered;
  }, [myAuctions, activeFilter, selectedCategory]);

  const handleEdit = (productId: string | undefined) => {
    if (!productId) {
      toast.error('Không tìm thấy sản phẩm của phiên này');
      return;
    }
    router.push(APP_ROUTES.PRODUCT_EDIT(productId));
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAuctionMutation.mutateAsync(id);
      refetchMyAuctions();
    } catch {
      toast.error('Có lỗi xảy ra khi xóa đấu giá');
    }
  };

  const handleCancel = (id: string) => {
    setCancellingAuctionId(id);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingAuctionId) return;
    const id = cancellingAuctionId;
    setCancellingAuctionId(null);
    try {
      await cancelAuctionMutation.mutateAsync(id);
    } catch {
      // Error handling and toast already managed in mutation
    }
  };

  const filterTabs = [
    { key: 'all', label: 'Tất cả', count: stats.total },
    { key: STATUS_AUCTIONS.INITIAL, label: 'Sắp diễn ra', count: stats.upcoming },
    { key: STATUS_AUCTIONS.HAPPENING, label: 'Đang diễn ra', count: stats.active },
    { key: STATUS_AUCTIONS.ENDED, label: 'Đã kết thúc', count: stats.ended },
  ] as const;

  if (!user) {
    return (
      <div className="border border-border bg-card p-8 text-center text-sm text-foreground-secondary">
        Vui lòng đăng nhập để xem đấu giá của bạn.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Đấu giá của tôi</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Quản lý và theo dõi các phiên đấu giá bạn đã tạo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(APP_ROUTES.AUCTION_NEW)}
          className="inline-flex h-10 items-center bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Tạo đấu giá mới
        </button>
      </header>

      <AuctionStatsCard stats={stats} />

      {/* Filters */}
      <div className="flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={activeFilter === tab.key}
              onClick={() => setActiveFilter(tab.key as StatusFilter)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors',
                activeFilter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground-secondary hover:bg-accent'
              )}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger
            aria-label="Lọc theo danh mục"
            className="h-9 w-full cursor-pointer justify-start rounded-none border-border bg-card text-sm font-medium text-foreground shadow-none transition-colors hover:border-foreground-secondary focus-visible:border-primary focus-visible:ring-0 data-[state=open]:border-primary dark:bg-card dark:hover:bg-card sm:w-[250px] *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:justify-start [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180"
          >
            <span className="shrink-0 text-xs font-normal text-foreground-secondary">
              Danh mục:
            </span>
            <SelectValue placeholder="Chọn danh mục">
              {selectedCategory === 'all'
                ? 'Tất cả danh mục'
                : categories.find(cat => cat.id === selectedCategory)?.displayName || 'Chọn danh mục'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72 rounded-none border-border shadow-md">
            <SelectItem value="all" className="cursor-pointer rounded-none py-2 focus:bg-accent focus:text-accent-foreground data-[state=checked]:font-semibold data-[state=checked]:text-primary">
              Tất cả danh mục
            </SelectItem>
            {categories.map((category) => (
              <SelectItem
                key={category.id}
                value={category.id}
                className="cursor-pointer rounded-none py-2 focus:bg-accent focus:text-accent-foreground data-[state=checked]:font-semibold data-[state=checked]:text-primary"
              >
                {category.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-foreground-secondary">
        Hiển thị {filteredAuctions.length} trong tổng số {stats.total} phiên
      </p>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <AuctionSkeleton key={i} />
          ))}
        </div>
      ) : filteredAuctions.length === 0 ? (
        <div className="border border-dashed border-border px-6 py-14 text-center">
          <Gavel className="mx-auto size-8 text-foreground-secondary" aria-hidden />
          <p className="mt-3 text-base font-medium text-foreground">
            {activeFilter === 'all'
              ? 'Chưa có đấu giá nào'
              : `Chưa có đấu giá ${filterTabs.find(t => t.key === activeFilter)?.label.toLowerCase()}`}
          </p>
          <p className="mt-1 text-sm text-foreground-secondary">
            Tạo phiên đấu giá đầu tiên để bắt đầu bán sản phẩm.
          </p>
          <button
            type="button"
            onClick={() => router.push(APP_ROUTES.AUCTION_NEW)}
            className="mt-4 inline-flex h-10 items-center bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Tạo đấu giá mới
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredAuctions.map((auction) => (
            <li key={auction.id}>
              <AuctionCard
                auction={auction}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCancel={handleCancel}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Dialog xác nhận huỷ phiên */}
      <AlertDialog
        open={Boolean(cancellingAuctionId)}
        onOpenChange={(open) => {
          if (!open) setCancellingAuctionId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Huỷ phiên đấu giá</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn huỷ phiên đấu giá này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không, giữ lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xác nhận huỷ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}