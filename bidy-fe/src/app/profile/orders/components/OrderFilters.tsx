"use client";

import { cn } from "@/lib/utils";

interface OrderFiltersProps {
  filterStatus: "all" | "pending" | "paid";
  onFilterChange: (status: "all" | "pending" | "paid") => void;
  sortBy: "deadline" | "price" | "date";
  onSortChange: (sort: "deadline" | "price" | "date") => void;
  counts: {
    all: number;
    pending: number;
    paid: number;
  };
}

const TABS = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ thanh toán" },
  { value: "paid", label: "Đã thanh toán" },
] as const;

export default function OrderFilters({
  filterStatus,
  onFilterChange,
  sortBy,
  onSortChange,
  counts
}: OrderFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={filterStatus === tab.value}
            onClick={() => onFilterChange(tab.value)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              filterStatus === tab.value
                ? "bg-primary text-primary-foreground"
                : "text-foreground-secondary hover:bg-accent"
            )}
          >
            {tab.label} ({counts[tab.value]})
          </button>
        ))}
      </div>

      {/* Sort Options */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="order-sort"
          className="text-sm text-foreground-secondary"
        >
          Sắp xếp:
        </label>
        <select
          id="order-sort"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as "deadline" | "price" | "date")}
          className="h-9 border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="deadline">Thời hạn thanh toán</option>
          <option value="price">Giá tiền</option>
          <option value="date">Ngày thắng đấu giá</option>
        </select>
      </div>
    </div>
  );
}