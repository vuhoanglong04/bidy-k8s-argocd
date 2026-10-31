"use client";

import { useMemo } from "react";
import { useAuth } from "./useAuth";

export const ADMIN_ROLE = "admin";

export interface UseIsAdminResult {
  /** true khi user đã đăng nhập và role là 'admin' */
  isAdmin: boolean;
  /** auth state còn đang khôi phục từ cookie/redux-persist */
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Hook global duy nhất để hỏi "user hiện tại có phải admin không".
 *
 * Trước đây điều kiện `user?.role === 'admin'` bị lặp ở Header, ProfileSidebar,
 * useAdminChat… — mỗi chỗ một cách viết. Mọi chỗ cần phân quyền admin ở client
 * phải dùng hook này. Guard thật vẫn nằm ở `middlewares/auth.middleware.ts`
 * (chặn route `/admin`), hook chỉ quyết định phần render.
 */
export function useIsAdmin(): UseIsAdminResult {
  const { user, isAuthenticated, isLoading } = useAuth();

  return useMemo(
    () => ({
      isAdmin: Boolean(isAuthenticated && user?.role === ADMIN_ROLE),
      isLoading,
      isAuthenticated,
    }),
    [isAuthenticated, isLoading, user?.role]
  );
}
