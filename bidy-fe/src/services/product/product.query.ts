import {
  mapAuctionToFrontend,
  type ApiAuction,
  type ApiPagination,
} from "@/services/auction.mapper";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { API_ROUTES } from "@/constants";
import { useCategoryTree, findCategoryBySlug } from "@/services/category";
import {
  fetchAuctions,
  fetchFeaturedProducts,
  fetchProductsByCategory,
  fetchProductsByStatus,
  fetchProductById,
  fetchProductSearch,
  fetchProductCategories,
  type AuctionListParams,
  type ProductSearchParams,
} from "./product.fetcher";

// Get featured products for home page
export const useFeaturedProducts = () => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["featuredProducts"],
    queryFn: fetchFeaturedProducts,
  });

  return {
    featuredProducts: (data?.data?.items ?? []).map(mapAuctionToFrontend),
    refetchFeaturedProducts: refetch,
    isLoading,
  };
};

/**
 * Auction theo danh mục. `category` là **categoryId**, không phải slug —
 * dùng `findCategoryBySlug` từ `@/services/category` để đổi slug sang id.
 *
 * Endpoint đã phủ toàn bộ cây con, nên truyền id danh mục cha là đủ.
 */
export const useProductsByCategory = (category: string, params: AuctionListParams = {}) => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_BY_CATEGORY, category, params],
    queryFn: () => fetchProductsByCategory(category, params),
    enabled: !!category,
  });

  // Shape giờ khớp GET /auctions: { items, pagination }.
  const items: ApiAuction[] = data?.data?.items ?? [];

  return {
    categoryProducts: items.map(mapAuctionToFrontend),
    pagination: (data?.data?.pagination ?? null) as ApiPagination | null,
    refetchCategoryProducts: refetch,
    isLoading,
  };
};

/**
 * Danh sách auction toàn sàn, phân trang phía server.
 *
 * Bỏ `params.status` để lấy mọi trạng thái — `useProductsByStatus` không làm
 * được việc này vì nó tự tắt query khi `status` rỗng.
 */
export const useAuctions = (params: AuctionListParams = {}, enabled = true) => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_LIST, params],
    queryFn: () => fetchAuctions(params),
    enabled,
  });

  const items: ApiAuction[] = data?.data?.items ?? [];

  return {
    auctions: items.map(mapAuctionToFrontend),
    pagination: (data?.data?.pagination ?? null) as ApiPagination | null,
    refetchAuctions: refetch,
    isLoading,
  };
};

// Get products by status
export const useProductsByStatus = (status: string, params: Omit<AuctionListParams, 'status'> = {}) => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_LIST, status, params],
    queryFn: () => fetchProductsByStatus(status, params),
    enabled: !!status,
  });

  return {
    statusProducts: (data?.data?.items ?? []).map(mapAuctionToFrontend),
    pagination: data?.data?.pagination ?? null,
    refetchStatusProducts: refetch,
    isLoading,
  };
};

/**
 * Auction theo **slug** danh mục — dạng dùng cho route `/category/[id]`.
 *
 * URL dùng slug cho SEO nhưng endpoint nhận categoryId, nên hook này tra cây
 * danh mục để đổi slug sang id trước khi gọi. Truyền `'all'` để bỏ lọc danh mục.
 */
export const useAuctionsByCategorySlug = (slug: string, params: AuctionListParams = {}) => {
  const isAll = !slug || slug === 'all';
  const { data: tree, isPending: isTreePending } = useCategoryTree();

  const categoryId = isAll ? '' : (findCategoryBySlug(tree ?? [], slug)?.id ?? '');
  /** Slug không khớp node nào trong cây (danh mục đã xoá / gõ sai URL). */
  const isUnknownCategory = !isAll && !isTreePending && !categoryId;

  const byCategory = useProductsByCategory(isAll ? '' : categoryId, params);
  const all = useAuctions(params, isAll);

  if (isAll) {
    return {
      auctions: all.auctions,
      pagination: all.pagination,
      isLoading: all.isLoading,
      isUnknownCategory: false,
      refetch: all.refetchAuctions,
    };
  }

  return {
    auctions: byCategory.categoryProducts,
    pagination: byCategory.pagination,
    isLoading: isTreePending || byCategory.isLoading,
    isUnknownCategory,
    refetch: byCategory.refetchCategoryProducts,
  };
};

/**
 * Ba block của trang chủ, mỗi block một query độc lập để cache riêng.
 * Backend không có endpoint gộp và cũng không nên có — đổi layout thì
 * không phải sửa backend.
 */
export const useEndingSoonAuctions = (limit = 8) =>
  useProductsByStatus('happening', { sortBy: 'endDate', sortOrder: 'asc', limit });

export const useNewestAuctions = (limit = 8) =>
  useProductsByStatus('happening', { sortBy: 'createdAt', sortOrder: 'desc', limit });

/** "Sôi nổi nhất" — dựa trên `bidderCount` do backend đếm distinct bidder. */
export const useHottestAuctions = (limit = 8) =>
  useProductsByStatus('happening', { sortBy: 'bidderCount', sortOrder: 'desc', limit });

/**
 * "Sắp bắt đầu" — phiên còn `pending`, chưa mở cho đặt giá.
 *
 * Backend KHÔNG cho `sortBy: 'startDate'` (chỉ nhận endDate/createdAt/
 * currentPrice/bidderCount/totalBids), nên lấy theo `createdAt` rồi sắp xếp lại
 * theo `startDate` phía client. Vì vậy phải lấy dư rồi mới cắt: sắp theo
 * `createdAt` không đảm bảo N phiên mở sớm nhất nằm trong N phần tử đầu.
 */
export const useUpcomingAuctions = (limit = 8) =>
  useProductsByStatus('pending', {
    sortBy: 'createdAt',
    sortOrder: 'desc',
    limit: limit * 4,
  });

/**
 * Chi tiết phiên đấu giá.
 *
 * KHÔNG polling định kỳ: cập nhật realtime đến bằng push —
 *   giá + sàn bid kế tiếp → event `bidderUpdate`
 *   chuyển trạng thái      → event `auctionStatusUpdate`
 * Interval 10s trước đây là để bù cho việc chưa có realtime; giữ lại thì mỗi
 * người xem tốn 6 request/phút (và `refetchIntervalInBackground` khiến tab ẩn
 * vẫn nã), đủ chạm rate limit 300 req/15 phút của backend.
 *
 * `refetchOnWindowFocus` lo phần bù khi quay lại tab sau lúc mất kết nối;
 * trang product còn fallback polling riêng khi socket đứt hẳn.
 */
export const useProductById = (id: string) => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_BY_ID, id],
    queryFn: () => fetchProductById(id),
    enabled: !!id,
    staleTime: 5000,
    gcTime: 10000,
    refetchOnWindowFocus: true,
  });

  return {
    product: data?.data ?? null,
    refetchProduct: refetch,
    isLoading,
  };
};

// Search products
export const useProductSearch = (keyword: string, params?: ProductSearchParams) => {
  const { data, refetch, isLoading, isFetching } = useQuery({
    queryKey: [API_ROUTES.AUCTION_SEARCH, keyword, params],
    queryFn: () => fetchProductSearch(keyword, params),
    enabled: !!keyword,
    // Giữ kết quả của keyword trước trong lúc fetch keyword mới → dropdown
    // không nháy về trạng thái rỗng giữa hai lần gõ.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const rawItems: ApiAuction[] = data?.data?.items ?? data?.data?.auction ?? [];
  const items = rawItems.map(mapAuctionToFrontend);
  const total = data?.data?.total ?? items.length;

  return {
    searchResults: items,
    total,
    refetchSearch: refetch,
    isLoading,
    isFetching,
  };
};

// Get product categories
export const useProductCategories = () => {
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.AUCTION_CATEGORIES],
    queryFn: fetchProductCategories,
  });

  return {
    categories: data?.data ?? [],
    refetchCategories: refetch,
    isLoading,
  };
};