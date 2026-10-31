import axiosClient from '@/lib/axios-client';

/** Node của cây danh mục — `GET /api/v1/categories/tree` trả về dạng lồng nhau. */
export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  children: CategoryTreeNode[];
}

/** Item phẳng — `GET /api/v1/categories` (có `parentId` để tự dựng cây nếu cần). */
export interface CategoryListItem {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  /** Id trong bảng `files`; cần khi sửa danh mục để giữ nguyên ảnh cũ. */
  imageFileId: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ApiEnvelope<T> {
  status: string;
  message: string;
  data: T;
}

export interface CategoryListParams {
  page?: number;
  limit?: number;
  parentId?: string;
  search?: string;
  isActive?: 'true' | 'false';
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Toàn bộ cây danh mục, lồng nhau qua `children`.
 * Không giới hạn số cấp — component tiêu thụ phải đệ quy.
 */
export const fetchCategoryTree = async (): Promise<CategoryTreeNode[]> => {
  const { data } = await axiosClient.get<ApiEnvelope<CategoryTreeNode[]>>('/categories/tree');
  return data.data ?? [];
};

/** Danh sách danh mục phẳng, có phân trang và lọc theo `parentId`. */
export const fetchCategoryList = async (
  params: CategoryListParams = {},
): Promise<{ items: CategoryListItem[]; pagination: Pagination }> => {
  const { data } = await axiosClient.get<ApiEnvelope<{ items: CategoryListItem[]; pagination: Pagination }>>(
    '/categories',
    { params },
  );
  return data.data;
};

/** Danh mục con trực tiếp của một node. */
export const fetchCategoryChildren = async (id: string): Promise<CategoryListItem[]> => {
  const { data } = await axiosClient.get<ApiEnvelope<CategoryListItem[]>>(`/categories/${id}/children`);
  return data.data ?? [];
};
