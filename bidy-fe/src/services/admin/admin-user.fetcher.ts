import { API_ROUTES } from "@/constants";
import axiosClient from "@/lib/axios-client";
import {
  AdminBanUserPayload,
  AdminChangeUserRolePayload,
  AdminSuspendUserPayload,
  AdminUpdateUserProfilePayload,
  AdminUser,
  AdminUserAuditLog,
  AdminUserDetail,
  AdminUserListParams,
  AdminUserListResponse,
} from "@/types";

/**
 * Quản lý người dùng phía admin.
 *
 * Lưu ý về envelope: nhóm endpoint này KHÔNG đi qua helper `apiResponse` của
 * backend, nó trả thẳng `{ data, pagination? }` hoặc `{ message }` — không có
 * `status`/`message` như phần còn lại của API.
 */

export const fetchAdminUsers = async (
  params?: AdminUserListParams
): Promise<AdminUserListResponse> => {
  const res = await axiosClient.get(API_ROUTES.ADMIN_USERS, { params });
  return res.data;
};

export const fetchAdminUserDetail = async (
  id: string
): Promise<AdminUserDetail> => {
  const res = await axiosClient.get(API_ROUTES.ADMIN_USER_BY_ID(id));
  return res.data?.data;
};

export const updateAdminUserProfile = async (
  id: string,
  payload: AdminUpdateUserProfilePayload
): Promise<AdminUser> => {
  const res = await axiosClient.patch(API_ROUTES.ADMIN_USER_BY_ID(id), payload);
  return res.data?.data;
};

export const changeAdminUserRole = async (
  id: string,
  payload: AdminChangeUserRolePayload
): Promise<AdminUser> => {
  const res = await axiosClient.patch(API_ROUTES.ADMIN_USER_ROLE(id), payload);
  return res.data?.data;
};

/** Tạm khoá có thời hạn. Backend tự thu hồi mọi phiên đăng nhập đang mở. */
export const suspendAdminUser = async (
  id: string,
  payload: AdminSuspendUserPayload
): Promise<AdminUser> => {
  const res = await axiosClient.post(API_ROUTES.ADMIN_USER_SUSPEND(id), payload);
  return res.data?.data;
};

/** Gỡ suspend/ban, xoá luôn `statusReason` và `suspendedUntil`. */
export const activateAdminUser = async (id: string): Promise<AdminUser> => {
  const res = await axiosClient.post(API_ROUTES.ADMIN_USER_ACTIVATE(id));
  return res.data?.data;
};

/** Cấm vĩnh viễn. Idempotent: gọi lại trên tài khoản đã bị cấm không lỗi. */
export const banAdminUser = async (
  id: string,
  payload: AdminBanUserPayload
): Promise<AdminUser> => {
  const res = await axiosClient.post(API_ROUTES.ADMIN_USER_BAN(id), payload);
  return res.data?.data;
};

/** Mở khoá đăng nhập do hệ thống tự khoá (sai mật khẩu nhiều lần). */
export const unlockAdminUser = async (id: string): Promise<AdminUser> => {
  const res = await axiosClient.post(API_ROUTES.ADMIN_USER_UNLOCK(id));
  return res.data?.data;
};

export const revokeAdminUserSessions = async (id: string): Promise<void> => {
  await axiosClient.post(API_ROUTES.ADMIN_USER_REVOKE_SESSIONS(id));
};

/** Buộc đổi mật khẩu ở lần đăng nhập tới, đồng thời thu hồi mọi phiên. */
export const forceAdminUserPasswordReset = async (id: string): Promise<void> => {
  await axiosClient.post(API_ROUTES.ADMIN_USER_FORCE_PASSWORD_RESET(id));
};

export const fetchAdminUserAuditLogs = async (
  id: string
): Promise<AdminUserAuditLog[]> => {
  const res = await axiosClient.get(API_ROUTES.ADMIN_USER_AUDIT_LOGS(id));
  return res.data?.data ?? [];
};
