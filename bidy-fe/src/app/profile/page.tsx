"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ProfileHeader from "./components/ProfileHeader";
import ProfileStats from "./components/ProfileStats";
import ProductToolbar, {
  type ProductView,
  type SortOption,
  type SortOrder,
} from "./components/ProductToolbar";
import ProductList from "./components/ProductList";
import { useProfile, useUserStats } from "@/services/user";
import { useUserAuctionByStatus, useUserBuyAuction } from "@/services/bid";
import { STATUS_AUCTIONS, APP_ROUTES } from "@/constants";
import { Bid } from "@/types";
import logger from "@/utils/logger";
import { useAuth } from "@/hooks";

export default function ProfilePage() {
  const { profile, isLoading } = useProfile();
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState("seller");
  const [productTab, setProductTab] = useState<STATUS_AUCTIONS>(
    STATUS_AUCTIONS.HAPPENING
  );
  // Tab "Người mua" hiện chỉ có một danh sách: sản phẩm đã mua.
  const buyerTab = "bought";
  const [view, setView] = useState<ProductView>("list");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Get user's sold products (as seller)
  const { auctions: soldProducts } = useUserAuctionByStatus(
    user?._id ?? "",
    productTab
  );

  // Get user's bought products (as buyer)
  const { auctionsBuy: boughtProducts } = useUserBuyAuction(user?._id ?? "");

  const { stats } = useUserStats();

  // Determine which products to show based on tab and buyerTab
  const currentProducts = useMemo(() => {
    let products: Bid[] = [];

    if (tab === "seller") {
      // Show sold products based on status
      products = soldProducts || [];
    } else if (tab === "buyer") {
      // Show bought products - extract auction data from orders
      if (boughtProducts && Array.isArray(boughtProducts)) {
        products = boughtProducts
          .filter((order) => order.bid_id) // Only include orders with auction data
          .map((order) => order.bid_id); // Extract the auction data from bid_id
      }
    }

    logger.debug("Profile page products to display", {
      productCount: products.length,
      tab,
      productTab,
    });

    // Sort products based on current sort settings
    if (!products) return [];
    const sorted = [...products]?.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case "name":
          aValue = a.name?.toLowerCase() || "";
          bValue = b.name?.toLowerCase() || "";
          break;
        case "price":
          aValue = parseFloat(a.price?.replace(/[^\d]/g, "") || "0");
          bValue = parseFloat(b.price?.replace(/[^\d]/g, "") || "0");
          break;
        case "status":
          aValue = a.status?.toLowerCase() || "";
          bValue = b.status?.toLowerCase() || "";
          break;
        case "date":
        default:
          // Use endDate for date sorting, fallback to finishedTime, then name
          aValue = a.endDate || a.finishedTime || a.name?.toLowerCase() || "";
          bValue = b.endDate || b.finishedTime || b.name?.toLowerCase() || "";
          break;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortOrder === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return sorted;
  }, [tab, productTab, soldProducts, boughtProducts, sortBy, sortOrder]);

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(option);
      setSortOrder("asc");
    }
  };

  const handleProductClick = (product: Bid) => {
    router.push(APP_ROUTES.PRODUCT_DETAIL(`${product?._id}`));
  };

  const handleButtonClick = (
    e: React.MouseEvent,
    product: Bid,
    action: string
  ) => {
    e.stopPropagation();
    if (tab === "buyer") {
      switch (action) {
        case "view":
        case "bid":
          router.push(APP_ROUTES.PRODUCT_DETAIL(`${product?._id}`));
          break;
        case "unwatch":
          logger.info("User unwatched product", { productId: product?._id });
          break;
      }
    } else if (tab === "seller") {
      switch (action) {
        case "edit":
          router.push(APP_ROUTES.PRODUCT_DETAIL(`${product?._id}`));
          break;
        case "delete":
          logger.info("User deleted product", { productId: product?._id });
          break;
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader
        profile={profile}
        isLoading={isLoading}
        tab={tab}
        setTab={setTab}
      />

      <ProfileStats isSeller={tab === "seller"} stats={stats} />

      <section className="flex flex-col gap-4">
        <ProductToolbar
          isSeller={tab === "seller"}
          productTab={productTab}
          setProductTab={setProductTab as (tab: string) => void}
          sortBy={sortBy}
          sortOrder={sortOrder}
          handleSort={handleSort}
          view={view}
          setView={setView}
          count={currentProducts.length}
        />
        <ProductList
          products={currentProducts}
          view={view}
          tab={tab}
          buyerTab={buyerTab}
          handleProductClick={handleProductClick}
          handleButtonClick={handleButtonClick}
        />
      </section>
    </div>
  );
}
