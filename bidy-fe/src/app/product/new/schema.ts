import { z } from "zod";

import { PRODUCT_CONDITION } from "@/constants/app.enum";

/**
 * Bước 1 của wizard — đúng 4 field mà `POST /api/v1/products` nhận.
 * Ảnh không nằm ở đây: chưa có product id thì backend không có chỗ chứa.
 */
export const ProductInfoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Tên sản phẩm quá ngắn")
    .max(255, "Tên sản phẩm quá dài"),
  categoryId: z.string().min(1, "Vui lòng chọn danh mục"),
  condition: z.nativeEnum(PRODUCT_CONDITION, {
    errorMap: () => ({ message: "Vui lòng chọn tình trạng" }),
  }),
  description: z.string().trim().max(5000, "Mô tả quá dài").optional(),
});

export type ProductInfoForm = z.infer<typeof ProductInfoSchema>;
