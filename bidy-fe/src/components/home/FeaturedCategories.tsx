"use client";

import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { ImageWithFallback, FALLBACK_IMAGE, Skeleton } from "@/components/common";
import { CATEGORIES } from "@/config/categories.config";
import { APP_ROUTES } from "@/constants/routes.constants";
import { cn } from "@/lib/utils";
import { useCategoryTree, type CategoryTreeNode } from "@/services/category";
import { FEATURED_CATEGORIES_ID } from "./LandingHero";

const MAX_ITEMS = 4;

const tileVariants = cva(
  "group relative flex flex-col justify-between overflow-hidden border border-stone-border bg-stone text-stone-foreground transition-[background-color,border-color,box-shadow] duration-300 hover:border-stone-border-strong hover:bg-stone-hover hover:shadow-[0_22px_44px_-18px_var(--stone-shadow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  {
    variants: {
      size: {
        large: "sm:col-span-2 lg:col-span-6 lg:row-span-2 min-h-[320px] p-6 lg:p-8",
        square: "lg:col-span-3 min-h-[210px] p-6",
        wide: "sm:col-span-2 lg:col-span-6 min-h-[210px] p-6",
      },
    },
    defaultVariants: {
      size: "square",
    },
  }
);

type TileSize = NonNullable<VariantProps<typeof tileVariants>["size"]>;
const TILE_SIZES: TileSize[] = ["large", "square", "square", "wide"];

const localIcon = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.icon;

interface CategoryTileProps {
  category: CategoryTreeNode;
  size: TileSize;
}

function CategoryTile({ category, size }: CategoryTileProps) {
  const isLarge = size === "large";
  const fallback = localIcon(category.slug) ?? FALLBACK_IMAGE;

  return (
    <Link
      href={APP_ROUTES.CATEGORY_DETAIL(category.slug)}
      className={tileVariants({ size })}
    >
      <span
        aria-hidden
        className={cn(
          "block bg-stone-foreground transition-colors group-hover:bg-primary",
          isLarge ? "size-2.5" : "size-2"
        )}
      />

      <span
        className={
          isLarge
            ? "absolute right-6 top-1/2 size-48 -translate-y-1/2 lg:right-8 lg:h-[260px] lg:w-[300px]"
            : "absolute right-5 top-5 size-24 lg:size-28"
        }
      >
        <ImageWithFallback
          src={category.imageUrl ?? fallback}
          fallbackSrc={fallback}
          alt=""
          fill
          sizes={isLarge ? "300px" : "112px"}
          className="object-contain transition-transform duration-500 group-hover:scale-[1.06] motion-reduce:transition-none"
        />
      </span>

      <span className="relative flex items-end justify-between gap-4">
        <span
          className={cn(
            "line-clamp-2 font-bold tracking-[-0.03em]",
            isLarge
              ? "max-w-[340px] text-4xl leading-[1.02] lg:text-5xl"
              : "max-w-[240px] text-xl leading-[1.1] lg:text-2xl"
          )}
        >
          {category.name}
        </span>
        <span
          className={cn(
            "flex shrink-0 items-center justify-center border border-stone-foreground transition-colors group-hover:bg-stone-foreground group-hover:text-stone",
            isLarge ? "size-[52px]" : "size-10"
          )}
        >
          <ArrowUpRight className={isLarge ? "size-5" : "size-4"} aria-hidden />
        </span>
      </span>
    </Link>
  );
}

/**
 * Hàng thẻ "Danh mục nổi bật": 4 ô dạng bento bố trí bất đối xứng (1 large, 2 square, 1 wide).
 * Ảnh category có thể là presigned URL hết hạn với khách chưa đăng nhập —
 * `ImageWithFallback` lùi về ảnh tĩnh.
 */
export default function FeaturedCategories() {
  const { data: tree, isPending } = useCategoryTree();
  const categories = (tree ?? []).slice(0, MAX_ITEMS);

  return (
    <section id={FEATURED_CATEGORIES_ID} className="w-full scroll-mt-28 bg-background">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-9 px-4 pb-16 md:px-6">
        <header className="flex items-end justify-between gap-6 border-b border-stone-foreground pb-5">
          <h2 className="flex items-center gap-4 font-heading text-3xl font-bold leading-none tracking-[-0.035em] text-stone-foreground md:text-[44px]">
            <span aria-hidden className="block size-3 bg-primary md:size-3.5" />
            Danh mục nổi bật
          </h2>
          <Link
            href={APP_ROUTES.CATEGORY_ALL}
            className="group inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.2em] text-brick hover:underline hover:underline-offset-[5px] hover:decoration-2"
          >
            Xem tất cả
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:grid-rows-[210px_210px]">
          {isPending
            ? TILE_SIZES.map((size, index) => (
                <Skeleton key={index} className={tileVariants({ size })} />
              ))
            : categories.map((category, index) => (
                <CategoryTile
                  key={category.id}
                  category={category}
                  size={TILE_SIZES[index] ?? "square"}
                />
              ))}
        </div>
      </div>
    </section>
  );
}
