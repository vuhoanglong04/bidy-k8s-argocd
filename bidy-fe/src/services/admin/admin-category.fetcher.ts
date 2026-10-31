import { API_ROUTES } from "@/constants";
import axiosClient from "@/lib/axios-client";
import { fetchCategoryList } from "@/services/category";
import {
  AdminCategory,
  AdminCreateCategoryPayload,
  AdminUpdateCategoryPayload,
  AdminUpdateCategoryStatusPayload,
} from "@/types";

/** Số bản ghi mỗi lượt gọi khi quét toàn bộ danh mục. */
const PAGE_SIZE = 100;
/** Chặn trên số vòng lặp để một `totalItems` sai từ backend không treo UI. */
const MAX_PAGES = 20;

/**
 * Toàn bộ danh mục kể cả đang ẩn, phục vụ dựng cây trong trang quản trị.
 *
 * Backend không có endpoint list riêng cho admin, còn `/categories/tree` thì
 * lọc sẵn `isActive: true` và bị cache Redis 30 phút — cả hai đều không hợp
 * cho màn quản trị. Nên ở đây quét `GET /categories` (bỏ filter `isActive`)
 * theo trang. Cây bị chặn ở 3 cấp nên tổng số bản ghi luôn nhỏ.
 */
export const fetchAdminCategories = async (): Promise<AdminCategory[]> => {
  const all: AdminCategory[] = [];
  let page = 1;

  for (let i = 0; i < MAX_PAGES; i += 1) {
    const { items, pagination } = await fetchCategoryList({
      page,
      limit: PAGE_SIZE,
      sortBy: "name",
      sortOrder: "asc",
    });

    all.push(...items);

    if (!pagination?.hasNextPage) break;
    page += 1;
  }

  return all;
};

export const createAdminCategory = async (
  payload: AdminCreateCategoryPayload
): Promise<AdminCategory> => {
  const res = await axiosClient.post(API_ROUTES.ADMIN_CATEGORIES, payload);
  return res.data?.data;
};

export const updateAdminCategory = async (
  id: string,
  payload: AdminUpdateCategoryPayload
): Promise<AdminCategory> => {
  const res = await axiosClient.patch(
    API_ROUTES.ADMIN_CATEGORY_BY_ID(id),
    payload
  );
  return res.data?.data;
};

export const updateAdminCategoryStatus = async (
  id: string,
  payload: AdminUpdateCategoryStatusPayload
): Promise<AdminCategory> => {
  const res = await axiosClient.patch(
    API_ROUTES.ADMIN_CATEGORY_STATUS(id),
    payload
  );
  return res.data?.data;
};

/**
 * Soft delete. Backend từ chối (409) nếu danh mục còn con hoặc còn sản phẩm —
 * UI phải chuyển thông điệp đó cho người dùng thay vì nuốt lỗi.
 */
export const deleteAdminCategory = async (id: string): Promise<void> => {
  await axiosClient.delete(API_ROUTES.ADMIN_CATEGORY_BY_ID(id));
};
