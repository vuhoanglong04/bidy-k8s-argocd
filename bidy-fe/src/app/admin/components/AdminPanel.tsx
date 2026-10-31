import React from "react";

import { cn } from "@/lib/utils";

interface AdminPanelProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Tiêu đề panel. Bỏ trống nếu panel không cần header. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Nội dung căn phải trên header: filter, select, nút hành động… */
  action?: React.ReactNode;
  /** Bỏ padding mặc định của body — dùng khi body là bảng tràn viền. */
  flush?: boolean;
  bodyClassName?: string;
}

/**
 * Khối nội dung chuẩn của admin console: viền mảnh, nền card, không bo góc.
 * Mọi bảng / biểu đồ / form chi tiết trong `/admin` đều bọc bằng component này
 * để giữ nhịp thị giác đồng nhất.
 */
export default function AdminPanel({
  title,
  description,
  action,
  flush = false,
  bodyClassName,
  className,
  children,
  ...props
}: AdminPanelProps) {
  const hasHeader = Boolean(title || description || action);

  return (
    <section
      className={cn("border border-border bg-background", className)}
      {...props}
    >
      {hasHeader && (
        <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-sm font-semibold tracking-wide text-foreground uppercase">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(!flush && "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export type { AdminPanelProps };
