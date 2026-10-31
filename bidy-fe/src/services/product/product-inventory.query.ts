"use client";

import { isAxiosError } from "axios";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { handleErrorMessage } from "@/utils/error.utils";
import {
  createProduct,
  deleteProduct,
  fetchMyProducts,
  fetchProductDetail,
  publishProduct,
  updateProductInfo,
  uploadProductImages,
  type MyProductsParams,
  type UpdateProductBody,
} from "./product-inventory.fetcher";

export const productInventoryKeys = {
  all: ["product-inventory"] as const,
  mine: () => [...productInventoryKeys.all, "mine"] as const,
  mineList: (params: MyProductsParams) =>
    [...productInventoryKeys.mine(), params] as const,
  detail: (id: string) => [...productInventoryKeys.all, "detail", id] as const,
};

/** Bước 1 của wizard — tạo draft, trả về id để bước 2 gắn ảnh vào. */
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onError: (error) => handleErrorMessage(error),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productInventoryKeys.mine() });
    },
  });
};

/** Bước 2 — upload cả loạt ảnh trong một request. */
export const useUploadProductImages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, files }: { productId: string; files: File[] }) =>
      uploadProductImages(productId, files),
    onError: (error) => handleErrorMessage(error),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productInventoryKeys.mine() });
    },
  });
};

/** Chi tiết một sản phẩm — dùng để nạp lại wizard khi sửa. */
export const useProductDetail = (productId: string | null) =>
  useQuery({
    queryKey: productInventoryKeys.detail(productId ?? ""),
    queryFn: () => fetchProductDetail(productId as string),
    enabled: Boolean(productId),
    staleTime: 0,
  });

/** Sửa nội dung sản phẩm (tên, danh mục, mô tả, tình trạng). */
export const useUpdateProductInfo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, body }: { productId: string; body: UpdateProductBody }) =>
      updateProductInfo(productId, body),
    onError: (error) => handleErrorMessage(error),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productInventoryKeys.mine() });
    },
  });
};

/** Bước 3 — publish sản phẩm để đưa vào trạng thái active. */
export const usePublishProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => publishProduct(productId),
    onError: (error) => handleErrorMessage(error),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productInventoryKeys.mine() });
    },
  });
};

/** Xoá sản phẩm khỏi kho hàng. Chặn nếu có live auction (error_code: PRODUCT_HAS_LIVE_AUCTION). */
export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => deleteProduct(productId),
    onError: (error) => {
      if (isAxiosError<{ error_code?: string; message?: string }>(error)) {
        const errorCode = error.response?.data?.error_code;
        if (errorCode === "PRODUCT_HAS_LIVE_AUCTION") {
          toast.error("Sản phẩm đang có phiên đấu giá, không thể xoá");
          return;
        }
      }
      handleErrorMessage(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productInventoryKeys.mine() });
    },
  });
};

/** Kho hàng của chính user. `canCreateAuction` cho biết product nào đăng đấu giá được. */
export const useMyProducts = (params: MyProductsParams = {}, enabled = true) =>
  useQuery({
    queryKey: productInventoryKeys.mineList(params),
    queryFn: () => fetchMyProducts(params),
    enabled,
  });
