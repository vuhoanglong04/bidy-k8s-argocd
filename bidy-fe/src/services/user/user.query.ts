"use client";
import { API_ROUTES, APP_CONSTANTS, APP_ROUTES } from "@/constants";
import { useAuth } from "@/hooks";
import { setAppCookie } from "@/lib/auth-cookies";
import { persistTokens } from "@/lib/auth-refresh";
import {
  addWishlist,
  changePassword,
  checkUser,
  fetchProfile,
  fetchStats,
  fetchWishlist,
  forgotPassword,
  register,
  removeAllWishlist,
  removeWishlist,
  resetPassword,
  signin,
  updateUser,
  updateAvatar,
  verifyEmail,
} from "@/services/user/user.fetcher";
import { User } from "@/types/user";
import { handleErrorMessage, handleSuccessMessage } from "@/utils/error.utils";
import logger from "@/utils/logger";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

export const useRegister = () => {
  const router = useRouter();
  
  return useMutation({
    mutationFn: register,
    onError: (error) => handleErrorMessage(error),
    onSuccess(data) {
      const successMessage = data?.message ?? 
        "Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.";
      handleSuccessMessage(successMessage);
      router.push(APP_ROUTES.SIGN_IN);
    },
  });
};

export const useSignin = (onSuccessCallback?: (profile: User | null) => void | Promise<void>) => {
  return useMutation({
    mutationFn: signin,
    onError: (error) => handleErrorMessage(error),
    onSuccess: async (data) => {
      const successMessage = data?.message ?? "Đăng nhập thành công!";
      handleSuccessMessage(successMessage);
      // Login trả cả access token (15m) lẫn refresh token (7d) — phải giữ cả
      // hai, thiếu refresh token thì phiên chết ngay khi access token hết hạn.
      persistTokens(data?.data?.token ?? "", data?.data?.refreshToken);
      logger.debug('User signed in successfully', { userId: data?.data?.id });

      // The login response carries no `role`, but auth.middleware.ts gates the
      // /admin routes on the role read back from this cookie — so the user
      // cookie has to come from the profile endpoint, which does return it.
      const profile: User | null = (await fetchProfile())?.data ?? null;
      setAppCookie(
        APP_CONSTANTS.USER_COOKIE_NAME,
        JSON.stringify(profile ?? "")
      );

      // Call custom success callback if provided
      if (onSuccessCallback) {
        await onSuccessCallback(profile);
      } else {
        // Force page refresh to ensure middleware sees the new cookie
        // This prevents the redirect issue in production builds
        window.location.href = APP_ROUTES.PROFILE;
      }
    },
  });
};

export const useProfile = () => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.PROFILE],
    queryFn: fetchProfile,
    enabled: isAuthenticated,
  });

  return {
    profile: data?.data ?? null,
    refetchProfile: refetch,
    isLoading,
  };
};
export const useUserStats = () => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.USER_STATS],
    queryFn: fetchStats,
    enabled: isAuthenticated,
  });

  return {
    stats: data?.data ?? null,
    refetchProfile: refetch,
    isLoading,
  };
};

export const useUpdateUser = () => {
  return useMutation({
    mutationFn: updateUser,
    onError: (error) => handleErrorMessage(error),
    onSuccess: (data) => {
      const successMessage = data?.message ?? "Cập nhật thông tin thành công!";
      handleSuccessMessage(successMessage);
    },
  });
};

export const useChangePassword = () => {
  const pathname = usePathname();
  const { logout } = useAuth();
  return useMutation({
    mutationFn: changePassword,
    onError: (error) => handleErrorMessage(error),
    onSuccess: (data) => {
      const successMessage = data?.message ?? "Đổi mật khẩu thành công!";
      handleSuccessMessage(successMessage);
      logout(pathname);
    },
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: forgotPassword,
    onError: (error) => handleErrorMessage(error),
    onSuccess: (data) => {
      const successMessage = data?.message ?? 
        "Vui lòng kiểm tra email để nhận liên kết đặt lại mật khẩu!";
      handleSuccessMessage(successMessage);
    },
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: resetPassword,
    onError: (error) => handleErrorMessage(error),
    onSuccess: (data) => {
      const successMessage = data?.message ?? "Đặt lại mật khẩu thành công!";
      handleSuccessMessage(successMessage);
    },
  });
};

export const useVerifyEmail = () => {
  return useMutation({
    mutationFn: verifyEmail,
    onError: (error) => handleErrorMessage(error),
    onSuccess: (data) => {
      const successMessage = data?.message ?? "Xác thực email thành công!";
      handleSuccessMessage(successMessage);
    },
  });
};

export const useCheckUser = () => {
  return useMutation({
    mutationFn: checkUser,
    onError: (error) => handleErrorMessage(error),
    onSuccess: () => toast.success("Valid user information."),
  });
};

export const useWishlist = (page: number, limit: number) => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading } = useQuery({
    queryKey: [API_ROUTES.WISHLIST, page, limit],
    queryFn: () => fetchWishlist(page, limit),
    enabled: isAuthenticated,
  });
  return {
    data: data?.data ?? null,
    items: data?.data?.wishlist ?? [],
    totalCount: data?.data?.totalWishlist ?? 0,
    totalPages: data?.data?.totalPages ?? 0,
    refetch,
    isLoading,
  };
};

export const useAddWishlist = () => {
  return useMutation({
    mutationFn: addWishlist,
    // Toast thành công do component tự hiển thị (tiếng Việt, theo ngữ cảnh);
    // component KHÔNG toast lỗi — onError ở đây là nơi duy nhất.
    onError: (error) => handleErrorMessage(error),
  });
};

export const useRemoveWishlist = () => {
  return useMutation({
    mutationFn: removeWishlist,
    onError: (error) => handleErrorMessage(error),
  });
};

export const useRemoveAllWishlist = () => {
  return useMutation({
    mutationFn: removeAllWishlist,
    onError: (error) => handleErrorMessage(error),
    onSuccess: () => toast.success("Cleared wishlist"),
  });
};

export const useUpdateAvatar = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateAvatar,
    onError: (error) => handleErrorMessage(error),
    onSuccess: (data) => {
      const successMessage = data?.message ?? "Cập nhật ảnh đại diện thành công!";
      handleSuccessMessage(successMessage);
      
      // Invalidate profile query to force refetch
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.PROFILE] });
      
      // Also invalidate user stats in case it has avatar data
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.USER_STATS] });
    },
  });
};
