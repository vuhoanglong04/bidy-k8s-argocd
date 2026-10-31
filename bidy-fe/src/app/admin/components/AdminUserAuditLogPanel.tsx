"use client";

import React from "react";

import { LoadingState } from "@/components/common/loading";
import { useAdminUserAuditLogs } from "@/services/admin";
import { formatDateTime } from "@/utils";
import AdminPanel from "./AdminPanel";

/** Nhãn tiếng Việt cho `action` của backend (`AdminAuditLog.action`). */
const ACTION_LABELS: Record<string, string> = {
  UPDATE_PROFILE: "Sửa hồ sơ",
  CHANGE_ROLE: "Đổi vai trò",
  SUSPEND_USER: "Tạm khoá",
  ACTIVATE_USER: "Kích hoạt lại",
  BAN_USER: "Cấm tài khoản",
  UNLOCK_USER: "Mở khoá đăng nhập",
  REVOKE_SESSIONS: "Thu hồi phiên đăng nhập",
  FORCE_PASSWORD_RESET: "Buộc đặt lại mật khẩu",
};

export default function AdminUserAuditLogPanel({ userId }: { userId: string }) {
  const { auditLogs, isLoading, isError } = useAdminUserAuditLogs(userId);

  return (
    <AdminPanel title="Nhật ký thao tác quản trị" flush>
      <LoadingState
        isLoading={isLoading}
        isError={isError}
        isEmpty={auditLogs.length === 0}
        emptyMessage="Chưa có thao tác quản trị nào trên tài khoản này."
      >
        <ol className="divide-y divide-border">
          {auditLogs.map((log) => (
            <li key={log.id} className="px-5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Bởi {log.adminUsername ?? log.adminId}
              </p>
              {log.reason && (
                <p className="mt-1 text-sm text-foreground-secondary">
                  Lý do: {log.reason}
                </p>
              )}
            </li>
          ))}
        </ol>
      </LoadingState>
    </AdminPanel>
  );
}
