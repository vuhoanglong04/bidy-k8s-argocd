"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutGrid, Search, X } from "lucide-react";
import { ImageWithFallback, FALLBACK_IMAGE, Skeleton } from "@/components/common";
import { CATEGORIES } from "@/config/categories.config";
import { cn } from "@/lib/utils";
import { useCategoryTree, type CategoryTreeNode } from "@/services/category";

interface CategoryRailProps {
  /** Slug danh mục đang xem; `all` nghĩa là không lọc danh mục. */
  activeSlug: string;
}

const ALL_SLUG = "all";
const ALL_IMAGE = "/categories/tat-ca-danh-muc.webp";

/** Bỏ dấu + lowercase để gõ "dong ho" vẫn ra "Đồng hồ". */
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

const localIcon = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.icon;

/**
 * Rail danh mục dạng kính mờ:
 * - Nền là ảnh của danh mục đang xem, blur mạnh — mỗi danh mục cho rail một
 *   "không khí" màu riêng, các thẻ kính nổi phía trên.
 * - Ô tìm nhanh (không phân biệt dấu) cho cây nhiều nhánh.
 * - Ảnh category có thể là presigned URL hết hạn với khách chưa đăng nhập;
 *   `ImageWithFallback` tự lùi về ảnh tĩnh trong `public/` nên không vỡ.
 */
export default function CategoryRail({ activeSlug }: Readonly<CategoryRailProps>) {
  const { data: tree, isPending } = useCategoryTree();
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

  const isAllActive = activeSlug === ALL_SLUG;
  const normalizedQuery = normalize(query);
  const isSearching = normalizedQuery.length > 0;

  const visibleTree = useMemo<CategoryTreeNode[]>(() => {
    const nodes = tree ?? [];
    if (!isSearching) return nodes;
    return nodes.flatMap((node) => {
      if (normalize(node.name).includes(normalizedQuery)) return [node];
      const children = node.children.filter((child) =>
        normalize(child.name).includes(normalizedQuery)
      );
      return children.length > 0 ? [{ ...node, children }] : [];
    });
  }, [tree, isSearching, normalizedQuery]);

  // Ảnh nền ambient = ảnh của danh mục đang xem (cha hoặc con).
  const ambientImage = useMemo(() => {
    if (isAllActive || !tree) return ALL_IMAGE;
    for (const node of tree) {
      if (node.slug === activeSlug) return node.imageUrl ?? localIcon(node.slug) ?? ALL_IMAGE;
      const child = node.children.find((c) => c.slug === activeSlug);
      if (child) {
        return child.imageUrl ?? node.imageUrl ?? localIcon(child.slug) ?? ALL_IMAGE;
      }
    }
    return ALL_IMAGE;
  }, [activeSlug, isAllActive, tree]);

  return (
    <nav
      aria-label="Danh mục"
      className="relative isolate overflow-hidden border border-border/60 bg-card shadow-xl"
    >
      {/* Lớp ambient: ảnh danh mục đang xem, blur + phủ một lớp card mờ */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <ImageWithFallback
          key={ambientImage}
          src={ambientImage}
          fallbackSrc={ALL_IMAGE}
          alt=""
          fill
          sizes="320px"
          className="scale-150 object-cover opacity-70 blur-3xl saturate-150 motion-safe:animate-fade-in dark:opacity-50"
        />
        <div className="absolute inset-0 bg-card/60" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center border border-primary/40 bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <LayoutGrid className="size-4" aria-hidden />
          </span>
          <h2 className="font-heading text-lg font-bold text-foreground">Danh mục</h2>
        </div>
      </div>

      {/* Tìm nhanh */}
      <div className="px-3 pb-3">
        <label className="relative flex items-center">
          <span className="sr-only">Tìm danh mục</span>
          <Search
            className="pointer-events-none absolute left-3 z-10 size-4 text-foreground-secondary"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm danh mục…"
            className="h-10 w-full border border-border/60 bg-card/50 pl-9 pr-9 text-sm text-foreground shadow-inner backdrop-blur-md placeholder:text-foreground-secondary focus:border-primary focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Xoá tìm kiếm"
              className="absolute right-1.5 flex size-7 cursor-pointer items-center justify-center text-foreground-secondary transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </label>
      </div>

      <div className="flex flex-col gap-2 px-3 pb-3">
        {!isSearching && (
          <GlassTile
            href={`/category/${ALL_SLUG}`}
            active={isAllActive}
            image={ALL_IMAGE}
            title="Tất cả phiên đấu giá"
          />
        )}

        {isPending ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex h-16 items-center gap-3 border border-border/50 bg-card/40 p-2 backdrop-blur-md"
            >
              <Skeleton className="size-11 shrink-0 rounded-none" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-2/3 rounded-none" />
              </div>
            </div>
          ))
        ) : visibleTree.length === 0 ? (
          <div className="border border-dashed border-border/70 bg-card/40 px-4 py-6 text-center backdrop-blur-md">
            <p className="text-sm font-medium text-foreground">
              Không có danh mục nào khớp “{query.trim()}”
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-2 cursor-pointer text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Xoá từ khoá
            </button>
          </div>
        ) : (
          visibleTree.map((node) => {
            const active = node.slug === activeSlug;
            const childActive = node.children.some((child) => child.slug === activeSlug);
            const hasChildren = node.children.length > 0;
            const isExpanded =
              isSearching || (expandedState[node.id] ?? (active || childActive));
            const panelId = `category-rail-${node.id}`;
            const nodeImage = node.imageUrl ?? localIcon(node.slug);

            return (
              <div key={node.id} className="flex flex-col gap-1.5">
                <GlassTile
                  href={`/category/${node.slug}`}
                  active={active}
                  highlighted={childActive}
                  image={nodeImage}
                  fallbackImage={localIcon(node.slug)}
                  title={node.name}
                  action={
                    hasChildren && !isSearching ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedState((prev) => ({ ...prev, [node.id]: !isExpanded }))
                        }
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        aria-label={isExpanded ? `Thu gọn ${node.name}` : `Mở rộng ${node.name}`}
                        className="flex size-8 shrink-0 cursor-pointer items-center justify-center border border-border/50 bg-card/60 text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <ChevronDown
                          aria-hidden
                          className={cn(
                            "size-4 transition-transform duration-300 motion-reduce:transition-none",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </button>
                    ) : undefined
                  }
                />

                {hasChildren && isExpanded && (
                  <div
                    id={panelId}
                    className="ml-5 flex flex-col gap-1 border-l-2 border-primary/30 pl-2 motion-safe:animate-slide-up"
                  >
                    {node.children.map((child) => {
                      const childIsActive = child.slug === activeSlug;
                      return (
                        <Link
                          key={child.id}
                          href={`/category/${child.slug}`}
                          aria-current={childIsActive ? "page" : undefined}
                          className={cn(
                            "group flex min-w-0 items-center gap-2.5 border p-1.5 pr-2 text-[13px] font-medium backdrop-blur-md transition-all focus-visible:outline-2 focus-visible:outline-ring",
                            childIsActive
                              ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30"
                              : "border-border/50 bg-card/50 text-foreground hover:translate-x-0.5 hover:border-primary/60 hover:bg-card/80 hover:shadow-md motion-reduce:hover:translate-x-0"
                          )}
                        >
                          <span className="relative size-7 shrink-0 overflow-hidden">
                            <ImageWithFallback
                              src={child.imageUrl ?? localIcon(child.slug) ?? nodeImage}
                              fallbackSrc={localIcon(child.slug) ?? nodeImage ?? FALLBACK_IMAGE}
                              alt=""
                              fill
                              sizes="28px"
                              className="object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                          </span>
                          <span className="truncate">{child.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </nav>
  );
}

interface GlassTileProps {
  href: string;
  active: boolean;
  /** Có danh mục con đang được xem bên trong. */
  highlighted?: boolean;
  image?: string | null;
  fallbackImage?: string;
  title: string;
  action?: React.ReactNode;
}

/** Thẻ kính cấp 1: thumbnail + tên, nút phụ nằm bên phải. */
function GlassTile({
  href,
  active,
  highlighted,
  image,
  fallbackImage,
  title,
  action,
}: Readonly<GlassTileProps>) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 border p-1.5 backdrop-blur-md transition-all",
        active
          ? "border-primary bg-primary/15 shadow-lg shadow-primary/20 ring-1 ring-primary"
          : highlighted
            ? "border-primary/50 bg-card/60 shadow-md"
            : "border-border/50 bg-card/45 hover:border-primary/50 hover:bg-card/70 hover:shadow-lg"
      )}
    >
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span
          className={cn(
            "relative size-11 shrink-0 overflow-hidden border",
            active ? "border-primary" : "border-border/40"
          )}
        >
          <ImageWithFallback
            src={image}
            fallbackSrc={fallbackImage ?? FALLBACK_IMAGE}
            alt=""
            fill
            sizes="44px"
            className="object-cover transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none"
          />
        </span>
        <span
          className={cn(
            "line-clamp-2 min-w-0 font-heading text-sm leading-tight",
            active ? "font-bold text-primary" : "font-semibold text-foreground"
          )}
        >
          {title}
        </span>
      </Link>
      {action}
    </div>
  );
}
