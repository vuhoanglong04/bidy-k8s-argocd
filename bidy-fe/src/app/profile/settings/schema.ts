import { z } from "zod";

export const ProfileFormSchema = z.object({
  name: z.string().min(2, "Tên không hợp lệ"),
  username: z.string(), // disabled, but still required
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().regex(/^\d{10,11}$/, "Số điện thoại không hợp lệ"), // optional: adjust regex
});

export type ProfileForm = z.infer<typeof ProfileFormSchema>;

/**
 * Địa chỉ giao hàng. `street`/`city`/`state` là bắt buộc theo DTO của backend;
 * `zipCode` nullable nên form dùng chuỗi rỗng rồi quy về `null` khi gửi đi.
 */
export const AddressFormSchema = z.object({
  street: z.string().trim().min(3, "Địa chỉ quá ngắn").max(255, "Địa chỉ quá dài"),
  city: z.string().trim().min(1, "Vui lòng nhập tỉnh/thành phố").max(100),
  state: z.string().trim().min(1, "Vui lòng nhập quận/huyện").max(100),
  zipCode: z
    .string()
    .trim()
    .max(20, "Mã bưu chính quá dài")
    .optional()
    .or(z.literal("")),
});

export type AddressForm = z.infer<typeof AddressFormSchema>; 