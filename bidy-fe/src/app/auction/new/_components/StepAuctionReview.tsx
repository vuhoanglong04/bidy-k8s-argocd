"use client";

import Image from "next/image";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

import { Spinner } from "@/components/common/loading";
import type { MyProductListItem } from "@/services/product";

interface StepAuctionReviewProps {
  product?: MyProductListItem;
  quantity: number;
  startingPrice: number;
  buyNowPrice?: number;
  bidIncrement?: number;
  startDate: Date;
  endDate: Date;
  isStartingNow: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

const formatMoney = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;

export default function StepAuctionReview({
  product,
  quantity,
  startingPrice,
  buyNowPrice,
  bidIncrement,
  startDate,
  endDate,
  isStartingNow,
  isSubmitting,
  onBack,
  onSubmit,
}: Readonly<StepAuctionReviewProps>) {
  const cover = product?.images?.find((image) => image.isPrimary) ?? product?.images?.[0];

  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Số lượng", value: `${quantity}` },
    { label: "Giá khởi điểm", value: formatMoney(startingPrice) },
    {
      label: "Bước giá",
      value: bidIncrement ? formatMoney(bidIncrement) : "Theo mặc định hệ thống",
    },
    {
      label: "Giá mua ngay",
      value: buyNowPrice ? formatMoney(buyNowPrice) : "Không đặt",
    },
    {
      label: "Bắt đầu",
      value: isStartingNow
        ? "Ngay khi đăng"
        : format(startDate, "HH:mm EEEE, dd/MM/yyyy", { locale: vi }),
    },
    {
      label: "Kết thúc",
      value: format(endDate, "HH:mm EEEE, dd/MM/yyyy", { locale: vi }),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Xem lại yêu cầu đăng phiên</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Kiểm tra thông tin trước khi gửi. Yêu cầu sẽ được ban quản trị xem xét
          và phê duyệt trước khi phiên chính thức lên sàn.
        </p>
      </div>

      <div className="border border-border bg-muted/40 p-4 text-xs leading-relaxed text-foreground-secondary">
        <strong className="text-foreground">Lưu ý:</strong> Phiên đấu giá chưa chạy ngay.
        Sau khi gửi yêu cầu, ban quản trị sẽ kiểm tra thông tin. Bạn có thể theo dõi
        trạng thái hoặc chỉnh sửa yêu cầu khi còn chờ duyệt tại trang cá nhân.
      </div>

      {product && (
        <div className="flex items-center gap-4 border border-border p-4">
          <span className="relative size-16 shrink-0 overflow-hidden border border-border bg-muted">
            {cover?.imageUrl && (
              <Image
                src={cover.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
                unoptimized
              />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-base font-semibold text-foreground">
              {product.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {product.images?.length ?? 0} ảnh lấy từ sản phẩm
            </span>
          </span>
        </div>
      )}

      <dl className="flex flex-col divide-y divide-border border-y border-border">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
            <dt className="w-40 shrink-0 text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-sm text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center justify-center border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Quay lại
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onSubmit}
          className="inline-flex h-10 items-center justify-center gap-2 bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text"
        >
          {isSubmitting && <Spinner size="xs" tone="onColor" />}
          Gửi yêu cầu đăng phiên
        </button>
      </div>
    </div>
  );
}
