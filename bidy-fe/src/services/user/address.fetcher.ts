import { API_ROUTES } from "@/constants";
import axiosClient from "@/lib/axios-client";

/**
 * Địa chỉ giao hàng của chính người đang đăng nhập.
 *
 * `id` và `userId` là bigint của Postgres nên về dạng **chuỗi** — không khai
 * `number`, đây đúng là cái bẫy đã làm `productId` nói dối về kiểu của nó.
 */
export interface Address {
  id: string;
  userId: string;
  street: string;
  city: string;
  state: string;
  zipCode: string | null;
  isDefault: boolean;
  /**
   * `Address` kế thừa `BaseEntity` của backend nên hai mốc thời gian này là
   * **snake_case**, khác với các field còn lại. Đừng "sửa" thành camelCase cho
   * đồng bộ — payload thật trả về đúng tên dưới đây.
   */
  created_at?: string;
  updated_at?: string;
}

/** POST cần đủ street/city/state; `isDefault` để backend tự quyết nếu bỏ trống. */
export interface CreateAddressBody {
  street: string;
  city: string;
  state: string;
  zipCode?: string | null;
  isDefault?: boolean;
}

/**
 * PATCH là partial — chỉ gửi field thực sự đổi.
 *
 * `isDefault: false` là **no-op** ở backend: mặc định chỉ được *chuyển* sang
 * địa chỉ khác chứ không tắt được, nếu không user sẽ có địa chỉ mà không có
 * mặc định và mua ngay lại chết. Muốn đổi thì gọi `setDefaultAddress` trên
 * địa chỉ đích — UI vì thế là nút "Đặt mặc định", không phải toggle.
 */
export type UpdateAddressBody = Partial<CreateAddressBody>;

export const fetchAddresses = async (): Promise<Address[]> => {
  const res = await axiosClient.get<{ data: Address[] }>(API_ROUTES.ADDRESSES);
  return res.data?.data ?? [];
};

export const createAddress = async (body: CreateAddressBody) => {
  const res = await axiosClient.post<{ data: Address }>(
    API_ROUTES.ADDRESSES,
    body
  );
  return res.data?.data;
};

export const updateAddress = async (id: string, body: UpdateAddressBody) => {
  const res = await axiosClient.patch<{ data: Address }>(
    API_ROUTES.ADDRESS_BY_ID(id),
    body
  );
  return res.data?.data;
};

export const deleteAddress = async (id: string) => {
  const res = await axiosClient.delete(API_ROUTES.ADDRESS_BY_ID(id));
  return res.data;
};

/**
 * Backend gỡ mặc định cũ trong cùng transaction, nên FE không cần tự đảm bảo
 * "chỉ có một mặc định" — chỉ việc invalidate lại danh sách.
 */
export const setDefaultAddress = async (id: string) => {
  const res = await axiosClient.patch<{ data: Address }>(
    API_ROUTES.ADDRESS_SET_DEFAULT(id)
  );
  return res.data?.data;
};
