"use client";

import React, { useState, useEffect, useRef } from "react";
import { useProductSearch } from "@/services/product";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APP_ROUTES } from "@/constants";
import { Skeleton } from "@/components/common/loading";
import { useDebouncedValue } from "@/hooks";

type ProductSearchResult = { id?: string; _id?: string; name: string };

export default function SearchBar() {
  const [searchValue, setSearchValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Chỉ gọi API khi người dùng ngừng gõ, tránh spam request / chạm rate-limit
  const { debouncedValue: debouncedSearch, isPending: isTyping } =
    useDebouncedValue(searchValue.trim(), 350);

  const { searchResults, isFetching } = useProductSearch(debouncedSearch);

  // Giữ skeleton suốt cả lúc chờ debounce lẫn lúc fetch → dropdown không nháy
  const isSearching = !!searchValue.trim() && (isTyping || isFetching);

  // Show dropdown only if input is focused and has value
  useEffect(() => {
    if (searchValue.trim()) setShowDropdown(true);
    else setShowDropdown(false);
  }, [searchValue]);

  // Hide dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  // Handle search action
  const handleSearch = () => {
    if (searchValue.trim()) {
      router.push(APP_ROUTES.CATEGORY_SEARCH(searchValue.trim()));
    } else {
      router.push(APP_ROUTES.CATEGORY_ALL);
    }
  };

  // Handle Enter key in input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex w-full relative z-20">
      <div className="w-full flex flex-col md:flex-row gap-4 items-stretch md:items-center">
        {/* Search input */}
        <div
          className="flex-1 flex items-center bg-background/60 backdrop-blur-md border border-foreground/20 rounded-none h-[56px] md:h-[64px] px-5 relative focus-within:border-foreground transition-all duration-300"
          ref={wrapperRef}
        >
          <svg
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 20 20"
            className="mr-3 text-foreground/50 group-focus-within:text-foreground transition-colors"
          >
            <circle
              cx="9"
              cy="9"
              r="7"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <line
              x1="14.5"
              y1="14.5"
              x2="19"
              y2="19"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-foreground/40 text-base md:text-lg font-light"
            placeholder="Tìm kiếm tác phẩm, hiện vật, phiên đấu giá..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => searchValue.trim() && setShowDropdown(true)}
            autoComplete="off"
            onKeyDown={handleKeyDown}
          />
          {/* Dropdown for search results */}
          {showDropdown && (
            <div className="absolute left-0 top-[calc(100%+1px)] w-full bg-background border border-foreground/20 shadow-2xl z-30 max-h-80 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {isSearching ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="px-5 py-4 border-b border-foreground/10 last:border-0"
                  >
                    <Skeleton className="h-4 w-3/4 rounded-none" />
                  </div>
                ))
              ) : searchValue.trim() && searchResults.length > 0 ? (
                searchResults.map((product: ProductSearchResult) => (
                  <Link
                    key={product.id ?? product._id ?? ''}
                    href={APP_ROUTES.PRODUCT_DETAIL(
                      (product.id ?? product._id) as string
                    )}
                    className="block px-5 py-4 hover:bg-foreground/5 text-foreground text-sm cursor-pointer transition-colors duration-150 border-b border-foreground/10 last:border-0"
                    onClick={() => setShowDropdown(false)}
                  >
                    {product.name}
                  </Link>
                ))
              ) : searchValue.trim() ? (
                <div className="px-5 py-4 text-sm font-mono text-foreground/50 uppercase tracking-wider">Không tìm thấy sản phẩm</div>
              ) : null}
            </div>
          )}
        </div>
        {/* Search button */}
        <button
          className="h-[56px] md:h-[64px] px-8 md:px-12 bg-foreground text-background font-medium rounded-none hover:bg-foreground/90 active:scale-[0.98] transition-all duration-200 flex items-center justify-center text-sm md:text-base tracking-wide"
          onClick={handleSearch}
        >
          Khám phá
        </button>
      </div>
    </div>
  );
}
