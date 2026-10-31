"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { APP_ROUTES } from "@/constants/routes.constants";
import { useSellerProfile } from "@/services/seller";
import { PageLoader } from "@/components/common/loading";
import SellerInfo from "@/app/product/[id]/components/SellerInfo";
import SellerStats from "./components/SellerStats";
import SellerProducts from "./components/SellerProducts";

export default function SellerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { seller, isLoading, isError, error, isNotFound, refetch } = useSellerProfile(id);

  if (isNotFound) {
    notFound();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-32">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <PageLoader variant="page" />
        </div>
      </div>
    );
  }

  if (isError || !seller) {
    return (
      <div className="min-h-screen bg-background pb-32">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="border border-border bg-card p-8 text-center flex flex-col items-center gap-4">
            <p className="text-destructive font-medium">
              {error instanceof Error ? error.message : "Không thể tải thông tin người bán."}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 border border-border bg-primary text-primary-foreground font-semibold hover:bg-primary-hover transition-colors"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = seller.fullname || seller.username;

  return (
    <div className="min-h-screen bg-background pb-64 lg:pb-32">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <nav className="mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-sm text-foreground-secondary">
            <li>
              <Link href={APP_ROUTES.HOME} className="hover:text-primary transition-colors">
                Trang chủ
              </Link>
            </li>
            <li>/</li>
            <li className="text-foreground font-medium truncate max-w-[200px] sm:max-w-none">
              {displayName}
            </li>
          </ol>
        </nav>

        <h1 className="text-2xl text-foreground font-bold mb-8 text-center lg:text-left">
          Hồ sơ người bán
        </h1>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Seller Info Card */}
          <div className="w-full max-w-[342px] mx-auto lg:mx-0 lg:w-[342px] flex-shrink-0">
            <SellerInfo seller={seller} />
          </div>

          {/* Seller's Stats & Products */}
          <div className="w-full flex-1 flex flex-col gap-8 min-w-0">
            <SellerStats auctionCounts={seller.auctionCounts} />
            <SellerProducts sellerId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
