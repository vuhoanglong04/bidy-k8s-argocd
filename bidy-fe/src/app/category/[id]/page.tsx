"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AuctionBrowser } from "@/components/product";
import { PageLoader } from "@/components/common/loading";

function CategoryDetailContent() {
  const params = useParams();
  // Route param là **slug** danh mục; `AuctionBrowser` tự đổi slug sang id.
  const slug = (params.id as string) ?? "all";

  return <AuctionBrowser slug={slug} />;
}

export default function CategoryDetailPage() {
  return (
    <Suspense fallback={<PageLoader message="Đang tải phiên đấu giá…" />}>
      <CategoryDetailContent />
    </Suspense>
  );
}
