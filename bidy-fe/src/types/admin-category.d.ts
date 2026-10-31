import { CategoryListItem } from "@/services/category";

/**
 * Danh mục dưới góc nhìn admin.
 *
 * Backend KHÔNG có endpoint list riêng cho admin: ta dùng chung
 * `GET /categories` (phẳng, có `parentId`) nhưng bỏ filter `isActive` để thấy
 * cả danh mục đang ẩn. `GET /categories/tree` không dùng được ở đây vì nó lọc
 * sẵn `isActive: true` và bị cache Redis 30 phút.
 */
export type AdminCategory = CategoryListItem;

/** Node cây do FE tự dựng từ danh sách phẳng. */
export interface AdminCategoryNode extends AdminCategory {
  children: AdminCategoryNode[];
  /** Cấp trong cây, gốc = 1. Backend chặn ở `MAX_CATEGORY_DEPTH = 3`. */
  depth: number;
}

export interface AdminCreateCategoryPayload {
  name: string;
  /** `null` = danh mục gốc. */
  parentId?: string | null;
  /** Id từ `POST /files` (purpose: `category`); `null` để gỡ ảnh. */
  imageFileId?: string | null;
}

export type AdminUpdateCategoryPayload = AdminCreateCategoryPayload;

export interface AdminUpdateCategoryStatusPayload {
  isActive: boolean;
}
