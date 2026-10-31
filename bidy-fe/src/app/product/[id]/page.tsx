"use client";

import { notFound } from "next/navigation";
import { useState, useEffect } from "react";
import { STATUS_AUCTIONS, WEBSOCKET_EVENTS, getProductConditionLabel } from "@/constants/app.enum";
import { useProductById } from "@/services/product";
import { mapImageUrls } from "@/utils/image.utils";
import { useWebSocketCore } from "@/hooks/useWebSocketCore";
import { useAuctionWebSocket } from "@/hooks/useAuctionWebSocket";
import type { BidderUpdatePayload } from "@/services/bid";
import { useAuth } from "@/hooks/useAuth";
import Breadcrumbs from "./components/Breadcrumbs";
import ProductImages from "./components/ProductImages";
import ProductTitleBookmark from "./components/ProductTitleBookmark";
import ProductDescription from "./components/ProductDescription";
import ProductQuickInfo from "./components/ProductQuickInfo";
import ProductCTA from "./components/ProductCTA";
import ProductBidList from "./components/ProductBidList";
import ProductSoonCTA from "./components/ProductSoonCTA";
import RelatedByCategory from "./components/RelatedByCategory";
import BidderCount from "./components/BidderCount";
import CurrentBidders from "./components/CurrentBidders";
import type { Bid } from "./components/ProductBidList";
import type { TopOwnership } from "@/types/bid";
import logger from "@/utils/logger";
import RealtimeCountdownTimer from "@/components/ui/RealtimeCountdownTimer";
import { PageLoader } from "@/components/common/loading";

// Get actual product data from database instead of hardcoded values

function formatCurrency(amount?: number) {
  if (amount == null || Number.isNaN(amount)) return "0 VNĐ";
  return amount.toLocaleString("vi-VN") + " VNĐ";
}

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string>("");
  // Giá realtime đẩy từ `bidderUpdate` — ưu tiên hơn snapshot của REST
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveMinNextBid, setLiveMinNextBid] = useState<number | null>(null);

  useEffect(() => {
    params.then(({ id: resolvedId }) => {
      setId(resolvedId);
    });
  }, [params]);

  const { product: apiProduct, isLoading: apiLoading, refetchProduct } = useProductById(id);
  const { user: currentUser } = useAuth();

  // WebSocket integration for real-time updates
  const {
    isConnected: wsConnected,
    auctionUpdates,
  } = useWebSocketCore();

  // Get latest updates
  const latestAuctionUpdate = auctionUpdates[auctionUpdates.length - 1];

  // Chỉ nghe, không tự join: CurrentBidders/BidderCount đã join room khi phiên
  // đang diễn ra và dùng chung socket này.
  const { socket } = useAuctionWebSocket(id, { autoJoin: false });

  /**
   * Giá và sàn bid kế tiếp lấy thẳng từ payload `bidderUpdate`.
   *
   * KHÔNG refetch ở đây: `bidderUpdate` là broadcast cả room, nên 1 lượt bid
   * với N người đang xem sẽ thành N request `GET /auctions/{id}` cùng lúc —
   * đủ để chạm rate limit của backend (300 req / 15 phút mỗi IP).
   *
   * Dùng `bidderUpdate` chứ không phải `bidUpdate`/`newBid`: backend đã bỏ
   * handler `socket.on('newBid')` (client tự bơm được dữ liệu giả), nên hai
   * event kia không bao giờ bắn nữa.
   */
  useEffect(() => {
    setLivePrice(null);
    setLiveMinNextBid(null);
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;

    const handleBidderUpdate = (data: BidderUpdatePayload & { auctionId?: string }) => {
      if (data?.auctionId !== id) return;
      if (typeof data.currentPrice === "number") setLivePrice(data.currentPrice);
      if (typeof data.minNextBid === "number") setLiveMinNextBid(data.minNextBid);
    };

    socket.on(WEBSOCKET_EVENTS.BIDDER_UPDATE, handleBidderUpdate);
    return () => {
      socket.off(WEBSOCKET_EVENTS.BIDDER_UPDATE, handleBidderUpdate);
    };
  }, [socket, id]);

  useEffect(() => {
    if (latestAuctionUpdate && latestAuctionUpdate.auctionId === id) {
      logger.info('Received auction status update via WebSocket', {
        auctionId: id,
        status: latestAuctionUpdate.status,
        endDate: latestAuctionUpdate.endDate
      });
      refetchProduct();
    }
  }, [latestAuctionUpdate, id, refetchProduct]);

  // Fallback polling every 30 seconds when WebSocket is disconnected
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (!wsConnected) {
      logger.warn('WebSocket disconnected, falling back to polling', { auctionId: id });
      interval = setInterval(() => {
        refetchProduct();
      }, 30000); // 30 seconds fallback
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [wsConnected, refetchProduct, id]);

  // Don't render until we have the id
  if (!id || apiLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageLoader message="Đang tải sản phẩm..." />
      </div>
    );
  }

  if (!apiProduct) {
    notFound();
  }

  // `currentPrice` của auction là nguồn chân lý duy nhất về giá: khi proxy
  // bidding giải xong, nó đã tính cả counter-bid tự động, còn
  // `top_ownerships[0].amount` chỉ là lượt bid cao nhất được ghi — hai số lệch
  // nhau trong luồng auto-bid. Cột tiền là `decimal` nên backend serialize
  // thành string, phải ép về number trước khi so sánh.
  const toAmount = (value: unknown): number => {
    const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const currentPriceValue =
    livePrice
    ?? (toAmount((apiProduct as { currentPrice?: number | string }).currentPrice)
        || toAmount(apiProduct.price));

  // Số tiền hợp lệ nhỏ nhất kế tiếp, backend tính bằng đúng hàm mà validator của
  // placeBid dùng. Là snapshot lúc GET, không phải hợp đồng — dùng để gợi ý và
  // chặn sớm, backend vẫn là trọng tài cuối.
  const minNextBid =
    liveMinNextBid ?? toAmount((apiProduct as { minNextBid?: number | string }).minNextBid);

  // Map backend data to frontend format - only use fields that exist in backend
  const product = {
    id: apiProduct._id || apiProduct.id || 0,
    name: apiProduct.name || "",
    image: mapImageUrls(apiProduct.image),
    description: apiProduct.description || "",
    startingPrice: apiProduct.price?.toString() || "0",
    buyNow: apiProduct.priceBuyNow?.toString() || undefined,
    currentPrice: currentPriceValue.toString() || undefined,
    finalPrice: currentPriceValue.toString() || undefined,
    timeLeft: apiProduct.time_remain || undefined,
    endTime: apiProduct.endDate || apiProduct.finishedTime || undefined,
    category: typeof apiProduct.category === 'object' && apiProduct.category !== null
      ? ((apiProduct.category as { name?: string; displayName?: string }).name
        || (apiProduct.category as { name?: string; displayName?: string }).displayName
        || "Chưa phân loại")
      : (apiProduct.category || undefined),
    status: apiProduct.status as STATUS_AUCTIONS || STATUS_AUCTIONS.INITIAL,
    type: apiProduct.status as STATUS_AUCTIONS || STATUS_AUCTIONS.INITIAL,
    startDate: apiProduct.startDate || undefined,
    createdAt: apiProduct.createdAt || undefined,
    updatedAt: apiProduct.updatedAt || undefined,
  };

  // For demo, use the same image for all thumbnails
  const images = mapImageUrls(product.image);

  // Calculate current price from product data
  const currentPrice = currentPriceValue;

  logger.debug('Product page status check', {
    productStatus: apiProduct.status,
    productId: id,
    availableStatuses: Object.keys(STATUS_AUCTIONS)
  });

  const categoryLabel = (() => {
    const categoryValue = apiProduct.category;
    if (!categoryValue) return "Chưa phân loại";

    if (typeof categoryValue === 'object' && categoryValue !== null) {
      const obj = categoryValue as { name?: string; displayName?: string };
      return obj.name || obj.displayName || "Chưa phân loại";
    }

    const isObjectId = typeof categoryValue === 'string' &&
                     categoryValue.length === 24 &&
                     /^[0-9a-fA-F]{24}$/.test(categoryValue);

    if (isObjectId) {
      const categoryMap: { [key: string]: string } = {
        '662476bb4e99c9d277d41c29': 'Đồ điện tử',
      };
      return categoryMap[categoryValue] || 'Đồ điện tử';
    }

    return String(categoryValue);
  })();

  // Tình trạng sản phẩm (new/like_new/used/refurbished) — không phải trạng thái phiên.
  // API trả `condition` ở cấp auction, một số endpoint lồng trong `product`.
  const rawCondition =
    (apiProduct as { condition?: string; product?: { condition?: string } }).condition
    ?? (apiProduct as { product?: { condition?: string } }).product?.condition;
  const conditionLabel = getProductConditionLabel(rawCondition);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumbs productName={product.name} />

        {/* Asymmetric split: product on the left, actions on the right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 border border-border bg-card">
          {/* ── LEFT: PRODUCT ───────────────────────────────── */}
          <section className="flex flex-col gap-8 p-6 border-b border-border lg:border-b-0 lg:border-r">
            <ProductImages images={images} productName={product.name} />

            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-foreground-secondary">
                {categoryLabel}
              </span>
              <h1 className="text-2xl lg:text-4xl font-bold text-foreground leading-tight">
                {product.name}
              </h1>
            </div>

            <ProductDescription
              description={product.description || "Không có mô tả sản phẩm."}
            />

            <ProductQuickInfo
              category={categoryLabel}
              brand={apiProduct.brand || "Chưa rõ thương hiệu"}
              condition={conditionLabel}
              starterPrice={product.startingPrice}
              quickBuy={product.buyNow}
              currentPrice={product.currentPrice}
            />
          </section>

          {/* ── RIGHT: ACTIONS ──────────────────────────────── */}
          <section className="flex flex-col">
            <div className="lg:sticky lg:top-0 flex flex-col gap-6 p-6">
              {/* Action bar: countdown + wishlist */}
              <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
                <div className="min-w-0 flex-1">
                  {(product.startDate && product.endTime) ? (
                    <RealtimeCountdownTimer
                      auctionId={id}
                      status={product.type}
                      startDate={product.startDate}
                      endDate={product.endTime}
                      finishedTime={apiProduct.finishedTime}
                      variant="compact"
                      position="center"
                    />
                  ) : (
                    <span className="text-sm text-foreground-secondary">
                      Chưa có lịch đấu giá
                    </span>
                  )}
                </div>

                {product.type !== STATUS_AUCTIONS.INITIAL && (
                  <ProductTitleBookmark
                    auctionId={id}
                    auctionOwnerId={apiProduct.owner}
                    currentUserId={currentUser?._id || ""}
                  />
                )}
              </div>

              {/* Live bidder count */}
              {product.type === STATUS_AUCTIONS.HAPPENING && (
                <BidderCount
                  auctionId={id}
                  auctionStatus={product.type}
                  initialCount={0}
                />
              )}

              {/* CTA cluster - conditional by product.type */}
              {product.type !== STATUS_AUCTIONS.INITIAL && (
                <ProductCTA
                  currentPrice={currentPrice}
                  minNextBid={minNextBid}
                  productId={product.id}
                  productType={product.type}
                  refetchProduct={refetchProduct}
                  currentUserId={currentUser?._id || ""}
                  productName={product.name}
                  buyNowPrice={parseFloat(product.buyNow || "0")}
                  auctionOwner={apiProduct.owner}
                />
              )}

              {product.type === STATUS_AUCTIONS.INITIAL && (
                <ProductSoonCTA
                  auctionId={id}
                  auctionOwnerId={apiProduct.owner}
                  currentUserId={currentUser?._id || ""}
                />
              )}

              {/* Current Bidders - Show during active auctions */}
              {product.type === STATUS_AUCTIONS.HAPPENING && (
                <CurrentBidders
                  auctionId={id}
                  auctionStatus={product.type}
                  formatCurrency={formatCurrency}
                />
              )}

              {/* Historical Bids - Show after auction ends */}
              {product.type === STATUS_AUCTIONS.ENDED && (
                <ProductBidList
                  bids={apiProduct.top_ownerships
                    ?.slice()
                    .sort((a: TopOwnership, b: TopOwnership) => b.amount - a.amount)
                    .map((bid: TopOwnership, index: number) => ({
                      id: index,
                      name: bid.user_name || "Unknown User",
                      avatar: "/images.jpeg",
                      time: index === 0 ? "Người thắng" : "",
                      amount: bid.amount || 0,
                    })) as Bid[] || []}
                  formatCurrency={formatCurrency}
                  type={STATUS_AUCTIONS.ENDED}
                />
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Related Products Sections — nằm ngoài container để tràn full width màn hình */}
      <RelatedByCategory />
    </div>
  );
}
