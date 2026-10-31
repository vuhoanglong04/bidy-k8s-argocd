"use client";

import Link from "next/link";
import { useFeaturedProducts } from "@/services/product";
import { APP_ROUTES } from "@/constants/routes.constants";
import { mapImageUrls } from "@/utils/image.utils";
import { ImageWithFallback } from "@/components/common/ImageWithFallback";
import type { MappedAuction } from "@/services/auction.mapper";

interface FeatureBid {
  amount?: number;
}

interface FeatureItem extends MappedAuction {
  top_ownerships?: FeatureBid[];
}

// Local minimal price formatter to avoid deep relative imports for a simple task
const formatPrice = (price: string | number) => {
  const num = typeof price === 'string' ? parseInt(price, 10) : price;
  if (isNaN(num)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
};

export default function Features() {
  const itemsPerPage = 4; // Show only 4 items for a high-end gallery feel

  const { featuredProducts, isLoading } = useFeaturedProducts();

  if (isLoading) {
    return (
      <section className="w-full py-20 min-h-screen bg-transparent flex flex-col gap-10">
        <div className="flex flex-col gap-2 items-start px-4 w-full max-w-[1400px] mx-auto">
          <h2 className="text-3xl md:text-5xl font-serif tracking-tighter leading-none text-foreground">
            Hiện vật tâm điểm.
          </h2>
        </div>
        <div className="w-full max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 px-4">
          <div className="col-span-full font-mono text-xs uppercase tracking-widest text-foreground/50 animate-pulse">Đang tải dữ liệu phiên đấu giá...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-24 md:py-32 bg-transparent flex flex-col relative z-10">
      {/* Header */}
      <div className="px-4 lg:px-8 w-full max-w-[1400px] mx-auto mb-16 md:mb-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-foreground/10 pb-12">
          <div className="flex flex-col gap-6 max-w-2xl">
            <h2 className="text-4xl md:text-6xl font-serif tracking-tighter leading-none text-foreground antialiased">
              Hiện vật <br /> tâm điểm.
            </h2>
            <p className="text-sm md:text-base text-foreground/60 leading-relaxed font-light ml-[5%]">
              Những phiên đấu giá đang thu hút sự chú ý cao độ. Các tác phẩm, hiện vật và tài sản có giá trị độc bản. Định giá ngay hôm nay.
            </p>
          </div>
          <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-foreground/40 pb-1">
            <Link href={APP_ROUTES.CATEGORY} className="hover:text-foreground transition-colors border-b border-foreground/30 pb-1">
              Khám phá toàn bộ →
            </Link>
          </div>
        </div>
      </div>

      {/* Cards - Exhibition Gallery Layout */}
      <div className="w-full max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-16 px-4 lg:px-8">
        {featuredProducts.length === 0 ? (
          <div className="col-span-full font-mono text-xs uppercase tracking-widest text-foreground/50 py-8">
            Không có sản phẩm đấu giá nào hiện tại.
          </div>
        ) : (
          featuredProducts.slice(0, itemsPerPage).map((feature: FeatureItem, idx: number) => {
            const featureId = feature._id || feature.id;
            const productId = typeof featureId === 'string' ? featureId : String(featureId || "0");
            
            const startingPrice = feature.price || 0;
            const highestBid = feature.top_ownerships && feature.top_ownerships.length > 0
              ? Math.max(...feature.top_ownerships.map((bid: FeatureBid) => bid.amount || 0))
              : startingPrice;

            const images = mapImageUrls(feature.image);
            const mainImage = images && images.length > 0 ? images[0] : "/images.jpeg";

            return (
              <Link
                key={idx}
                href={APP_ROUTES.PRODUCT_DETAIL(productId)}
                className="group flex flex-col gap-5 relative"
              >
                {/* Image Container - Tall Aspect Ratio (3:4) like a portrait painting */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-foreground/5 border border-foreground/10">
                  <ImageWithFallback
                    src={mainImage}
                    alt={feature.name || "Sản phẩm đấu giá"}
                    fill
                    className="object-cover transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 grayscale-[0.2] group-hover:grayscale-0"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  />
                  
                  {/* Minimal Status Overlay */}
                  <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-md px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-foreground border border-foreground/10">
                    {feature.status === 'ended' ? 'Đã kết thúc' : 
                     feature.status === 'initial' ? 'Sắp diễn ra' : 
                     'Đang diễn ra'}
                  </div>
                </div>

                {/* Info Container */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="text-base md:text-lg font-medium tracking-tight text-foreground group-hover:text-foreground/70 transition-colors line-clamp-2 leading-snug">
                      {feature.name}
                    </h3>
                  </div>

                  <div className="flex flex-col items-start mt-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-foreground/50 mb-1">
                      {feature.status === 'ended' ? 'Giá chốt' : 'Giá hiện tại'}
                    </span>
                    <span className="text-lg md:text-xl font-serif text-foreground">
                      {formatPrice(highestBid)}
                    </span>
                  </div>

                  <div className="w-full h-px bg-foreground/10 my-1"></div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-foreground/50 font-light truncate max-w-[60%]">
                      {feature.owner?.full_name || "Bidy Auction"}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-foreground/40 group-hover:text-foreground transition-colors">
                      Tham gia ↗
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
