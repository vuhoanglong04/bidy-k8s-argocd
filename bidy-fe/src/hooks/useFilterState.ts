"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { FilterState } from "@/components/product/SidebarFilter";

/**
 * Custom hook for managing filter state synchronized with URL parameters
 * Provides clean URL-based state management for product filtering
 * @returns Filter state and update functions
 */
export function useFilterState() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  /**
   * Extracts filter values from current URL parameters
   * @returns FilterState object with current URL values
   */
  const getFiltersFromURL = useCallback((): FilterState => {
    const search = searchParams.get("search") || "";
    const categories = searchParams.get("categories")?.split(",").filter(Boolean) || [];

    // If on specific category page, add that category to selection
    if (pathname?.startsWith('/category/') && !pathname.includes('?') && !pathname.endsWith('/all')) {
      const categorySlug = pathname.split('/')[2];
      if (categorySlug && !categories.includes(categorySlug)) {
        categories.push(categorySlug);
      }
    }

    return {
      selectedCategories: categories,
      priceFrom: searchParams.get("priceFrom") || "",
      priceTo: searchParams.get("priceTo") || "",
      search: search,
      sort: searchParams.get("sort") || "",
    };
  }, [searchParams, pathname]);

  const [filterState, setFilterState] = useState<FilterState>(getFiltersFromURL);

  /**
   * Updates URL parameters to match current filter state
   * @param newState - New filter state to sync to URL
   */
  const updateURL = (newState: FilterState) => {
    const params = new URLSearchParams();

    if (newState.search) {
      params.set("search", newState.search);
    }
    if (newState.selectedCategories.length > 0) {
      params.set("categories", newState.selectedCategories.join(","));
    }
    if (newState.priceFrom) {
      params.set("priceFrom", newState.priceFrom);
    }
    if (newState.priceTo) {
      params.set("priceTo", newState.priceTo);
    }
    if (newState.sort) {
      params.set("sort", newState.sort);
    }

    // Keep current pathname instead of always redirecting to /category
    const newURL = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    router.replace(newURL, { scroll: false });
  };

  // Sync state with URL on mount and URL changes
  useEffect(() => {
    const urlState = getFiltersFromURL();
    setFilterState(urlState);
  }, [pathname, searchParams, getFiltersFromURL]);

  // Custom setter that updates both state and URL
  const setFilterStateWithURL = (newState: FilterState | ((prev: FilterState) => FilterState)) => {
    const updatedState = typeof newState === 'function' ? newState(filterState) : newState;
    setFilterState(updatedState);
    updateURL(updatedState);
  };

  const resetFilters = () => {
    const initialState: FilterState = {
      selectedCategories: [],
      priceFrom: "",
      priceTo: "",
      search: "",
      sort: "",
    };
    setFilterState(initialState);
    updateURL(initialState);
  };

  const updateFilter = (field: keyof FilterState, value: string | string[]) => {
    const newState = { ...filterState, [field]: value };
    setFilterState(newState);
    updateURL(newState);
  };

  return {
    filterState,
    setFilterState: setFilterStateWithURL,
    resetFilters,
    updateFilter,
  };
}

export default useFilterState;