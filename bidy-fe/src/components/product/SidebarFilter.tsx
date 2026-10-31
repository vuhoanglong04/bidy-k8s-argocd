"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { getActiveCategories } from "@/constants/categories.constants";
import { StaticCategory } from "@/types/category.types";
import MoneyInput from "@/components/ui/MoneyInput";

// Removed unnecessary BRANDS and CONDITIONS arrays - focusing on core functionality

export interface FilterState {
  selectedCategories: string[];
  priceFrom: string;
  priceTo: string;
  search: string;
  sort?: string;
}

interface SidebarFilterProps {
  filterState: FilterState;
  updateFilter: (field: keyof FilterState, value: string | string[]) => void;
  resetFilters: () => void;
}


const SORT_OPTIONS = [
  { label: "Mới nhất", value: "newest" },
  { label: "Giá tăng dần", value: "price-asc" },
  { label: "Giá giảm dần", value: "price-desc" },
  { label: "Sắp kết thúc", value: "ending-soon" },
];

const FilterContent = React.memo(function FilterContent({
  filterState,
  updateFilter,
  resetFilters,
  handleCheckbox,
  isMobile = false,
  onClose,
}: {
  filterState: FilterState;
  updateFilter: (field: keyof FilterState, value: string | string[]) => void;
  resetFilters: () => void;
  handleCheckbox: (field: keyof FilterState, value: string) => void;
  isMobile?: boolean;
  onClose?: () => void;
}) {
  // Get static categories
  const activeCategories = getActiveCategories();

  return (
    <aside className={`w-full ${isMobile ? 'max-w-full' : 'max-w-[320px]'} flex-shrink-0 flex flex-col gap-6`}>
      {/* Bộ lọc */}
      <div className="flex flex-col gap-6">
        {/* Sort Options */}
        <div>
          <div className="font-roboto font-semibold text-base mb-2 text-foreground">
            Sắp xếp
          </div>
          <div className="bg-card border border-border rounded-lg shadow-md p-2 flex flex-col gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`w-full text-left rounded-lg px-3 py-2 font-inter text-sm border transition-colors ${
                  filterState.sort === opt.value
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-background text-foreground border-border hover:bg-secondary/50"
                }`}
                onClick={() => updateFilter("sort", opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div>
          <div className="font-roboto font-semibold text-base mb-2 text-foreground">
            Tìm kiếm
          </div>
          <div className="flex items-center bg-card border-2 border-border rounded-lg px-3 py-2.5 focus-within:border-primary transition-colors">
            <input
              type="text"
              className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground text-base"
              placeholder="Nhập từ khoá..."
              value={filterState.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              inputMode="text"
            />
            <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
              <circle
                cx="9"
                cy="9"
                r="7"
                stroke="var(--foreground)"
                strokeWidth="2"
              />
              <line
                x1="14.5"
                y1="14.5"
                x2="19"
                y2="19"
                stroke="var(--foreground)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
        
        {/* Category from API */}
        <div>
          <div className="font-roboto font-semibold text-base mb-2 text-foreground">
            Danh mục sản phẩm
          </div>
          <div className="bg-card border border-border rounded-lg shadow-md p-2 flex flex-col gap-2 max-h-64 overflow-y-auto">
            {activeCategories.length > 0 ? (
              activeCategories.map((cat: StaticCategory) => (
                <label
                  key={cat.id}
                  className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-secondary/50 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filterState.selectedCategories.includes(cat.slug)}
                    onChange={() => handleCheckbox("selectedCategories", cat.slug)}
                    className="accent-primary w-5 h-5 rounded border border-border"
                  />
                  <span className="text-foreground text-sm font-inter line-clamp-1" title={cat.displayName}>
                    {cat.displayName}
                  </span>
                </label>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                Không có danh mục
              </p>
            )}
          </div>
        </div>
        
        {/* Price Range */}
        <div>
          <div className="font-roboto w-full font-semibold text-base mb-2 text-foreground">
            Khoảng giá
          </div>
          <div className="flex flex-col gap-2 w-full">
            <MoneyInput
              value={filterState.priceFrom}
              onChange={(formatted) => updateFilter("priceFrom", formatted)}
              placeholder="Từ"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-base text-foreground placeholder-muted h-auto"
            />
            <MoneyInput
              value={filterState.priceTo}
              onChange={(formatted) => updateFilter("priceTo", formatted)}
              placeholder="Tới"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-base text-foreground placeholder-muted h-auto"
            />
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {/* Clear Filters Button */}
          {(filterState.selectedCategories.length > 0 ||
            filterState.priceFrom ||
            filterState.priceTo ||
            filterState.search ||
            filterState.sort) && (
            <button
              className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium"
              onClick={resetFilters}
            >
              Xóa bộ lọc
            </button>
          )}

          {/* Apply button for mobile */}
          {isMobile && onClose && (
            <button
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold"
              onClick={onClose}
            >
              Áp dụng
            </button>
          )}
        </div>
      </div>
    </aside>
  );
});

const SidebarFilter: React.FC<SidebarFilterProps> = React.memo(function SidebarFilter({
  filterState,
  updateFilter,
  resetFilters,
}: SidebarFilterProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  /**
   * Handles checkbox state changes for multi-select filters
   * @param field - Filter field to update
   * @param value - Value to toggle in the array
   */
  const handleCheckbox = (field: keyof FilterState, value: string) => {
    const currentArray = filterState[field] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter((v) => v !== value)
      : [...currentArray, value];

    updateFilter(field, newArray);
  };

  return (
    <>
      {/* Mobile Filter Button */}
      <button
        className="lg:hidden w-full mb-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold"
        onClick={() => setIsMobileOpen(true)}
      >
        Bộ lọc
      </button>

      {/* Mobile Modal - Bottom Sheet Style */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsMobileOpen(false);
            }
          }}
        >
          <div className="bg-background rounded-t-2xl shadow-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border bg-card shrink-0">
              <h3 className="text-lg font-semibold text-foreground">Bộ lọc & Sắp xếp</h3>
              <button
                className="p-1 hover:bg-secondary rounded-lg transition-colors"
                onClick={() => setIsMobileOpen(false)}
                aria-label="Đóng bộ lọc"
              >
                <X className="w-6 h-6 text-foreground" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto flex-1 p-4 overscroll-contain">
              <FilterContent
                filterState={filterState}
                handleCheckbox={handleCheckbox}
                updateFilter={updateFilter}
                resetFilters={resetFilters}
                isMobile={true}
                onClose={() => setIsMobileOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <FilterContent
          filterState={filterState}
          handleCheckbox={handleCheckbox}
          updateFilter={updateFilter}
          resetFilters={resetFilters}
        />
      </div>
    </>
  );
});

export default SidebarFilter;