"use client";

import { Suspense } from "react";
import { AuctionBrowser } from "@/components/product";
import { PageLoader } from "@/components/common/loading";

/** `useAuctionBrowseParams` đọc `useSearchParams` nên phải nằm trong Suspense. */
export default function AllCategoriesPage() {
  return (
    <Suspense fallback={<PageLoader message="Đang tải phiên đấu giá…" />}>
      <AuctionBrowser
        slug="all"
        title="Tất cả phiên đấu giá"
        subtitle={undefined}
      />
    </Suspense>
  );
}
