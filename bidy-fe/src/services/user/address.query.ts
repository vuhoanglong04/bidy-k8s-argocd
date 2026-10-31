"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_ROUTES } from "@/constants";
import { useAuth } from "@/hooks";
import {
  createAddress,
  deleteAddress,
  fetchAddresses,
  setDefaultAddress,
  updateAddress,
  type CreateAddressBody,
  type UpdateAddressBody,
} from "./address.fetcher";

export const addressKeys = {
  all: [API_ROUTES.ADDRESSES] as const,
};

/**
 * Copy tiếng Việt cho `error_code` của sổ địa chỉ. Message của backend là
 * tiếng Anh thô nên không hiển thị thẳng.
 */
const ADDRESS_ERRORS: Record<string, string> = {
  ADDRESS_NOT_FOUND: "Địa chỉ không còn tồn tại.",
  ADDRESS_IN_USE: "Địa chỉ này đang gắn với đơn hàng, không thể xoá.",
};

function resolveAddressError(error: unknown, fallback: string): string {
  const data =
    error && typeof error === "object" && "response" in error
      ? (error.response as { data?: { error_code?: string } } | undefined)?.data
      : undefined;

  return ADDRESS_ERRORS[data?.error_code ?? ""] ?? fallback;
}

export const useAddresses = () => {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: addressKeys.all,
    queryFn: fetchAddresses,
    enabled: isAuthenticated,
  });

  return {
    addresses: data ?? [],
    /**
     * Backend giữ bất biến: có ít nhất một địa chỉ thì luôn có đúng một mặc
     * định. Đây chính là địa chỉ mà luồng "mua ngay" sẽ dùng.
     */
    defaultAddress: data?.find((address) => address.isDefault) ?? null,
    isLoading,
    isError,
    refetch,
  };
};

/** Mọi mutation đều invalidate cả danh sách: cờ mặc định có thể đổi ở nhiều dòng. */
const useAddressMutation = <TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  successMessage: string,
  fallbackError: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all });
      toast.success(successMessage);
    },
    onError: (error) => toast.error(resolveAddressError(error, fallbackError)),
  });
};

export const useCreateAddress = () =>
  useAddressMutation(
    (body: CreateAddressBody) => createAddress(body),
    "Đã thêm địa chỉ",
    "Không thêm được địa chỉ. Vui lòng thử lại."
  );

export const useUpdateAddress = () =>
  useAddressMutation(
    ({ id, body }: { id: string; body: UpdateAddressBody }) =>
      updateAddress(id, body),
    "Đã cập nhật địa chỉ",
    "Không cập nhật được địa chỉ. Vui lòng thử lại."
  );

export const useDeleteAddress = () =>
  useAddressMutation(
    (id: string) => deleteAddress(id),
    "Đã xoá địa chỉ",
    "Không xoá được địa chỉ. Vui lòng thử lại."
  );

export const useSetDefaultAddress = () =>
  useAddressMutation(
    (id: string) => setDefaultAddress(id),
    "Đã đặt làm địa chỉ mặc định",
    "Không đặt được địa chỉ mặc định. Vui lòng thử lại."
  );
