import { API_ROUTES } from "@/constants";
import axiosClient from "@/lib/axios-client";
import type { components } from "@/types/openapi";

/**
 * Kho hàng của seller — tách khỏi luồng auction.
 *
 * Product là món hàng, auction là một lần rao bán món hàng đó; một product có
 * thể đấu giá nhiều lần. Product tạo ra ở `draft` và chỉ hiện ra công khai sau
 * khi publish sang `active` (yêu cầu ≥1 ảnh). Xoá sản phẩm qua DELETE
 * (bị chặn 409 PRODUCT_HAS_LIVE_AUCTION nếu đang có phiên đấu giá diễn ra).
 */

export type CreateProductBody = components["schemas"]["CreateProductDto"];
/**
 * Trạng thái sản phẩm trong kho.
 * Backend đã bỏ `inactive` và `archived`, chỉ còn `draft` và `active`.
 * Không lấy từ openapi.d.ts vì DTO UpdateProductStatusDto đã bị backend xoá.
 */
export type ProductStatus = "draft" | "active";
export type StoredProductImage = components["schemas"]["StoredProductImage"];
/**
 * Spec chỉ khai các field riêng của endpoint này ("the rest of the product is
 * returned as-is"), nhưng response thật trả nguyên product row. Bổ sung những
 * field mà màn kho hàng cần để mở form sửa mà không phải gọi thêm request.
 */
export type MyProductListItem = components["schemas"]["MyProductListItem"] & {
  categoryId?: string;
  description?: string;
  condition?: components["schemas"]["CreateProductDto"]["condition"];
  createdAt?: string;
  updatedAt?: string;
};

interface ApiEnvelope<T> {
  status: string;
  message: string;
  data: T;
}

/**
 * Product vừa tạo. `id` là **string** — cột là bigint nên TypeORM luôn
 * serialise ra chuỗi; đừng `parseInt`. `status` luôn là `draft`.
 */
export type CreatedProduct = components["schemas"]["CreatedProduct"];

/**
 * `POST /api/v1/products` — tạo product ở status `draft`.
 *
 * Ảnh KHÔNG gửi kèm ở đây: chưa có product id thì backend không có chỗ chứa.
 * Upload ảnh bằng `uploadProductImages` sau khi có id trả về.
 */
export const createProduct = async (body: CreateProductBody) => {
  const res = await axiosClient.post<ApiEnvelope<CreatedProduct>>(
    API_ROUTES.PRODUCT_CREATE,
    body
  );
  return res.data.data;
};

/**
 * `POST /api/v1/products/:id/images` — upload tối đa 10 ảnh trong một request,
 * field `images`. Mỗi file ≤5MB và phải nằm trong `ACCEPTED_IMAGE_MIME_TYPES`.
 */
export const uploadProductImages = async (productId: string, files: File[]) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));

  const res = await axiosClient.post<ApiEnvelope<StoredProductImage[]>>(
    API_ROUTES.PRODUCT_IMAGES(productId),
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data.data;
};

/** Product đầy đủ để nạp lại vào wizard khi sửa. */
export type ProductDetail = MyProductListItem & {
  ownerId?: string;
};

/**
 * `GET /api/v1/products/:id` — chi tiết một sản phẩm.
 *
 * Khác `fetchProductById` trong `product.fetcher.ts`: hàm kia gọi `/auctions/:id`
 * (tên bị đặt lệch), trả về phiên đấu giá chứ không phải sản phẩm.
 */
export const fetchProductDetail = async (productId: string): Promise<ProductDetail> => {
  const res = await axiosClient.get<ApiEnvelope<ProductDetail>>(
    API_ROUTES.PRODUCT_BY_ID(productId)
  );
  return res.data.data;
};

export type UpdateProductBody = components["schemas"]["UpdateProductDto"];

/**
 * `PATCH /api/v1/products/:id` — sửa nội dung sản phẩm.
 *
 * Chỉ nhận `name`, `categoryId`, `description`, `condition`. Ảnh đi đường riêng
 * qua `/products/:id/images`, publish qua `/products/:id/publish`.
 */
export const updateProductInfo = async (productId: string, body: UpdateProductBody) => {
  const res = await axiosClient.patch<ApiEnvelope<unknown>>(
    API_ROUTES.PRODUCT_BY_ID(productId),
    body
  );
  return res.data.data;
};

/**
 * `POST /api/v1/products/:id/publish` — đăng bán sản phẩm (draft → active).
 *
 * Publish yêu cầu product có ≥1 ảnh (nếu không có sẽ trả lỗi 422).
 * Gọi lại khi đã active là no-op (200 OK).
 */
export const publishProduct = async (productId: string) => {
  const res = await axiosClient.post<ApiEnvelope<unknown>>(
    API_ROUTES.PRODUCT_PUBLISH(productId)
  );
  return res.data.data;
};

/**
 * `DELETE /api/v1/products/:id` — xoá sản phẩm (soft delete).
 *
 * Nếu sản phẩm đang có phiên đấu giá ở trạng thái `pending` hoặc `happening`,
 * backend sẽ chặn với mã lỗi 409 và error_code `PRODUCT_HAS_LIVE_AUCTION`.
 */
export const deleteProduct = async (productId: string) => {
  const res = await axiosClient.delete<ApiEnvelope<unknown>>(
    API_ROUTES.PRODUCT_BY_ID(productId)
  );
  return res.data.data;
};

export interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface MyProductsParams {
  page?: number;
  limit?: number;
  status?: ProductStatus;
  categoryId?: string;
  search?: string;
}

/**
 * `GET /api/v1/me/products` — kho hàng, kèm trạng thái auction để biết làm gì tiếp.
 *
 * LƯU Ý: openapi.json khai `data` là mảng phẳng — SAI. Thực tế trả về dạng phân
 * trang `{ items, pagination }` giống mọi endpoint danh sách khác. Đã đối chiếu
 * response thật. Đừng "sửa" về mảng phẳng theo spec.
 *
 * `limit` mặc định của backend là 20; picker sản phẩm cần thấy hết kho nên
 * caller chủ động truyền limit cao hơn.
 */
export const fetchMyProducts = async (
  params: MyProductsParams = {}
): Promise<{ items: MyProductListItem[]; pagination?: Pagination }> => {
  const res = await axiosClient.get<
    ApiEnvelope<{ items?: MyProductListItem[]; pagination?: Pagination }>
  >(API_ROUTES.MY_PRODUCTS, { params });

  return {
    items: res.data?.data?.items ?? [],
    pagination: res.data?.data?.pagination,
  };
};
