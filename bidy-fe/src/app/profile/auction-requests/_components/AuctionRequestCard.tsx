"use client";

import Link from "next/link";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";

import { ImageWithFallback } from "@/components/common/ImageWithFallback";
import ConfirmationDialog from "@/components/common/confirmation-dialog";
import { Spinner } from "@/components/common/loading";
import { APP_ROUTES } from "@/constants/routes.constants";
import { cn } from "@/lib/utils";
import type {
  AuctionRequest,
  AuctionRequestStatus,
} from "@/services/auction-request";

interface AuctionRequestCardProps {
  request: AuctionRequest;
  onEdit: (request: AuctionRequest) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

const STATUS_CONFIG: Record<
  AuctionRequestStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Chờ duyệt",
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  approved: {
    label: "Đã duyệt",
    className: "border-success/30 bg-success/10 text-success",
  },
  rejected: {
    label: "Bị từ chối",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  cancelled: {
    label: "Đã rút",
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

const formatMoney = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "HH:mm dd/MM/yyyy", { locale: vi });
  } catch {
    return dateStr;
  }
};

export default function AuctionRequestCard({
  request,
  onEdit,
  onDelete,
  isDeleting = false,
}: Readonly<AuctionRequestCardProps>) {
  const statusInfo = STATUS_CONFIG[request.status] ?? {
    label: request.status,
    className: "border-border bg-muted text-muted-foreground",
  };

  const primaryImage = request.product?.primaryImage ?? null;
  const productName = request.product?.name ?? "Sản phẩm";

  return (
    <article className="flex flex-col border border-border bg-card p-4 transition-colors hover:border-foreground/20 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4 min-w-0">
          <div className="relative size-20 shrink-0 overflow-hidden border border-border bg-muted sm:size-24">
            <ImageWithFallback
              src={primaryImage}
              alt={productName}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 80px, 96px"
              unoptimized
            />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center border px-2 py-0.5 text-xs font-semibold",
                  statusInfo.className
                )}
              >
                {statusInfo.label}
              </span>
              <span className="text-xs text-muted-foreground">
                Mã yêu cầu: #{request.id}
              </span>
            </div>

            <h2 className="truncate text-base font-semibold text-foreground">
              {productName}
            </h2>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-secondary">
              <span>
                Số lượng: <strong className="text-foreground">{request.quantity}</strong>
              </span>
              <span>
                Giá khởi điểm:{" "}
                <strong className="text-foreground">{formatMoney(request.startingPrice)}</strong>
              </span>
              {request.buyNowPrice != null && (
                <span>
                  Mua ngay:{" "}
                  <strong className="text-foreground">{formatMoney(request.buyNowPrice)}</strong>
                </span>
              )}
              {request.bidIncrement != null && (
                <span>
                  Bước giá:{" "}
                  <strong className="text-foreground">{formatMoney(request.bidIncrement)}</strong>
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Lịch: {formatDate(request.startDate)} → {formatDate(request.endDate)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-2 sm:self-start">
          {request.status === "pending" && (
            <>
              <button
                type="button"
                onClick={() => onEdit(request)}
                className="inline-flex h-8 items-center gap-1.5 border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Pencil className="size-3.5" />
                Sửa
              </button>

              <ConfirmationDialog
                trigger={
                  <button
                    type="button"
                    disabled={isDeleting}
                    className="inline-flex h-8 items-center gap-1.5 border border-destructive/30 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Spinner size="xs" tone="destructive" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Rút lại
                  </button>
                }
                title="Rút lại yêu cầu đăng phiên?"
                description="Bạn có chắc chắn muốn rút lại yêu cầu này không? Hành động này không thể hoàn tác."
                confirmText="Rút lại yêu cầu"
                cancelText="Giữ lại"
                confirmButtonClassName="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onConfirm={() => onDelete(request.id)}
              />
            </>
          )}

          {request.status === "approved" && request.auctionId && (
            <Link
              href={APP_ROUTES.PRODUCT_DETAIL(request.auctionId)}
              className="inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <ExternalLink className="size-3.5" />
              Xem phiên
            </Link>
          )}
        </div>
      </div>

      {/* Reject Reason Display */}
      {request.status === "rejected" && (
        <div className="mt-3 border-l-2 border-destructive bg-destructive/10 p-3 text-xs text-destructive">
          <p className="font-semibold">Lý do từ chối:</p>
          <p className="mt-0.5 whitespace-pre-wrap">
            {request.rejectReason || "Ban quản trị từ chối yêu cầu đăng phiên này."}
          </p>
        </div>
      )}
    </article>
  );
}
