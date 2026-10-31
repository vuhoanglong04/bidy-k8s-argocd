import { useQuery } from '@tanstack/react-query';

import {
  fetchCategoryChildren,
  fetchCategoryList,
  fetchCategoryTree,
  type CategoryListParams,
  type CategoryTreeNode,
} from './category.fetcher';

export const categoryKeys = {
  all: ['category'] as const,
  tree: () => [...categoryKeys.all, 'tree'] as const,
  list: (params: CategoryListParams) => [...categoryKeys.all, 'list', params] as const,
  children: (id: string) => [...categoryKeys.all, 'children', id] as const,
};

/**
 * Cây danh mục ít thay đổi nên cache dài để tránh gọi lại ở mọi trang.
 */
const TREE_STALE_TIME = 30 * 60 * 1000; // 30 phút
// Dưới 60 phút: ảnh trong cây danh mục là presigned URL sống đúng 1 giờ, giữ
// cache lâu hơn thế là phục vụ URL đã hết hạn.
const TREE_GC_TIME = 45 * 60 * 1000; // 45 phút

export const useCategoryTree = () =>
  useQuery({
    queryKey: categoryKeys.tree(),
    queryFn: fetchCategoryTree,
    staleTime: TREE_STALE_TIME,
    gcTime: TREE_GC_TIME,
    refetchOnWindowFocus: false,
  });

export const useCategoryList = (params: CategoryListParams = {}) =>
  useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => fetchCategoryList(params),
    staleTime: TREE_STALE_TIME,
    refetchOnWindowFocus: false,
  });

export const useCategoryChildren = (id: string, enabled = true) =>
  useQuery({
    queryKey: categoryKeys.children(id),
    queryFn: () => fetchCategoryChildren(id),
    enabled: enabled && Boolean(id),
    staleTime: TREE_STALE_TIME,
  });

/**
 * Danh sách danh mục phẳng đang hoạt động — dùng cho select/dropdown 1 cấp
 * (ví dụ form đăng sản phẩm). Với navigation đa cấp hãy dùng `useCategoryTree`.
 */
export const useActiveCategories = () => {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: categoryKeys.list({ isActive: 'true', limit: 200, sortBy: 'name', sortOrder: 'asc' }),
    queryFn: () => fetchCategoryList({ isActive: 'true', limit: 200, sortBy: 'name', sortOrder: 'asc' }),
    staleTime: TREE_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    categories: data?.items ?? [],
    isPending,
    error,
    refetch,
  };
};

/** Duyệt cây theo chiều sâu, trả về node đầu tiên khớp `slug`. */
export const findCategoryBySlug = (nodes: CategoryTreeNode[], slug: string): CategoryTreeNode | null => {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const found = findCategoryBySlug(node.children ?? [], slug);
    if (found) return found;
  }
  return null;
};

/** Đường dẫn từ gốc tới node khớp `slug` — dùng cho breadcrumb. */
export const findCategoryPath = (nodes: CategoryTreeNode[], slug: string): CategoryTreeNode[] => {
  for (const node of nodes) {
    if (node.slug === slug) return [node];
    const childPath = findCategoryPath(node.children ?? [], slug);
    if (childPath.length) return [node, ...childPath];
  }
  return [];
};
