"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ClipboardList } from "lucide-react";

import { LoadingState, Skeleton } from "@/components/common/loading";
import PaginationCustom from "@/components/common/pagination-custom";
import { APP_ROUTES } from "@/constants/routes.constants";
import { cn } from "@/lib/utils";
import {
  useDeleteAuctionRequest,
  useMyAuctionRequests,
  type AuctionRequest,
  type AuctionRequestStatus,
} from "@/services/auction-request";

import AuctionRequestCard from "./_components/AuctionRequestCard";
import EditAuctionRequestDialog from "./_components/EditAuctionRequestDialog";

type StatusFilter = AuctionRequestStatus | "all";

const FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Bị từ chối" },
  { value: "cancelled", label: "Đã rút" },
];

const LIMIT = 10;

export default function MyAuctionRequestsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editingRequest, setEditingRequest] = useState<AuctionRequest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const queryParams = {
    page,
    limit: LIMIT,
    ...(filter !== "all" ? { status: filter } : {}),
  };

  const { data, isLoading, isError, refetch } = useMyAuctionRequests(queryParams);
  const deleteMutation = useDeleteAuctionRequest();

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  const handleFilterChange = (nextFilter: StatusFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    deleteMutation.mutate(id, {
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Yêu cầu đăng phiên
          </h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Danh sách yêu cầu mở phiên đấu giá đã nộp cho ban quản trị xét duyệt.
          </p>
        </div>

        <Link
          href={APP_ROUTES.AUCTION_NEW}
          className="inline-flex h-10 items-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <Plus className="size-4" />
          Tạo yêu cầu mới
        </Link>
      </header>

      {/* Filter Tabs */}
      <nav aria-label="Bộ lọc trạng thái" className="flex flex-wrap gap-2 border-b border-border pb-4">
        {FILTERS.map((tab) => {
          const isActive = filter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleFilterChange(tab.value)}
              className={cn(
                "border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground-secondary hover:bg-accent hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <LoadingState
        isLoading={isLoading}
        isError={isError}
        isEmpty={items.length === 0}
        onRetry={() => refetch()}
        loadingFallback={
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        }
        emptyFallback={
          <div className="flex flex-col items-center justify-center border border-dashed border-border p-12 text-center">
            <ClipboardList className="size-12 text-muted-foreground/60" />
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {filter === "all"
                ? "Bạn chưa có yêu cầu đăng phiên nào"
                : `Không có yêu cầu nào ở trạng thái "${FILTERS.find((f) => f.value === filter)?.label}"`}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tạo yêu cầu đăng phiên đấu giá để đưa sản phẩm trong kho lên sàn đấu giá.
            </p>
            <Link
              href={APP_ROUTES.AUCTION_NEW}
              className="mt-4 inline-flex h-9 items-center gap-1.5 bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Plus className="size-3.5" />
              Tạo yêu cầu đầu tiên
            </Link>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {items.map((request) => (
            <AuctionRequestCard
              key={request.id}
              request={request}
              onEdit={(req) => setEditingRequest(req)}
              onDelete={handleDelete}
              isDeleting={deletingId === request.id}
            />
          ))}

          {totalPages > 1 && (
            <PaginationCustom
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      </LoadingState>

      {/* Edit Dialog */}
      <EditAuctionRequestDialog
        request={editingRequest}
        open={Boolean(editingRequest)}
        onOpenChange={(open) => {
          if (!open) setEditingRequest(null);
        }}
      />
    </div>
  );
}
