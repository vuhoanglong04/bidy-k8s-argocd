import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/hooks";
import {
  AdminBanUserPayload,
  AdminChangeUserRolePayload,
  AdminSuspendUserPayload,
  AdminUpdateUserProfilePayload,
  AdminUserListParams,
} from "@/types";
import { handleErrorMessage } from "@/utils/error.utils";
import {
  activateAdminUser,
  banAdminUser,
  changeAdminUserRole,
  fetchAdminUserAuditLogs,
  fetchAdminUserDetail,
  fetchAdminUsers,
  forceAdminUserPasswordReset,
  revokeAdminUserSessions,
  suspendAdminUser,
  unlockAdminUser,
  updateAdminUserProfile,
} from "./admin-user.fetcher";

export const adminUserKeys = {
  all: ["admin", "users"] as const,
  list: (params?: AdminUserListParams) =>
    [...adminUserKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...adminUserKeys.all, "detail", id] as const,
  auditLogs: (id: string) => [...adminUserKeys.all, "audit-logs", id] as const,
};

export const useAdminUserList = (params?: AdminUserListParams) => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading, isError, error } = useQuery({
    queryKey: adminUserKeys.list(params),
    queryFn: () => fetchAdminUsers(params),
    enabled: isAuthenticated,
    // Cursor-based list: giữ trang cũ khi đổi params để bảng không nháy trắng.
    placeholderData: (previous) => previous,
  });

  return {
    users: data?.data ?? [],
    pagination: data?.pagination,
    hasNext: data?.pagination?.hasNext ?? false,
    refetchUsers: refetch,
    isLoading,
    isError,
    error,
  };
};

export const useAdminUserDetail = (id?: string) => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading, isError, error } = useQuery({
    queryKey: adminUserKeys.detail(id ?? ""),
    queryFn: () => fetchAdminUserDetail(id as string),
    enabled: isAuthenticated && Boolean(id),
  });

  return {
    user: data ?? null,
    refetchUser: refetch,
    isLoading,
    isError,
    error,
  };
};

export const useAdminUserAuditLogs = (id?: string) => {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: adminUserKeys.auditLogs(id ?? ""),
    queryFn: () => fetchAdminUserAuditLogs(id as string),
    enabled: isAuthenticated && Boolean(id),
  });

  return { auditLogs: data ?? [], isLoading, isError };
};

/**
 * Mọi mutation quản trị đều đụng tới cùng một người dùng, nên sau khi thành
 * công ta làm mới cả danh sách, chi tiết lẫn nhật ký thao tác của người đó.
 */
const useAdminUserMutation = <TVariables extends { id: string }, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  successMessage: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onError: handleErrorMessage,
    onSuccess: (_data, variables) => {
      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
      queryClient.invalidateQueries({
        queryKey: adminUserKeys.detail(variables.id),
      });
    },
  });
};

export const useUpdateAdminUserProfile = () =>
  useAdminUserMutation(
    ({ id, payload }: { id: string; payload: AdminUpdateUserProfilePayload }) =>
      updateAdminUserProfile(id, payload),
    "Cập nhật hồ sơ người dùng thành công!"
  );

export const useChangeAdminUserRole = () =>
  useAdminUserMutation(
    ({ id, payload }: { id: string; payload: AdminChangeUserRolePayload }) =>
      changeAdminUserRole(id, payload),
    "Đổi vai trò thành công!"
  );

export const useSuspendAdminUser = () =>
  useAdminUserMutation(
    ({ id, payload }: { id: string; payload: AdminSuspendUserPayload }) =>
      suspendAdminUser(id, payload),
    "Đã tạm khoá tài khoản."
  );

export const useActivateAdminUser = () =>
  useAdminUserMutation(
    ({ id }: { id: string }) => activateAdminUser(id),
    "Đã kích hoạt lại tài khoản."
  );

export const useBanAdminUser = () =>
  useAdminUserMutation(
    ({ id, payload }: { id: string; payload: AdminBanUserPayload }) =>
      banAdminUser(id, payload),
    "Đã cấm tài khoản."
  );

export const useUnlockAdminUser = () =>
  useAdminUserMutation(
    ({ id }: { id: string }) => unlockAdminUser(id),
    "Đã mở khoá đăng nhập."
  );

export const useRevokeAdminUserSessions = () =>
  useAdminUserMutation(
    ({ id }: { id: string }) => revokeAdminUserSessions(id),
    "Đã thu hồi toàn bộ phiên đăng nhập."
  );

export const useForceAdminUserPasswordReset = () =>
  useAdminUserMutation(
    ({ id }: { id: string }) => forceAdminUserPasswordReset(id),
    "Đã buộc người dùng đặt lại mật khẩu."
  );
