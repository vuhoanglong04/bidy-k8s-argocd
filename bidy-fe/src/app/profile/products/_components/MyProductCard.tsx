"use client";

import Image from "next/image";
import Link from "next/link";

import { Spinner } from "@/components/common/loading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { APP_ROUTES } from "@/constants/routes.constants";
import { getProductConditionLabel } from "@/constants/app.enum";
import { cn } from "@/lib/utils";
import type { MyProductListItem, ProductStatus } from "@/services/product";

interface MyProductCardProps {
  product: MyProductListItem;
  isBusy: boolean;
  onPublish: (product: MyProductListItem) => void;
  onDelete: (product: MyProductListItem) => void;
}

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Bản nháp",
  active: "Đang bán",
};

const STATUS_TONES: Record<ProductStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-success text-success-foreground",
};

/** Vì sao chưa đăng đấu giá được — suy từ đúng các điều kiện backend kiểm. */
const describeBlockReason = (product: MyProductListItem): string | null => {
  if (product.canCreateAuction) return null;
  if (product.hasLiveAuction) return "Đang có phiên đấu giá chạy";
  if (product.status !== "active") return "Phải đăng bán trước khi mở phiên";
  if (!product.images?.length) return "Cần ít nhất một ảnh";
  return "Chưa đủ điều kiện mở phiên";
};

export default function MyProductCard({
  product,
  isBusy,
  onPublish,
  onDelete,
}: Readonly<MyProductCardProps>) {
  const status = (product.status ?? "draft") as ProductStatus;
  const cover = product.images?.find((image) => image.isPrimary) ?? product.images?.[0];
  const blockReason = describeBlockReason(product);

  return (
    <article className="flex flex-col gap-4 border border-border p-4 sm:flex-row">
      <div className="relative size-24 shrink-0 overflow-hidden border border-border bg-muted">
        {cover?.imageUrl ? (
          <Image
            src={cover.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="96px"
            unoptimized
          />
        ) : (
          <span className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
            Chưa có ảnh
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-base font-semibold text-foreground">
            {product.name}
          </h3>
          <span
            className={cn(
              "shrink-0 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              STATUS_TONES[status]
            )}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          {product.images?.length ?? 0} ảnh
          {product.condition && ` · ${getProductConditionLabel(product.condition)}`}
          {product.latestAuction &&
            ` · Phiên gần nhất: ${product.latestAuction.status}`}
        </p>

        {blockReason && (
          <p className="text-xs text-muted-foreground">{blockReason}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {isBusy && <Spinner size="xs" />}

          {/* Mở lại chính wizard đăng sản phẩm ở chế độ sửa: form đã điền sẵn
              và người sửa đi qua được cả bước ảnh — thứ dialog sửa cũ không làm được. */}
          <Link
            href={`${APP_ROUTES.PRODUCT_NEW}?edit=${product.id}`}
            className="inline-flex h-9 items-center border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Sửa
          </Link>

          {status === "draft" && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onPublish(product)}
              className="h-9 bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text"
            >
              Đăng bán
            </button>
          )}

          {product.canCreateAuction && (
            <Link
              href={`${APP_ROUTES.AUCTION_NEW}?product=${product.id}`}
              className="inline-flex h-9 items-center bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Đăng đấu giá
            </Link>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={isBusy}
                className="h-9 border border-border px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:text-btn-disabled-text"
              >
                Xoá
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-none">
              <AlertDialogHeader>
                <AlertDialogTitle>Xoá sản phẩm</AlertDialogTitle>
                <AlertDialogDescription>
                  Hành động này không thể hoàn tác. Sản phẩm &ldquo;{product.name}&rdquo; sẽ bị xoá khỏi kho hàng của bạn.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-none">Huỷ</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onDelete(product)}
                >
                  Xoá sản phẩm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </article>
  );
}
