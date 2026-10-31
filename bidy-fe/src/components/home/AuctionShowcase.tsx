'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

import { ProductCardCompact } from '@/components/auction';
import type { UnifiedAuctionItem } from '@/components/auction/types';
import { LoadingState, Skeleton } from '@/components/common/loading';
import { cn } from '@/lib/utils';
import type { MappedAuction } from '@/services/auction.mapper';

interface AuctionShowcaseProps {
  title: string;
  /** Câu phụ ngắn dưới tiêu đề, giải thích block này sắp theo tiêu chí gì. */
  subtitle?: string;
  auctions: MappedAuction[];
  isLoading: boolean;
  /** Link "xem tất cả" — bỏ qua nếu block không có trang riêng. */
  viewAllHref?: string;
  emptyMessage?: string;
  className?: string;
}

function ShowcaseSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Một dải auction trên trang chủ. Mỗi block là một query độc lập nên chúng
 * load song song và block chậm không giữ block nhanh lại.
 */
export function AuctionShowcase({
  title,
  subtitle,
  auctions,
  isLoading,
  viewAllHref,
  emptyMessage = 'Chưa có phiên đấu giá nào.',
  className,
}: Readonly<AuctionShowcaseProps>) {
  return (
    <section className={cn('w-full', className)}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>

        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-primary hover:text-primary-hover focus-visible:ring-ring text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Xem tất cả →
          </Link>
        )}
      </div>

      <LoadingState
        isLoading={isLoading}
        isEmpty={auctions.length === 0}
        emptyMessage={emptyMessage}
        loadingFallback={<ShowcaseSkeleton />}
      >
        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {auctions.map((auction) => (
            <motion.li
              key={auction.id}
              variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
            >
              <ProductCardCompact item={auction as UnifiedAuctionItem} density="comfortable" />
            </motion.li>
          ))}
        </motion.ul>
      </LoadingState>
    </section>
  );
}

export default AuctionShowcase;
