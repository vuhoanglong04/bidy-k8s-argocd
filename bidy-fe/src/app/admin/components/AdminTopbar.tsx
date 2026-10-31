"use client";

import React from "react";
import { ChevronRight } from "lucide-react";

import AdminNotifications from "./AdminNotifications";

interface AdminTopbarProps {
  /** Tên mục đang mở, hiển thị ở cuối breadcrumb. */
  section: string;
  /** Mô tả ngắn dưới breadcrumb. */
  description?: string;
  /** Trạng thái kết nối realtime của admin. */
  isConnected?: boolean;
  /** Nội dung phụ căn phải (nút hành động của từng trang). */
  children?: React.ReactNode;
}

export default function AdminTopbar({
  section,
  description,
  isConnected,
  children,
}: AdminTopbarProps) {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-background px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
          <span>Admin</span>
          <ChevronRight size={12} aria-hidden />
          <span className="truncate text-foreground">{section}</span>
        </nav>
        <h1 className="mt-0.5 truncate text-lg font-bold text-foreground">{section}</h1>
        {description && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {children}
        {typeof isConnected === "boolean" && (
          <span
            className="flex items-center gap-1.5 border border-border px-2.5 py-1 text-xs text-muted-foreground"
            title={isConnected ? "Đã kết nối realtime" : "Mất kết nối realtime"}
          >
            <span
              className={
                isConnected
                  ? "size-1.5 rounded-full bg-success"
                  : "size-1.5 rounded-full bg-destructive"
              }
              aria-hidden
            />
            {isConnected ? "Trực tuyến" : "Ngoại tuyến"}
          </span>
        )}
        <AdminNotifications />
      </div>
    </header>
  );
}
