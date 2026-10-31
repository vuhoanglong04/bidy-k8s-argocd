"use client";

import { Suspense } from "react";
import { AuctionBrowser } from "@/components/product";
import { PageLoader } from "@/components/common/loading";

/**
 * Trang danh mục gốc (`/category`).
 * Duyệt toàn bộ phiên đấu giá trên sàn theo chuẩn mới của `AuctionBrowser`,
 * đồng bộ với `/category/all` và `/category/[slug]`.
 */
export default function CategoryPage() {
  return (
    <Suspense fallback={<PageLoader message="Đang tải phiên đấu giá…" />}>
      <AuctionBrowser
        slug="all"
        title="Tất cả phiên đấu giá"
      />
    </Suspense>
  );
}
