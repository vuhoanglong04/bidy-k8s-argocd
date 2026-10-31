"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { LoadingState, Skeleton } from "@/components/common/loading";
import { APP_ROUTES } from "@/constants/routes.constants";
import { cn } from "@/lib/utils";
import {
  useDeleteProduct,
  useMyProducts,
  usePublishProduct,
  type MyProductListItem,
  type ProductStatus,
} from "@/services/product";

import MyProductCard from "./_components/MyProductCard";

type StatusFilter = ProductStatus | "all";

const FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "draft", label: "Nháp chưa hoàn thiện" },
  { value: "active", label: "Đang bán" },
];

export default function MyProductsPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const myProducts = useMyProducts({ limit: 100 });
  const publishProduct = usePublishProduct();
  const deleteProduct = useDeleteProduct();

  const products = useMemo(() => myProducts.data?.items ?? [], [myProducts.data]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: products.length };
    for (const product of products) {
      const status = product.status ?? "draft";
      result[status] = (result[status] ?? 0) + 1;
    }
    return result;
  }, [products]);

  const visible = useMemo(
    () => (filter === "all" ? products : products.filter((p) => p.status === filter)),
    [filter, products]
  );

  const handlePublish = useCallback(
    (product: MyProductListItem) => {
      if (!product.id) return;
      setBusyId(product.id);

      publishProduct.mutate(product.id, {
        onSuccess: () => {
          toast.success("Đã đăng bán. Giờ có thể mở phiên đấu giá cho sản phẩm này.");
        },
        onSettled: () => setBusyId(null),
      });
    },
    [publishProduct]
  );

  const handleDelete = useCallback(
    (product: MyProductListItem) => {
      if (!product.id) return;
      setBusyId(product.id);

      deleteProduct.mutate(product.id, {
        onSuccess: () => {
          toast.success("Đã xoá sản phẩm khỏi kho hàng.");
        },
        onSettled: () => setBusyId(null),
      });
    },
    [deleteProduct]
  );

  const draftCount = counts.draft ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sản phẩm của tôi</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Kho hàng của bạn. Một sản phẩm có thể mở phiên đấu giá nhiều lần —
            ế thì đăng lại.
          </p>
        </div>

        <Link
          href={APP_ROUTES.PRODUCT_NEW}
          className="inline-flex h-10 items-center bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Đăng sản phẩm
        </Link>
      </header>

      {draftCount > 0 && filter !== "draft" && (
        <p className="border border-border px-4 py-3 text-sm text-foreground-secondary">
          Bạn có <strong className="text-foreground">{draftCount} bản nháp</strong> chưa
          hoàn thiện — chúng chưa hiện ra với ai cả.{" "}
          <button
            type="button"
            onClick={() => setFilter("draft")}
            className="text-primary underline"
          >
            Xem và hoàn thiện
          </button>
        </p>
      )}

      <div className="flex flex-wrap gap-1 border-b border-border pb-3">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              filter === item.value
                ? "bg-primary text-primary-foreground"
                : "text-foreground-secondary hover:bg-accent"
            )}
          >
            {item.label}
            {counts[item.value] !== undefined && ` (${counts[item.value]})`}
          </button>
        ))}
      </div>

      <LoadingState
        isLoading={myProducts.isPending}
        isError={myProducts.isError}
        onRetry={() => myProducts.refetch()}
        isEmpty={visible.length === 0}
        emptyMessage={
          filter === "all"
            ? "Kho hàng đang trống. Đăng sản phẩm đầu tiên để bắt đầu bán."
            : "Không có sản phẩm nào ở trạng thái này."
        }
        loadingFallback={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        }
      >
        <ul className="flex flex-col gap-3">
          {visible.map((product) => (
            <li key={product.id}>
              <MyProductCard
                product={product}
                isBusy={busyId === product.id}
                onPublish={handlePublish}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      </LoadingState>
    </div>
  );
}
