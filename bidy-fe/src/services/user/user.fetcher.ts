import { API_ROUTES } from "@/constants";
import axiosClient from "@/lib/axios-client";
import { getDeviceId } from "@/lib/device-id";
import {
  BodyCheckUserRequest,
  BodyRegisterRequest,
  BodyResetPasswordRequest,
  BodySigninRequest,
  ParamsWishlistAdd,
  ParamsWishlistRemove,
  WishlistResponse,
} from "@/types";

export async function register(data: BodyRegisterRequest) {
  const res = await axiosClient.post(API_ROUTES.SIGN_UP, data);
  return res.data;
}

export async function signin(data: BodySigninRequest) {
  // Luôn gửi kèm deviceId để FE làm chủ giá trị này — cần nó khi gọi logout.
  const res = await axiosClient.post(API_ROUTES.SIGN_IN, {
    ...data,
    deviceId: data.deviceId ?? getDeviceId(),
  });
  return res.data;
}

export async function fetchProfile() {
  const res = await axiosClient.get(API_ROUTES.PROFILE);
  return res.data;
}
export async function fetchStats() {
  const res = await axiosClient.get(API_ROUTES.USER_STATS);
  return res.data;
}

export const updateUser = async (data: { fullName: string; phone: string }) => {
  const res = await axiosClient.patch(API_ROUTES.UPDATE_USER, data);
  return res.data;
};

export const changePassword = async (data: {
  old_password: string;
  new_password: string;
}) => {
  const res = await axiosClient.put(API_ROUTES.CHANGE_PASS, data);
  return res.data;
};

export const forgotPassword = async (data: { email: string }) => {
  const res = await axiosClient.post(API_ROUTES.FORGOT_PASS, data);
  return res.data;
};

export const resetPassword = async (data: BodyResetPasswordRequest) => {
  const res = await axiosClient.post(API_ROUTES.RESET_PASS, data);
  return res.data;
};

export const verifyEmail = async (params: { userId: string; token: string }) => {
  const res = await axiosClient.get(API_ROUTES.VERIFY, { params });
  return res.data;
};

export const checkUser = async (data: BodyCheckUserRequest) => {
  const res = await axiosClient.post(API_ROUTES.CHECK_USER, data);
  return res.data;
};

/** Danh sách yêu thích của chính người đang đăng nhập (id lấy từ token ở BE). */
export const fetchWishlist = async (page = 1, limit = 10) => {
  const res = await axiosClient.get<{ data: WishlistResponse }>(
    API_ROUTES.WISHLIST,
    { params: { page, limit } }
  );
  return res.data;
};

export const addWishlist = async (params: ParamsWishlistAdd) => {
  const res = await axiosClient.post(
    API_ROUTES.WISHLIST_ADD.replace(":id", params.id)
  );
  return res.data;
};

export const removeWishlist = async (params: ParamsWishlistRemove) => {
  const res = await axiosClient.delete(
    API_ROUTES.WISHLIST_REMOVE.replace(":id", params.id)
  );
  return res.data;
};

export const removeAllWishlist = async () => {
  const res = await axiosClient.delete(API_ROUTES.WISHLIST_REMOVE_ALL);
  return res.data;
};

export const updateAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append('avatar', file);
  
  const res = await axiosClient.post(API_ROUTES.UPDATE_AVATAR, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};
