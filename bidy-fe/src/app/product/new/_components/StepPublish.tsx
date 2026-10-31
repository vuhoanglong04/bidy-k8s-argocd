"use client";

import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";

import { Spinner } from "@/components/common/loading";
import { APP_ROUTES } from "@/constants/routes.constants";
import { PRODUCT_CONDITION_LABELS } from "@/constants/app.enum";
import type { ProductInfoForm } from "@/app/product/new/schema";

interface StepPublishProps {
  info: ProductInfoForm;
  categoryName?: string;
  imageCount: number;
  /** Sản phẩm đã đăng bán rồi thì bước này chuyển sang mở phiên đấu giá. */
  isPublished?: boolean;
  isPublishing: boolean;
  /** Vào từ nút "Sửa": mọi thay đổi đã lưu theo từng bước, nút thoát không phải "lưu nháp". */
  isEditing?: boolean;
  onBack: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}

export default function StepPublish({
  info,
  categoryName,
  imageCount,
  isPublished = false,
  isPublishing,
  isEditing = false,
  onBack,
  onSaveDraft,
  onPublish,
}: Readonly<StepPublishProps>) {
  // Backend từ chối publish khi chưa có ảnh (422) — nói trước thay vì để user
  // bấm rồi ăn lỗi.
  const canPublish = imageCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Đăng bán</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Kiểm tra lại rồi chọn việc tiếp theo. Sản phẩm đã đăng bán vẫn nằm
          trong kho, bạn có thể mở phiên đấu giá bất cứ lúc nào.
        </p>
      </div>

      <dl className="flex flex-col divide-y divide-border border-y border-border">
        {[
          { label: "Tên sản phẩm", value: info.name },
          { label: "Danh mục", value: categoryName ?? "—" },
          { label: "Tình trạng", value: PRODUCT_CONDITION_LABELS[info.condition] },
          { label: "Mô tả", value: info.description?.trim() || "Chưa có" },
          { label: "Hình ảnh", value: `${imageCount} ảnh` },
        ].map((row) => (
          <div key={row.label} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
            <dt className="w-40 shrink-0 text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-sm text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>

      {!canPublish && (
        <p className="flex items-start gap-2 border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          Chưa có ảnh nên chưa đăng bán được. Bạn vẫn lưu nháp được và quay lại
          bổ sung sau.
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center justify-center border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Quay lại
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          className="inline-flex h-10 items-center justify-center border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          {isEditing ? "Xong, quay lại kho hàng" : "Lưu nháp, để sau"}
        </button>
        <button
          type="button"
          disabled={!canPublish || isPublishing}
          onClick={onPublish}
          className="inline-flex h-10 items-center justify-center gap-2 bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text"
        >
          {isPublishing ? (
            <Spinner size="xs" tone="onColor" />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {/* Hàng đã đăng bán rồi thì bấm nữa không "đăng" thêm gì — việc còn
              lại là mở phiên đấu giá, đúng chỗ nút này dẫn tới. */}
          {isPublished ? "Mở phiên đấu giá" : "Đăng bán"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Muốn bán đấu giá thay vì bán thường?{" "}
        <Link href={APP_ROUTES.AUCTION_NEW} className="text-primary underline">
          Mở phiên đấu giá
        </Link>{" "}
        sau khi đăng bán sản phẩm này.
      </p>
    </div>
  );
}
