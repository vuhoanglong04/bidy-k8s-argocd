import { appConfig } from "@/config/app.config";
import { API_ROUTES } from "@/constants/routes.constants";
import type { CategoryListItem } from "@/services/category";
import type { ApiAuction, ApiPagination } from "@/services/auction.mapper";

export interface SitemapCategory {
  id: string;
  slug: string;
  updatedAt?: string;
}

export interface SitemapAuction {
  id: string;
  status: string;
  updatedAt?: string;
}

const PUBLIC_AUCTION_STATUSES = new Set(["happening", "pending", "ended"]);

/**
 * Lấy danh sách danh mục phục vụ sitemap.
 * Dùng fetch native với revalidate ISR 3600s, an toàn khi BE sập (trả về mảng rỗng).
 */
export async function fetchSitemapCategories(): Promise<SitemapCategory[]> {
  try {
    const baseUrl = (appConfig.api.baseUrl || "").replace(/\/+$/, "");
    if (!baseUrl) return [];

    const res = await fetch(`${baseUrl}/api/v1${API_ROUTES.AUCTION_CATEGORIES}?isActive=true&limit=200`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const json = await res.json();
    const rawItems: CategoryListItem[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.data?.items)
      ? json.data.items
      : [];

    return rawItems
      .filter((cat) => cat.isActive !== false && Boolean(cat.slug || cat.id))
      .map((cat) => ({
        id: cat.id,
        slug: cat.slug || cat.id,
        updatedAt: cat.updatedAt,
      }));
  } catch {
    return [];
  }
}

/**
 * Lấy danh sách phiên đấu giá công khai (happening, pending, ended) tối đa 1000 phiên.
 * Dùng fetch native với revalidate ISR 3600s, phân trang và dừng an toàn.
 */
export async function fetchSitemapAuctions(): Promise<SitemapAuction[]> {
  try {
    const baseUrl = (appConfig.api.baseUrl || "").replace(/\/+$/, "");
    if (!baseUrl) return [];

    const maxItems = 1000;
    const pageSize = 100;
    const allAuctions: SitemapAuction[] = [];
    let page = 1;

    while (allAuctions.length < maxItems) {
      const res = await fetch(
        `${baseUrl}/api/v1${API_ROUTES.AUCTION_LIST}?page=${page}&limit=${pageSize}&sortBy=createdAt&sortOrder=desc`,
        {
          next: { revalidate: 3600 },
        }
      );

      if (!res.ok) break;

      const json = await res.json();
      const rawItems: ApiAuction[] = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.data?.items)
        ? json.data.items
        : [];

      if (rawItems.length === 0) break;

      for (const item of rawItems) {
        if (item?.id && PUBLIC_AUCTION_STATUSES.has(item.status)) {
          allAuctions.push({
            id: item.id,
            status: item.status,
            updatedAt: (item as { updatedAt?: string }).updatedAt || item.createdAt || item.startDate,
          });
          if (allAuctions.length >= maxItems) break;
        }
      }

      const pagination: ApiPagination | undefined = json?.data?.pagination;
      if (!pagination?.hasNextPage || rawItems.length < pageSize) {
        break;
      }

      page++;
    }

    return allAuctions;
  } catch {
    return [];
  }
}
