"use client";

import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, LayoutGrid, List } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_AUCTIONS } from "@/constants";
import { cn } from "@/lib/utils";

export type SortOption = "name" | "price" | "date" | "status";
export type SortOrder = "asc" | "desc";
export type ProductView = "list" | "grid";

interface ProductToolbarProps {
  isSeller: boolean;
  productTab: string;
  setProductTab: (tab: string) => void;
  sortBy: SortOption;
  sortOrder: SortOrder;
  handleSort: (option: SortOption) => void;
  view: ProductView;
  setView: (view: ProductView) => void;
  count: number;
}

const SELLER_TABS = [
  { value: STATUS_AUCTIONS.HAPPENING, label: "Đang đấu giá" },
  { value: STATUS_AUCTIONS.ENDED, label: "Đã kết thúc" },
  { value: STATUS_AUCTIONS.INITIAL, label: "Sắp bắt đầu" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "date", label: "Ngày" },
  { value: "name", label: "Tên sản phẩm" },
  { value: "price", label: "Giá" },
  { value: "status", label: "Trạng thái" },
];

/** Một thanh duy nhất: lọc trạng thái bên trái, sắp xếp và kiểu hiển thị bên phải. */
const ProductToolbar: React.FC<Readonly<ProductToolbarProps>> = ({
  isSeller,
  productTab,
  setProductTab,
  sortBy,
  sortOrder,
  handleSort,
  view,
  setView,
  count,
}) => {
  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? "Ngày";

  return (
    <div className="flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {isSeller ? (
          SELLER_TABS.map((item) => {
            const active = productTab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setProductTab(item.value)}
                className={cn(
                  "cursor-pointer px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-foreground-secondary hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            );
          })
        ) : (
          <span className="px-1 text-sm font-medium text-foreground">
            Sản phẩm đã mua
          </span>
        )}
        <span className="px-2 text-sm text-foreground-secondary tabular-nums">
          {count} sản phẩm
        </span>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-9 cursor-pointer items-center gap-2 border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent">
            <ArrowUpDown className="size-4" aria-hidden />
            <span>Sắp xếp: {sortLabel}</span>
            {sortOrder === "asc" ? (
              <ArrowUp className="size-3.5 text-primary" aria-hidden />
            ) : (
              <ArrowDown className="size-3.5 text-primary" aria-hidden />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => handleSort(option.value)}
                className="justify-between"
              >
                <span>{option.label}</span>
                {sortBy === option.value && (
                  <span className="text-primary">
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden border border-border md:flex">
          <button
            type="button"
            aria-label="Xem dạng danh sách"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={cn(
              "cursor-pointer p-2 transition-colors",
              view === "list"
                ? "bg-foreground text-background"
                : "text-foreground-secondary hover:text-foreground"
            )}
          >
            <List className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Xem dạng lưới"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={cn(
              "cursor-pointer p-2 transition-colors",
              view === "grid"
                ? "bg-foreground text-background"
                : "text-foreground-secondary hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductToolbar;
