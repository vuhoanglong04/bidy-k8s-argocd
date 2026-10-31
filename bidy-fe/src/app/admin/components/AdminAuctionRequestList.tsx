"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Pencil,
  Search,
  UserRound,
  XCircle,
} from "lucide-react";

import { APP_ROUTES } from "@/constants/routes.constants";
import {
  useAdminAuctionRequests,
  useApproveAuctionRequest,
  useRejectAuctionRequest,
  useUpdateAdminAuctionRequest,
  type AuctionRequest,
  type AuctionRequestStatus,
  type UpdateAuctionRequestBody,
} from "@/services/auction-request";
import {
  formatCurrency,
  formatDateTime,
  getImageURL,
  getValidNumber,
  getValidText,
  isScheduleExpired,
} from "@/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ImageWithFallback } from "@/components/common/ImageWithFallback";
import PaginationCustom from "@/components/common/pagination-custom";
import { LoadingState, Skeleton } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AdminPanel from "./AdminPanel";
import { AuctionRequestStatusPill } from "./StatusPill";
import { ApproveAuctionRequestDialog } from "./ApproveAuctionRequestDialog";
import { RejectAuctionRequestDialog } from "./RejectAuctionRequestDialog";
import { EditAuctionRequestTermsDialog } from "./EditAuctionRequestTermsDialog";

/** Một dòng thông tin trong panel chi tiết. */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-48 shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm break-words text-foreground">{value}</dd>
    </div>
  );
}

export default function AdminAuctionRequestList() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<AuctionRequestStatus | "all">("pending");
  const [searchInput, setSearchInput] = useState("");
  const { debouncedValue: search } = useDebouncedValue(searchInput, 400);

  // ID đang xem chi tiết
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Dialog states
  const [approvingRequest, setApprovingRequest] = useState<AuctionRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<AuctionRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<AuctionRequest | null>(null);

  // Query API
  const queryParams = useMemo(() => {
    return {
      page,
      limit,
      status: statusFilter === "all" ? undefined : statusFilter,
      search: search.trim() ? search.trim() : undefined,
    };
  }, [page, limit, statusFilter, search]);

  const { data, isPending, isError, error, refetch } = useAdminAuctionRequests(queryParams);

  // Mutations
  const approveMutation = useApproveAuctionRequest();
  const rejectMutation = useRejectAuctionRequest();
  const updateMutation = useUpdateAdminAuctionRequest();

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  // Selected item detail
  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return items.find((item) => item.id === selectedId) ?? null;
  }, [selectedId, items]);

  const handleSaveEdit = (body: UpdateAuctionRequestBody) => {
    if (!editingRequest) return;

    updateMutation.mutate(
      { id: editingRequest.id, body },
      {
        onSuccess: () => {
          setEditingRequest(null);
        },
      }
    );
  };

  const handleApproveConfirm = () => {
    if (!approvingRequest) return;
    approveMutation.mutate(approvingRequest.id, {
      onSuccess: () => {
        setApprovingRequest(null);
      },
    });
  };

  const handleRejectConfirm = (reason: string) => {
    if (!rejectingRequest) return;

    rejectMutation.mutate(
      { id: rejectingRequest.id, reason },
      {
        onSuccess: () => {
          setRejectingRequest(null);
        },
      }
    );
  };

  return (
    <>
      {selectedItem ? (
        // =========================================================================
        // VIEW CHI TIẾT
        // =========================================================================
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedId(null)}
              className="cursor-pointer rounded-none"
            >
              <ArrowLeft size={16} /> Quay lại danh sách
            </Button>
          </div>

          {isScheduleExpired(selectedItem.endDate) && selectedItem.status === "pending" && (
            <div className="flex items-start gap-3 border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Lịch đấu giá đã hết hạn</p>
                <p className="mt-0.5 text-xs text-foreground-secondary">
                  Thời gian kết thúc dự kiến ({formatDateTime(selectedItem.endDate)}) đã ở quá khứ. Vui lòng bấm
                  &quot;Sửa điều khoản&quot; để cập nhật lại thời gian trước khi duyệt yêu cầu.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <AdminPanel title="Chi tiết yêu cầu đăng phiên">
              <dl className="flex flex-col">
                <DetailRow
                  label="Mã yêu cầu (ID)"
                  value={<span className="font-mono text-xs">{selectedItem.id}</span>}
                />
                <DetailRow
                  label="Tên sản phẩm"
                  value={<span className="font-medium">{getValidText(selectedItem.product?.name)}</span>}
                />
                <DetailRow
                  label="Mã sản phẩm (Product ID)"
                  value={<span className="font-mono text-xs">{selectedItem.productId}</span>}
                />
                <DetailRow
                  label="Người bán (Seller ID)"
                  value={
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                      <UserRound size={14} className="text-muted-foreground" />
                      {selectedItem.sellerId}
                    </span>
                  }
                />
                <DetailRow
                  label="Trạng thái"
                  value={<AuctionRequestStatusPill status={selectedItem.status} />}
                />
                <DetailRow
                  label="Số lượng"
                  value={<span className="tabular-nums">{getValidNumber(selectedItem.quantity)}</span>}
                />
                <DetailRow
                  label="Giá khởi điểm"
                  value={
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(selectedItem.startingPrice)}
                    </span>
                  }
                />
                <DetailRow
                  label="Giá mua ngay"
                  value={
                    <span className="tabular-nums">
                      {selectedItem.buyNowPrice !== null ? formatCurrency(selectedItem.buyNowPrice) : "—"}
                    </span>
                  }
                />
                <DetailRow
                  label="Giá bảo lưu (Reserve)"
                  value={
                    <span className="tabular-nums">
                      {selectedItem.reservePrice !== null ? formatCurrency(selectedItem.reservePrice) : "—"}
                    </span>
                  }
                />
                <DetailRow
                  label="Bước giá (Bid increment)"
                  value={
                    <span className="tabular-nums">
                      {selectedItem.bidIncrement !== null ? formatCurrency(selectedItem.bidIncrement) : "—"}
                    </span>
                  }
                />
                <DetailRow
                  label="Bắt đầu dự kiến"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={14} className="text-muted-foreground" />
                      {formatDateTime(selectedItem.startDate)}
                    </span>
                  }
                />
                <DetailRow
                  label="Kết thúc dự kiến"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={14} className="text-muted-foreground" />
                      {formatDateTime(selectedItem.endDate)}
                      {isScheduleExpired(selectedItem.endDate) && selectedItem.status === "pending" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                          (Đã hết hạn)
                        </span>
                      )}
                    </span>
                  }
                />
                <DetailRow
                  label="Thời gian nộp"
                  value={
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Clock size={14} />
                      {formatDateTime(selectedItem.createdAt)}
                    </span>
                  }
                />

                {selectedItem.status === "rejected" && selectedItem.rejectReason && (
                  <DetailRow
                    label="Lý do từ chối"
                    value={
                      <div className="border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                        {selectedItem.rejectReason}
                      </div>
                    }
                  />
                )}

                {selectedItem.status === "approved" && selectedItem.auctionId && (
                  <DetailRow
                    label="Phiên đấu giá"
                    value={
                      <Link
                        href={APP_ROUTES.PRODUCT_DETAIL(selectedItem.auctionId)}
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        Xem phiên đấu giá #{selectedItem.auctionId} <ExternalLink size={14} />
                      </Link>
                    }
                  />
                )}

                {selectedItem.reviewedBy && (
                  <DetailRow
                    label="Người duyệt"
                    value={<span className="font-mono text-xs">{selectedItem.reviewedBy}</span>}
                  />
                )}
                {selectedItem.reviewedAt && (
                  <DetailRow
                    label="Thời gian duyệt/từ chối"
                    value={formatDateTime(selectedItem.reviewedAt)}
                  />
                )}
              </dl>
            </AdminPanel>

            <div className="flex flex-col gap-5">
              <AdminPanel title="Hình ảnh sản phẩm">
                {selectedItem.product?.primaryImage ? (
                  <div className="relative aspect-square overflow-hidden border border-border bg-muted">
                    <ImageWithFallback
                      src={getImageURL(selectedItem.product.primaryImage)}
                      alt={getValidText(selectedItem.product.name)}
                      fill
                      sizes="360px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Yêu cầu này chưa có hình ảnh.
                  </p>
                )}
              </AdminPanel>

              {selectedItem.status === "pending" && (
                <AdminPanel title="Hành động duyệt">
                  <div className="flex flex-col gap-2.5">
                    <Button
                      variant="default"
                      className="w-full cursor-pointer rounded-none"
                      onClick={() => setApprovingRequest(selectedItem)}
                    >
                      <CheckCircle2 size={16} /> Duyệt yêu cầu
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full cursor-pointer rounded-none border-border"
                      onClick={() => setEditingRequest(selectedItem)}
                    >
                      <Pencil size={16} /> Sửa điều khoản / Lịch
                    </Button>

                    <Button
                      variant="destructive"
                      className="w-full cursor-pointer rounded-none"
                      onClick={() => setRejectingRequest(selectedItem)}
                    >
                      <XCircle size={16} /> Từ chối yêu cầu
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Lưu ý: Thao tác duyệt sẽ kiểm tra lại điều kiện sản phẩm trên hệ thống.
                  </p>
                </AdminPanel>
              )}
            </div>
          </div>
        </div>
      ) : (
        // =========================================================================
        // VIEW DANH SÁCH
        // =========================================================================
        <div className="flex flex-col gap-5">
          <AdminPanel
            title="Hàng đợi duyệt phiên đấu giá"
            description={
              pagination
                ? `Trang ${pagination.page}/${Math.max(pagination.totalPages, 1)} · Tổng số ${pagination.totalItems} yêu cầu`
                : "Hàng đợi yêu cầu đăng phiên đấu giá cần xét duyệt"
            }
            action={
              <div className="flex flex-wrap items-center gap-3">
                {/* Bộ lọc trạng thái */}
                <Select
                  value={statusFilter}
                  onValueChange={(val) => {
                    setStatusFilter(val as AuctionRequestStatus | "all");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-40 rounded-none bg-background">
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="pending">Chờ duyệt</SelectItem>
                    <SelectItem value="approved">Đã duyệt</SelectItem>
                    <SelectItem value="rejected">Bị từ chối</SelectItem>
                    <SelectItem value="cancelled">Đã rút</SelectItem>
                    <SelectItem value="all">Tất cả</SelectItem>
                  </SelectContent>
                </Select>

                {/* Ô tìm kiếm */}
                <div className="relative w-full sm:w-64">
                  <Search
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Tìm sản phẩm, ID…"
                    className="rounded-none pl-9"
                  />
                </div>
              </div>
            }
            flush
          >
            <LoadingState
              isLoading={isPending}
              isError={isError}
              error={error}
              isEmpty={!isPending && items.length === 0}
              onRetry={refetch}
              emptyMessage={
                statusFilter === "pending"
                  ? "Không có yêu cầu nào chờ duyệt."
                  : "Không tìm thấy yêu cầu nào khớp bộ lọc."
              }
              loadingFallback={
                <div className="flex flex-col gap-2 p-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 py-2">
                      <Skeleton className="size-10 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
                </div>
              }
            >
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Sản phẩm</TableHead>
                    <TableHead>Người bán</TableHead>
                    <TableHead className="text-right">Giá khởi điểm</TableHead>
                    <TableHead>Lịch dự kiến</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày nộp</TableHead>
                    <TableHead className="pr-5 text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((req) => {
                    const isPendingReq = req.status === "pending";
                    const expired = isScheduleExpired(req.endDate);

                    return (
                      <TableRow
                        key={req.id}
                        className="hover:bg-muted/40 cursor-pointer"
                        onClick={() => setSelectedId(req.id)}
                      >
                        {/* Sản phẩm */}
                        <TableCell className="pl-5">
                          <div className="flex items-center gap-3">
                            <div className="relative size-10 shrink-0 overflow-hidden bg-muted">
                              <ImageWithFallback
                                src={getImageURL(req.product?.primaryImage ?? undefined)}
                                alt={getValidText(req.product?.name)}
                                fill
                                sizes="40px"
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                            <div className="flex min-w-0 flex-col">
                              <span className="max-w-64 truncate font-medium text-foreground">
                                {getValidText(req.product?.name)}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">
                                SL: {req.quantity} · ID: {req.id}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Người bán */}
                        <TableCell className="text-muted-foreground">
                          <span className="flex items-center gap-1.5 font-mono text-xs">
                            <UserRound size={14} className="text-muted-foreground shrink-0" />
                            {req.sellerId}
                          </span>
                        </TableCell>

                        {/* Giá khởi điểm */}
                        <TableCell className="text-right tabular-nums font-semibold text-foreground">
                          {formatCurrency(req.startingPrice)}
                        </TableCell>

                        {/* Lịch dự kiến */}
                        <TableCell>
                          <div className="flex flex-col text-xs text-muted-foreground">
                            <span>{formatDateTime(req.startDate)}</span>
                            <span>→ {formatDateTime(req.endDate)}</span>
                            {expired && isPendingReq && (
                              <span className="mt-1 inline-flex items-center gap-1 font-medium text-warning">
                                <AlertTriangle size={12} className="shrink-0" /> Lịch đã hết hạn
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Trạng thái */}
                        <TableCell>
                          <AuctionRequestStatusPill status={req.status} />
                        </TableCell>

                        {/* Ngày nộp */}
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(req.createdAt)}
                        </TableCell>

                        {/* Thao tác */}
                        <TableCell className="pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isPendingReq ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-8 px-2.5 cursor-pointer rounded-none text-xs"
                                  title="Duyệt yêu cầu"
                                  onClick={() => setApprovingRequest(req)}
                                >
                                  <CheckCircle2 size={14} /> Duyệt
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2.5 cursor-pointer rounded-none text-xs border-border"
                                  title="Sửa điều khoản"
                                  onClick={() => setEditingRequest(req)}
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 px-2.5 cursor-pointer rounded-none text-xs"
                                  title="Từ chối yêu cầu"
                                  onClick={() => setRejectingRequest(req)}
                                >
                                  <XCircle size={14} />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2.5 cursor-pointer rounded-none text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setSelectedId(req.id)}
                              >
                                <Eye size={14} /> Chi tiết
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Phân trang */}
              {totalPages > 1 && (
                <div className="border-t border-border px-5 py-3">
                  <PaginationCustom
                    totalPages={totalPages}
                    currentPage={page}
                    onPageChange={(p) => setPage(p)}
                  />
                </div>
              )}
            </LoadingState>
          </AdminPanel>
        </div>
      )}

      {/* Shared Dialogs */}
      <ApproveAuctionRequestDialog
        request={approvingRequest}
        open={Boolean(approvingRequest)}
        onOpenChange={(open) => !open && setApprovingRequest(null)}
        onConfirm={handleApproveConfirm}
        isPending={approveMutation.isPending}
      />

      <RejectAuctionRequestDialog
        request={rejectingRequest}
        open={Boolean(rejectingRequest)}
        onOpenChange={(open) => !open && setRejectingRequest(null)}
        onConfirm={handleRejectConfirm}
        isPending={rejectMutation.isPending}
      />

      <EditAuctionRequestTermsDialog
        request={editingRequest}
        open={Boolean(editingRequest)}
        onOpenChange={(open) => !open && setEditingRequest(null)}
        onConfirm={handleSaveEdit}
        isPending={updateMutation.isPending}
      />
    </>
  );
}
