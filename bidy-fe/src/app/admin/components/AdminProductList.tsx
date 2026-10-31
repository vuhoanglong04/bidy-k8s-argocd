"use client";

import React, { useState, useCallback } from "react";
import { ImageWithFallback } from "@/components/common/ImageWithFallback";
import { ArrowLeft, Ban, Search, UserRound } from "lucide-react";
import debounce from "lodash.debounce";

import { AdminAuction } from "@/types";
import {
  formatCurrency,
  formatDateTime,
  getImageURL,
  getValidNumber,
  getValidText,
} from "@/utils";
import PaginationCustom from "@/components/common/pagination-custom";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { useCancelAdminAuction } from "@/services/admin";
import { cn } from "@/lib/utils";
import AdminPanel from "./AdminPanel";
import { AuctionStatusPill } from "./StatusPill";

interface AdminProductListProps {
  selectedAuctionId?: string | null;
  setSelectedAuctionId?: (id: string | null) => void;
  paramsProduct: {
    page: number;
    limit: number;
    search: string;
  };
  setParamsProduct: (u: { page: number; limit: number; search: string }) => void;
  currentPageProduct: number;
  totalPagesProducts: number;
  products: AdminAuction[];
}

/** Một dòng thông tin trong panel chi tiết. */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-44 shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm break-words text-foreground">{value}</dd>
    </div>
  );
}

export default function AdminProductList({
  selectedAuctionId,
  setSelectedAuctionId,
  paramsProduct,
  setParamsProduct,
  currentPageProduct,
  totalPagesProducts,
  products,
}: AdminProductListProps) {
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const cancelAuctionMutation = useCancelAdminAuction();

  const activeAuctionId =
    selectedAuctionId !== undefined ? selectedAuctionId : localSelectedId;
  const selected = activeAuctionId
    ? products?.find((a) => a.id === activeAuctionId) ?? null
    : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSearch = useCallback(
    debounce((value: string) => {
      setParamsProduct({ ...paramsProduct, search: value, page: 1 });
    }, 500),
    [paramsProduct, setParamsProduct]
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSearch(e.target.value);
  };

  const handleBack = () => {
    if (setSelectedAuctionId) setSelectedAuctionId(null);
    else setLocalSelectedId(null);
  };

  const handleSelect = (id: string) => {
    if (setSelectedAuctionId) setSelectedAuctionId(id);
    else setLocalSelectedId(id);
  };

  // ---------- Chi tiết ----------
  if (selected) {
    const isCancellable =
      selected.status === "pending" || selected.status === "happening";

    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="cursor-pointer rounded-none"
          >
            <ArrowLeft size={16} /> Quay lại danh sách
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <AdminPanel title="Thông tin phiên đấu giá">
            <dl className="flex flex-col">
              <DetailRow
                label="Tên sản phẩm"
                value={getValidText(selected.product?.name)}
              />
              <DetailRow
                label="Danh mục"
                value={getValidText(selected.category?.name)}
              />
              <DetailRow
                label="Chủ phiên"
                value={getValidText(selected.seller?.fullname)}
              />
              <DetailRow
                label="Trạng thái"
                value={<AuctionStatusPill status={selected.status} />}
              />
              <DetailRow
                label="Giá khởi điểm"
                value={
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(selected.startingPrice)}
                  </span>
                }
              />
              <DetailRow
                label="Giá hiện tại"
                value={
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(selected.currentPrice)}
                  </span>
                }
              />
              <DetailRow
                label="Giá mua nhanh"
                value={
                  <span className="font-semibold tabular-nums">
                    {selected.buyNowPrice !== null
                      ? formatCurrency(selected.buyNowPrice)
                      : "—"}
                  </span>
                }
              />
              <DetailRow
                label="Người tham gia"
                value={
                  <span className="tabular-nums">
                    {getValidNumber(selected.bidderCount)}
                  </span>
                }
              />
              <DetailRow
                label="Lượt đấu giá"
                value={
                  <span className="tabular-nums">
                    {getValidNumber(selected.totalBids)}
                  </span>
                }
              />
              <DetailRow
                label="Số lượng"
                value={
                  <span className="tabular-nums">
                    {getValidNumber(selected.quantity)}
                  </span>
                }
              />
              <DetailRow
                label="Thời gian bắt đầu"
                value={formatDateTime(selected.startDate)}
              />
              <DetailRow
                label="Thời gian kết thúc"
                value={formatDateTime(selected.endDate)}
              />
            </dl>
          </AdminPanel>

          <div className="flex flex-col gap-5">
            <AdminPanel title="Hình ảnh">
              {selected.product?.primaryImage ? (
                <div className="relative aspect-square overflow-hidden border border-border bg-muted">
                  <ImageWithFallback
                    src={getImageURL(selected.product.primaryImage)}
                    alt={getValidText(selected.product.name)}
                    fill
                    sizes="360px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Phiên đấu giá này chưa có hình ảnh.
                </p>
              )}
            </AdminPanel>

            {isCancellable && (
              <AdminPanel title="Hành động">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full cursor-pointer rounded-none"
                      disabled={cancelAuctionMutation.isPending}
                    >
                      <Ban size={16} /> Huỷ phiên đấu giá
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-none">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Xác nhận huỷ phiên đấu giá?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Thao tác này sẽ huỷ phiên đấu giá &quot;
                        {getValidText(selected.product?.name)}
                        &quot;. Hành động này không thể hoàn tác.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-none">
                        Đóng
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className={cn(
                          buttonVariants({ variant: "destructive" }),
                          "rounded-none"
                        )}
                        onClick={() => cancelAuctionMutation.mutate(selected.id)}
                      >
                        Xác nhận huỷ
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <p className="mt-2 text-xs text-muted-foreground">
                  Thao tác này sẽ chuyển trạng thái phiên thành đã huỷ và không thể
                  hoàn tác.
                </p>
              </AdminPanel>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Danh sách ----------
  return (
    <AdminPanel
      title="Danh sách phiên đấu giá"
      description={`Trang ${currentPageProduct}/${Math.max(totalPagesProducts, 1)}`}
      action={
        <div className="relative w-full sm:w-72">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            onChange={onChange}
            defaultValue={paramsProduct.search}
            placeholder="Tìm theo tên sản phẩm…"
            className="rounded-none pl-9"
          />
        </div>
      }
      flush
    >
      {products?.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Sản phẩm</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead className="text-right">Giá khởi điểm</TableHead>
                <TableHead className="text-right">Mua ngay</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Chủ phiên</TableHead>
                <TableHead className="pr-5 text-right">Kết thúc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p: AdminAuction) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => handleSelect(p.id)}
                >
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-3">
                      <div className="relative size-10 shrink-0 overflow-hidden bg-muted">
                        <ImageWithFallback
                          src={getImageURL(p.product?.primaryImage ?? undefined)}
                          alt={getValidText(p.product?.name)}
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <span className="max-w-56 truncate font-medium">
                        {getValidText(p.product?.name)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getValidText(p.category?.name)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(p.startingPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.buyNowPrice !== null
                      ? formatCurrency(p.buyNowPrice)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <AuctionStatusPill status={p.status} />
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <UserRound size={14} />
                      {getValidText(p.seller?.fullname)}
                    </span>
                  </TableCell>
                  <TableCell className="pr-5 text-right text-muted-foreground">
                    {formatDateTime(p.endDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="border-t border-border px-5 py-3">
            <PaginationCustom
              totalPages={totalPagesProducts}
              currentPage={currentPageProduct}
              onPageChange={(p) =>
                setParamsProduct({ ...paramsProduct, page: p })
              }
            />
          </div>
        </>
      ) : (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
          Không tìm thấy phiên đấu giá nào khớp bộ lọc.
        </p>
      )}
    </AdminPanel>
  );
}
