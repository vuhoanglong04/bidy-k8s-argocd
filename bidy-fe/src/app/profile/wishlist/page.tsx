"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, ExternalLink, Trash2, Gavel } from "lucide-react";
import PaginationCustom from "@/components/common/pagination-custom";
import { LoadingState, Skeleton } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { APP_ROUTES } from "@/constants";
import { STATUS_AUCTIONS } from "@/constants/app.enum";
import { cn } from "@/lib/utils";
import { useWishlist, useRemoveWishlist } from "@/services/user/user.query";
import { WishlistItem } from "@/types";
import { formatCurrency, formatDateTime } from "@/utils";

const PAGE_SIZE = 10;

const STATUS_META: Record<string, { label: string; dot: string }> = {
  [STATUS_AUCTIONS.INITIAL]: { label: "Sắp diễn ra", dot: "bg-info" },
  [STATUS_AUCTIONS.HAPPENING]: { label: "Đang diễn ra", dot: "bg-success" },
  [STATUS_AUCTIONS.ENDED]: { label: "Đã kết thúc", dot: "bg-muted-foreground" },
  cancelled: { label: "Đã huỷ", dot: "bg-destructive" },
};

/** Giá decimal của backend về dạng chuỗi — quy về số trước khi format. */
const toAmount = (value?: string | number | null) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

function WishlistRow({
  item,
  onOpen,
  onRemove,
  isRemoving,
}: Readonly<{
  item: WishlistItem;
  onOpen: (auctionId: string) => void;
  onRemove: (item: WishlistItem) => void;
  isRemoving: boolean;
}>) {
  const auction = item.auction;
  const product = auction?.product;
  const status = STATUS_META[auction?.status ?? ""] ?? {
    label: "Không xác định",
    dot: "bg-muted-foreground",
  };
  const price = toAmount(auction?.currentPrice ?? auction?.startingPrice);

  return (
    <li className="border border-border bg-card">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground-secondary">
            <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden />
            {status.label}
            {auction?.endDate && (
              <span className="normal-case tracking-normal">
                · Kết thúc {formatDateTime(auction.endDate)}
              </span>
            )}
          </div>

          <h2 className="mt-2 truncate text-base font-semibold text-foreground">
            {product?.name || "Sản phẩm không còn khả dụng"}
          </h2>

          {product?.description && (
            <p className="mt-1 line-clamp-1 text-sm text-foreground-secondary">
              {product.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-secondary">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Gavel className="size-3.5" aria-hidden />
              {auction?.totalBids ?? 0} lượt · {auction?.bidderCount ?? 0} người
            </span>
            {item.createdAt && (
              <span>Đã thêm {formatDateTime(item.createdAt)}</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-end justify-between gap-4 lg:flex-col lg:items-end">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-foreground-secondary">
              Giá hiện tại
            </p>
            <p className="text-lg font-bold text-primary tabular-nums">
              {formatCurrency(price)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="rounded-none"
              onClick={() => onOpen(item.auctionId)}
            >
              <ExternalLink className="size-4" aria-hidden />
              Xem phiên
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-none"
              aria-label="Bỏ khỏi yêu thích"
              disabled={isRemoving}
              onClick={() => onRemove(item)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function WishlistPage() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);

  const { items, totalCount, totalPages, isLoading, refetch } = useWishlist(
    currentPage,
    PAGE_SIZE
  );
  const removeWishlist = useRemoveWishlist();

  const handleOpenAuction = (auctionId: string) => {
    router.push(APP_ROUTES.PRODUCT_DETAIL(auctionId));
  };

  const handleRemove = async (item: WishlistItem) => {
    try {
      await removeWishlist.mutateAsync({ id: item.auctionId });
      // Xoá item cuối của trang cuối thì trang hiện tại không còn tồn tại.
      if (items.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        await refetch();
      }
    } catch (error) {
      console.error("Remove wishlist error:", error);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Heart className="size-6 fill-primary text-primary" aria-hidden />
          Danh sách yêu thích
        </h1>
        <p className="text-sm text-foreground-secondary tabular-nums">
          {totalCount} phiên đấu giá đang theo dõi
        </p>
      </header>

      <LoadingState
        isLoading={isLoading}
        isEmpty={items.length === 0}
        loadingFallback={
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
        }
        emptyFallback={
          <div className="border border-dashed border-border px-6 py-16 text-center">
            <p className="text-base font-medium text-foreground">
              Chưa có phiên đấu giá nào được theo dõi
            </p>
            <p className="mt-1 text-sm text-foreground-secondary">
              Bấm biểu tượng trái tim ở một phiên đấu giá để lưu vào đây.
            </p>
            <Button
              className="mt-4 rounded-none"
              onClick={() => router.push(APP_ROUTES.HOME)}
            >
              Khám phá phiên đấu giá
            </Button>
          </div>
        }
      >
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <WishlistRow
              key={item.id}
              item={item}
              onOpen={handleOpenAuction}
              onRemove={handleRemove}
              isRemoving={removeWishlist.isPending}
            />
          ))}
        </ul>
      </LoadingState>

      {totalPages > 1 && (
        <PaginationCustom
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
