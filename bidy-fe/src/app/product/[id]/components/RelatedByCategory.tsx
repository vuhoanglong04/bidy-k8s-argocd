"use client";

import { useParams } from "next/navigation";

import type { UnifiedAuctionItem } from "@/components/auction";
import { useProductById, useProductsByCategory } from "@/services/product";

import RotatingCardCarousel from "./RotatingCardCarousel";

export default function RelatedByCategory() {
  const params = useParams();

  const currentId = String(params.id ?? "");

  const { product } = useProductById(params.id as string);
  // `category` về lúc là id thuần, lúc là object đã populate.
  const rawCategory: unknown = product?.category;
  const categoryId =
    rawCategory && typeof rawCategory === "object"
      ? String(
          (rawCategory as Record<string, unknown>).id ??
            (rawCategory as Record<string, unknown>)._id ??
            (rawCategory as Record<string, unknown>).slug ??
            ""
        )
      : String(rawCategory ?? "");

  const { categoryProducts } = useProductsByCategory(categoryId);

  if (!product) return null;

  // `mapAuctionToFrontend` đã trả đúng shape `UnifiedAuctionItem`, nên đưa thẳng
  // vào card dùng chung — không map lại, tránh làm hỏng `id` như bản cũ.
  const related: UnifiedAuctionItem[] = categoryProducts.filter(
    (p) => String(p.id) !== currentId
  );

  if (related.length === 0) return null;

  return (
    <section
      aria-labelledby="related-by-category-title"
      className="relative my-12 overflow-hidden border-y border-border bg-muted/40 py-12 sm:py-16"
    >
      {/* Lớp trang trí */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        {/* Nền chuyển nhẹ */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-muted/60" />

        {/* Lưới chấm: góc trên phải & góc dưới trái */}
        <div className="absolute top-0 right-4 hidden h-24 w-40 bg-[radial-gradient(var(--border)_1.5px,transparent_1.5px)] [background-size:16px_16px] opacity-80 sm:block" />
        <div className="absolute bottom-0 left-4 hidden h-24 w-40 bg-[radial-gradient(var(--border)_1.5px,transparent_1.5px)] [background-size:16px_16px] opacity-80 sm:block" />

        {/* Sọc chéo đỏ hai bên (desktop) */}
        <div className="hidden md:block">
          {/* Trái: 2 dải */}
          <div className="absolute -left-24 top-[48%] h-14 w-[45%] -rotate-[12deg] bg-primary/80" />
          <div className="absolute -left-24 top-[62%] h-10 w-[45%] -rotate-[12deg] bg-primary/25" />

          {/* Phải: 2 dải mờ dần vào giữa */}
          <div className="absolute -right-24 top-[48%] h-14 w-[45%] -rotate-[12deg] bg-gradient-to-l from-primary/80 to-transparent" />
          <div className="absolute -right-24 top-[62%] h-10 w-[45%] -rotate-[12deg] bg-gradient-to-l from-primary/25 to-transparent" />
        </div>
      </div>

      {/* Tiêu đề hai tầng */}
      <div className="relative z-10 mb-10 text-center">
        {/* Eyebrow */}
        <p className="flex items-center justify-center gap-4 text-xs font-semibold uppercase tracking-[0.35em] text-primary sm:text-sm">
          <span className="h-px w-8 bg-primary sm:w-12" aria-hidden="true" />
          Sản phẩm liên quan
          <span className="h-px w-8 bg-primary sm:w-12" aria-hidden="true" />
        </p>

        {/* Title */}
        <h2
          id="related-by-category-title"
          className="mt-3 font-heading text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-4xl"
        >
          Sản phẩm cùng danh mục
        </h2>
      </div>

      {/* Carousel */}
      <div className="relative z-10 px-2 sm:px-6">
        <RotatingCardCarousel items={related} label="Sản phẩm cùng danh mục" />
      </div>
    </section>
  );
}
