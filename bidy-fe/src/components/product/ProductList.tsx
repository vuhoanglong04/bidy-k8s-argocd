"use client";

import { useMemo, useState, useCallback } from "react";
import { ProductCardCompact } from "@/components/auction";
import type { UnifiedProduct } from "@/components/home/unifiedMock";
import { FilterState } from "./SidebarFilter";
import { ArrowUpNarrowWide, ChevronLeft, ChevronRight } from "lucide-react";
import { isProductInCategories } from "@/constants/categories.constants";
import { STATUS_AUCTIONS } from "@/constants/app.enum";
import { mapImageUrls } from "@/utils/image.utils";
import { parseVietnameseNumber } from "@/components/ui/MoneyInput";

interface ProductListProps {
  filterState: FilterState;
  updateFilter: (field: keyof FilterState, value: string | string[]) => void;
  products: ApiProduct[];
  isLoading: boolean;
}

// Define interface for API product data
interface ApiProduct {
  _id?: string;
  id?: string;
  name?: string;
  productName?: string;
  image?: string[];
  images?: string[];
  description?: string;
  price?: number;
  startingPrice?: number;
  starterPrice?: number;
  buyNow?: number;
  quickBuy?: number;
  currentPrice?: number;
  finalPrice?: number;
  timeLeft?: string;
  time_remain?: string;
  endTime?: string;
  endDate?: string;
  finishedTime?: string;
  sellerName?: string;
  seller?: string;
  sellerId?: number;
  category?: string;
  condition?: string;
  status?: string;
  type?: string;
  views?: number;
  createdAt?: string;
  updatedAt?: string;
  isWatched?: boolean;
  owner?: {
    _id?: string;
    full_name?: string;
  };
  top_ownerships?: Array<{ amount: number; user_id: string }>;
}

const SORT_OPTIONS = [
  { label: "Sắp xếp theo", value: "", isPlaceholder: true },
  { label: "Mới nhất", value: "newest" },
  { label: "Giá tăng dần", value: "price-asc" },
  { label: "Giá giảm dần", value: "price-desc" },
];

export default function ProductList({
  filterState,
  updateFilter,
  products,
  isLoading,
}: ProductListProps) {
  // Force compact view by default for mobile-optimized cards
  const [viewMode, setViewMode] = useState<"grid" | "compact">("compact");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100; // Updated to show 100 items per page (5 items x 20 rows)

  /**
   * Maps API product data to UnifiedProduct interface
   * Handles various API response formats and ensures type safety
   * @param product - Raw product data from API
   * @returns UnifiedProduct object with standardized properties
   */
  const mapToUnifiedProduct = useCallback((product: ApiProduct): UnifiedProduct => {
    const images = mapImageUrls(product.image || product.images);
    let timeLeft = product.timeLeft || undefined;
    // Use time_remain for HAPPENING type
    if ((product.status || product.type) === STATUS_AUCTIONS.HAPPENING && product.time_remain) {
      timeLeft = product.time_remain;
    }
    
    // Keep the original ID as string for API compatibility
    const productId = product._id || product.id || "0";
    const finalId = typeof productId === "string" ? productId : String(productId);
    
    // Type-safe condition mapping
    const condition = product.condition as "new" | "used" | "refurbished" | undefined;
    
    // Type-safe status mapping
    const status = (product.status as STATUS_AUCTIONS) || STATUS_AUCTIONS.INITIAL;
    
    // Calculate current highest bid from top_ownerships
    const startingPrice = product.price || product.startingPrice || product.starterPrice || 0;
    const highestBid = product.top_ownerships && product.top_ownerships.length > 0
      ? Math.max(...product.top_ownerships.map((bid: { amount: number }) => bid.amount || 0))
      : startingPrice;
    
    return {
      id: finalId,
      name: product.name || product.productName || "",
      image: images,
      description: product.description || "",
      startingPrice: startingPrice.toString(),
      buyNow: product.buyNow?.toString() || product.quickBuy?.toString() || undefined,
      currentPrice: highestBid.toString(),
      finalPrice: highestBid.toString(),
      timeLeft,
      // Fix: Map all possible end time fields from API
      endTime: (product as { endDate?: string; finishedTime?: string }).endDate || (product as { finishedTime?: string }).finishedTime || product.endTime || undefined,
      endDate: (product as { endDate?: string }).endDate || undefined,
      finishedTime: (product as { finishedTime?: string }).finishedTime || undefined,
      time_remain: (product as { time_remain?: string }).time_remain || undefined,
      seller: product.owner?.full_name || product.sellerName || product.seller || "Không rõ người bán",
      sellerId: typeof product.owner?._id === 'string' ? parseInt(product.owner._id, 10) || 0 : typeof product.owner?._id === 'number' ? product.owner._id : typeof product.sellerId === 'number' ? product.sellerId : 0,
      category: product.category || undefined,
      condition,
      status,
      type: STATUS_AUCTIONS.HAPPENING,
      views: product.views || 0,
      createdAt: product.createdAt || undefined,
      updatedAt: product.updatedAt || undefined,
      isWatched: product.isWatched || false,
      // Include top_ownerships for winner calculation in UnifiedAuctionCard
      top_ownerships: product.top_ownerships || [],
    };
  }, []);

  // Filtering logic (client-side for price, location, etc.)
  const filtered = useMemo(() => {
    // Map and filter API data
    const unifiedProducts: UnifiedProduct[] = Array.isArray(products)
      ? products.map(mapToUnifiedProduct)
      : [];

    let result = unifiedProducts.filter((f: UnifiedProduct) => {
      if (
        filterState.selectedCategories.length &&
        !isProductInCategories(f.category, filterState.selectedCategories)
      )
        return false;
      if (
        filterState.priceFrom &&
        getPrice(f) < parseInt(parseVietnameseNumber(filterState.priceFrom))
      )
        return false;
      if (filterState.priceTo && getPrice(f) > parseInt(parseVietnameseNumber(filterState.priceTo)))
        return false;
      // Removed brand and condition filtering - focusing on core functionality
      // Search filtering is handled by backend API
      return true;
    });

    // Sorting logic
    if (filterState.sort === "price-asc") {
      result = result.slice().sort((a, b) => {
        const aPrice = getPrice(a);
        const bPrice = getPrice(b);
        return aPrice - bPrice;
      });
    } else if (filterState.sort === "price-desc") {
      result = result.slice().sort((a, b) => {
        const aPrice = getPrice(a);
        const bPrice = getPrice(b);
        return bPrice - aPrice;
      });
    }
    // 'newest' is default order (API order)
    return result;
  }, [filterState, products, mapToUnifiedProduct]);

  /**
   * Extracts numeric price value from product for sorting and filtering
   * @param product - Product to extract price from
   * @returns Numeric price value, 0 if invalid
   */
  function getPrice(product: UnifiedProduct): number {
    const priceStr = product.currentPrice || product.startingPrice || "0";
    return parseInt(priceStr.replace(/\D/g, "")) || 0;
  }

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filtered.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFilter('sort', e.target.value);
    setCurrentPage(1); // Reset to first page when sorting
  };

  const toggleViewMode = () => {
    // Toggle between compact (4-5 cols) and grid (3-4 cols)
    setViewMode(viewMode === "compact" ? "grid" : "compact");
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-4">
      {/* Sort Bar */}
      <div className="flex items-center justify-between gap-4 ">
        <div className="sticky top-0 z-10 bg-card border border-border flex items-center gap-4 justify-center px-2 py-3 rounded-lg shadow-sm cursor-pointer w-full lg:w-fit lg:justify-between">
          <ArrowUpNarrowWide className="text-foreground-secondary" />
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <select
                className={`ml-2 pr-1 bg-transparent outline-none font-semibold 
                  ${
                    !filterState.sort
                      ? "text-foreground-secondary"
                      : "text-foreground"
                  }
                `}
                value={filterState.sort || ""}
                onChange={handleSortChange}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={!!opt.isPlaceholder}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="items-center space-x-2 hidden lg:flex">
          <button
            onClick={toggleViewMode}
            className={`p-2 rounded-lg border transition-colors ${
              viewMode === "compact"
                ? "bg-primary text-primary-foreground border-border"
                : "bg-background text-foreground-secondary border-border hover:border-foreground"
            }`}
            title="Compact View (5-6 columns)"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M2 2H6V6H2V2ZM8 2H12V6H8V2ZM14 2H18V6H14V2ZM2 8H6V12H2V8ZM8 8H12V12H8V8ZM14 8H18V12H14V8ZM2 14H6V18H2V14ZM8 14H12V18H8V14ZM14 14H18V18H14V14Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            onClick={toggleViewMode}
            className={`p-2 rounded-lg border transition-colors ${
              viewMode === "grid"
                ? "bg-primary text-primary-foreground border-border"
                : "bg-background text-foreground-secondary border-border hover:border-foreground"
            }`}
            title="Grid View (3-4 columns)"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 3H8V8H3V3ZM3 10H8V15H3V10ZM10 3H15V8H10V3ZM10 10H15V15H10V10Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
      {/* Product Grid - Mobile-optimized compact cards */}
      <div
        className={`grid w-full ${
          viewMode === "compact"
            ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-3"
            : "grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-2 sm:gap-4"
        }`}
      >
        {currentProducts.length === 0 ? (
          <div className="col-span-full text-center text-foreground-secondary text-lg py-8">
            Không tìm thấy sản phẩm nào
          </div>
        ) : (
          currentProducts.map((product, index) => (
            <ProductCardCompact key={startIndex + index} item={product} />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-border text-foreground-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-card"
          >
            <ChevronLeft />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`py-2 px-4 rounded-lg border ${
                currentPage === page
                  ? "bg-primary text-primary-foreground border-border"
                  : "border-border text-foreground-secondary hover:bg-card"
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-border text-foreground-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-card"
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
