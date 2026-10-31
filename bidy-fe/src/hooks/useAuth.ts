"use client";

import { usePathname, useRouter } from "next/navigation";
import { APP_ROUTES } from "@/constants/routes.constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAppCookie, removeCookie } from "@/lib/auth-cookies";
import { AppDispatch, persistor, RootState } from "@/store";
import { useSelector, useDispatch } from "react-redux";
import { setAuth } from "@/store/slices/authSlice";
import {
  clearAuthSession,
  getStoredRefreshToken,
  revokeDeviceSession,
} from "@/lib/auth-refresh";
import { getDeviceId } from "@/lib/device-id";
import { handleErrorMessage } from "@/utils/error.utils";
import { APP_CONSTANTS } from "@/constants";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      const token = getAppCookie(APP_CONSTANTS.AUTH_COOKIE_NAME);
      
      // Debug auth state (development only)
      if (process.env.NODE_ENV === 'development') {
        console.log('🔑 [DEBUG] useAuth state check', {
          hasToken: !!token,
          hasUser: !!user,
          userId: user?._id || user?.idUser,
          pathname
        });
      }
      
      if (!token) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔑 User not authenticated - no token found');
        }
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔑 User authenticated - token found', {
          userId: user?._id || user?.idUser,
          hasUser: !!user
        });
      }
      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [user, pathname]);

  // Add rehydration logic for lost Redux state
  useEffect(() => {
    if (!user) {
      const token = getAppCookie(APP_CONSTANTS.AUTH_COOKIE_NAME);
      if (token) {
        const userCookie = getAppCookie(APP_CONSTANTS.USER_COOKIE_NAME);
        if (userCookie) {
          try {
            const userData = JSON.parse(userCookie);
            dispatch(setAuth({ user: userData }));
            setIsAuthenticated(true);
            setIsLoading(false);
          } catch (error) {
            console.error('Failed to parse user cookie:', error);
            // Clean up invalid cookies
            removeCookie(APP_CONSTANTS.AUTH_COOKIE_NAME);
            removeCookie(APP_CONSTANTS.USER_COOKIE_NAME);
            setIsAuthenticated(false);
            setIsLoading(false);
          }
        }
      }
    } else {
      setIsLoading(false);
    }
  }, [user, dispatch]);

  const logout = useCallback((redirectTo?: string) => {
    // Báo BE thu hồi refresh token của thiết bị này. Phải đọc token TRƯỚC khi
    // xoá cookie, và phải là token còn hạn: BE lấy danh tính từ access token,
    // token hết hạn thì logout trả 401 và refresh token vẫn sống tiếp 7 ngày
    // trong Redis dù user đã bấm đăng xuất — đúng kịch bản để tab qua đêm rồi
    // đăng xuất. Không await: đăng xuất phía client không chờ server.
    void revokeDeviceSession(
      getDeviceId(),
      getAppCookie(APP_CONSTANTS.AUTH_COOKIE_NAME),
      getStoredRefreshToken()
    );

    // Xoá cả refresh token — sót lại thì lần vào sau interceptor sẽ lặng lẽ
    // refresh và user "tự đăng nhập lại" dù vừa bấm đăng xuất.
    clearAuthSession();
    persistor.purge();
    let url = APP_ROUTES.SIGN_IN;
    if (redirectTo) {
      url += `?redirect=${encodeURIComponent(redirectTo)}`;
    }
    router.push(url);
  }, [router]);

  const requireAuth = useCallback((redirectTo: string = APP_ROUTES.SIGN_IN) => {
    try {
      const token = getAppCookie(APP_CONSTANTS.AUTH_COOKIE_NAME);
      
      // Avoid redirecting while auth state is still loading
      if (isLoading) {
        return false;
      }
      
      // No token -> redirect to sign in and report unauthenticated
      if (!token) {
        const redirectUrl =
          redirectTo === APP_ROUTES.SIGN_IN
            ? `${APP_ROUTES.SIGN_IN}?redirect=${encodeURIComponent(pathname)}`
            : redirectTo;
        router.push(redirectUrl);
        return false;
      }
      
      // Has token -> authenticated
      return true;
    } catch (error: Error | unknown) {
      handleErrorMessage(error as Error);
      return false;
    }
  }, [isLoading, pathname, router]);

  /**
   * Giá trị trả về PHẢI ổn định giữa các lần render.
   *
   * Trước đây hook trả thẳng object literal, và `user` được spread lại
   * (`{ ...user, _id }`) nên mỗi render là một tham chiếu mới. Consumer nào đặt
   * `user` vào deps của `useEffect` sẽ có effect chạy lại mỗi render — nếu
   * effect đó gọi API rồi setState thì thành vòng lặp vô hạn (đã xảy ra thật ở
   * ProductCTA: ~500 request trong 0.5 giây).
   *
   * `useMemo` ở đây khiến tham chiếu chỉ đổi khi dữ liệu thật sự đổi. Vẫn nên
   * ưu tiên đưa `user?._id` vào deps thay vì cả object.
   */
  const normalizedUser = useMemo(
    () => (user ? { ...user, _id: user._id || user.idUser } : user),
    [user]
  );

  return useMemo(
    () => ({
      user: normalizedUser,
      isAuthenticated,
      isLoading,
      logout,
      requireAuth,
    }),
    [normalizedUser, isAuthenticated, isLoading, logout, requireAuth]
  );
}