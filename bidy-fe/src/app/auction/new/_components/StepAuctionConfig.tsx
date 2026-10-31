"use client";

import Image from "next/image";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MoneyInput from "@/components/ui/MoneyInput";
import { LoadingState, Skeleton } from "@/components/common/loading";
import { APP_ROUTES } from "@/constants/routes.constants";
import { cn } from "@/lib/utils";
import type { MyProductListItem } from "@/services/product";

import type { AuctionConfigState } from "@/app/auction/new/types";

interface StepAuctionConfigProps {
  products: readonly MyProductListItem[];
  isLoadingProducts: boolean;
  isProductsError: boolean;
  onRetryProducts: () => void;
  value: AuctionConfigState;
  errors: Partial<Record<keyof AuctionConfigState, string>>;
  onChange: (patch: Partial<AuctionConfigState>) => void;
  onContinue: () => void;
}

/**
 * Vì sao món này chưa đấu giá được. Backend chỉ trả `canCreateAuction` dạng
 * boolean, nên lý do suy ra từ chính các điều kiện nó kiểm: product phải
 * `active`, có ≥1 ảnh, và chưa có phiên nào đang chạy.
 */
const describeBlockReason = (product: MyProductListItem): string => {
  const reasons: string[] = [];

  if (product.hasLiveAuction) reasons.push("đang có phiên đấu giá");
  if (product.status !== "active") reasons.push("chưa đăng bán");
  if (!product.images?.length) reasons.push("chưa có ảnh");

  return reasons.length > 0 ? reasons.join(" · ") : "chưa đủ điều kiện";
};

export default function StepAuctionConfig({
  products,
  isLoadingProducts,
  isProductsError,
  onRetryProducts,
  value,
  errors,
  onChange,
  onContinue,
}: Readonly<StepAuctionConfigProps>) {
  // `canCreateAuction` phản chiếu đúng các điều kiện backend sẽ kiểm, nên khoá
  // ở đây thay vì để seller điền xong form rồi bị từ chối.
  const selectable = products.filter((product) => product.canCreateAuction);
  const blocked = products.filter((product) => !product.canCreateAuction);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Cấu hình sản phẩm</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Chọn món hàng trong kho rồi đặt giá. Tên, mô tả và hình ảnh lấy thẳng
          từ sản phẩm, bạn không phải nhập lại.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <Label>
          Sản phẩm <span className="text-destructive">*</span>
        </Label>

        <LoadingState
          isLoading={isLoadingProducts}
          isError={isProductsError}
          onRetry={onRetryProducts}
          isEmpty={products.length === 0}
          loadingFallback={
            <div className="flex flex-col gap-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          }
        >
          {selectable.length === 0 ? (
            <p className="border border-border px-4 py-3 text-sm text-foreground-secondary">
              Chưa có sản phẩm nào sẵn sàng đấu giá. Sản phẩm phải đã đăng bán,
              có ít nhất một ảnh, và chưa có phiên nào đang chạy.{" "}
              <Link href={APP_ROUTES.PRODUCT_NEW} className="text-primary underline">
                Đăng sản phẩm mới
              </Link>
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {selectable.map((product) => {
                const isSelected = value.productId === product.id;
                const cover =
                  product.images?.find((image) => image.isPrimary) ?? product.images?.[0];

                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onChange({ productId: product.id ?? "" })}
                      className={cn(
                        "flex w-full items-center gap-4 border p-3 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-accent-subtle"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <span className="relative size-14 shrink-0 overflow-hidden border border-border bg-muted">
                        {cover?.imageUrl && (
                          <Image
                            src={cover.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                            unoptimized
                          />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {product.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {product.images?.length ?? 0} ảnh
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </LoadingState>

        {blocked.length > 0 && (
          <details className="border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm text-foreground-secondary">
              {blocked.length} sản phẩm chưa đấu giá được
            </summary>
            <ul className="flex flex-col divide-y divide-border border-t border-border">
              {blocked.map((product) => (
                <li
                  key={product.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2"
                >
                  <span className="truncate text-sm text-foreground">
                    {product.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {describeBlockReason(product)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {errors.productId && (
          <p className="text-sm text-destructive">{errors.productId}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Label htmlFor="auction-quantity">
          Số lượng <span className="text-destructive">*</span>
        </Label>
        <Input
          id="auction-quantity"
          type="number"
          min={1}
          step={1}
          className="w-32"
          aria-invalid={Boolean(errors.quantity)}
          value={value.quantity}
          onChange={(event) => onChange({ quantity: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Cả lô về tay một người thắng. Mọi mức giá bên dưới là giá của cả lô,
          không phải giá mỗi đơn vị.
        </p>
        {errors.quantity && (
          <p className="text-sm text-destructive">{errors.quantity}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Label htmlFor="auction-starting-price">
          Giá khởi điểm <span className="text-destructive">*</span>
        </Label>
        <MoneyInput
          id="auction-starting-price"
          className="max-w-xs"
          placeholder="0"
          error={Boolean(errors.startingPrice)}
          value={value.startingPrice}
          onChange={(formatted) => onChange({ startingPrice: formatted })}
        />
        {errors.startingPrice && (
          <p className="text-sm text-destructive">{errors.startingPrice}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Label htmlFor="auction-bid-increment">Bước giá</Label>
        <MoneyInput
          id="auction-bid-increment"
          className="max-w-xs"
          placeholder="Để trống dùng mặc định"
          error={Boolean(errors.bidIncrement)}
          value={value.bidIncrement}
          onChange={(formatted) => onChange({ bidIncrement: formatted })}
        />
        <p className="text-xs text-muted-foreground">
          Mức tăng tối thiểu cho mỗi lượt trả giá, áp dụng chung cho mọi người
          tham gia. Bước lớn giúp phiên chốt nhanh, bước nhỏ giúp giá lên sát
          giá trị thật hơn.
        </p>
        {errors.bidIncrement && (
          <p className="text-sm text-destructive">{errors.bidIncrement}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Label htmlFor="auction-buy-now-price">Giá mua ngay</Label>
        <MoneyInput
          id="auction-buy-now-price"
          className="max-w-xs"
          placeholder="Không bắt buộc"
          error={Boolean(errors.buyNowPrice)}
          value={value.buyNowPrice}
          onChange={(formatted) => onChange({ buyNowPrice: formatted })}
        />
        <p className="text-xs text-muted-foreground">
          Để trống nếu chỉ muốn bán qua đấu giá. Đặt giá này thì người mua có thể
          chốt ngay và phiên kết thúc.
        </p>
        {errors.buyNowPrice && (
          <p className="text-sm text-destructive">{errors.buyNowPrice}</p>
        )}
      </section>

      <div className="border-t border-border pt-6">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex h-10 items-center justify-center bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Tiếp tục
        </button>
      </div>
    </div>
  );
}
