"use client";

import React from "react";
import {
  LayoutDashboard,
  FolderTree,
  Gavel,
  ClipboardCheck,
  Users,
  Landmark,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { useNotifications } from "@/contexts/NotificationContext";
import { useAuth } from "@/hooks/useAuth";
import { APP_ROUTES } from "@/constants/routes.constants";

interface AdminSidebarProps {
  tab: string;
  setTab: (tab: string) => void;
  unreadChatsCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface AdminNavItem {
  key: string;
  label: string;
  /** Nhãn ngắn cho thanh tab mobile. */
  shortLabel: string;
  icon: React.ReactNode;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    key: "dashboard",
    label: "Tổng quan",
    shortLabel: "Tổng quan",
    icon: <LayoutDashboard size={18} />,
  },
  {
    key: "products",
    label: "Phiên đấu giá",
    shortLabel: "Đấu giá",
    icon: <Gavel size={18} />,
  },
  {
    key: "auction-requests",
    label: "Duyệt phiên",
    shortLabel: "Duyệt",
    icon: <ClipboardCheck size={18} />,
  },
  {
    key: "categories",
    label: "Danh mục",
    shortLabel: "Danh mục",
    icon: <FolderTree size={18} />,
  },
  {
    key: "users",
    label: "Người dùng",
    shortLabel: "Người dùng",
    icon: <Users size={18} />,
  },
  {
    key: "finance",
    label: "Tài chính",
    shortLabel: "Tài chính",
    icon: <Landmark size={18} />,
  },
  {
    key: "messages",
    label: "Tin nhắn hỗ trợ",
    shortLabel: "Tin nhắn",
    icon: <MessageCircle size={18} />,
  },
];

function UnreadDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function AdminSidebar({
  tab,
  setTab,
  unreadChatsCount = 0,
  isCollapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const { unreadCount } = useNotifications();
  const { logout } = useAuth();
  const router = useRouter();
  const totalUnreadCount = Math.max(unreadCount, unreadChatsCount);

  const handleLogout = () => {
    logout();
    router.push(APP_ROUTES.SIGN_IN);
  };

  return (
    <>
      {/* ---------- Rail điều hướng (desktop) ---------- */}
      <aside
        className={cn(
          "hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex h-14 items-center border-b border-sidebar-border",
            isCollapsed ? "justify-center px-0" : "justify-between px-4"
          )}
        >
          {!isCollapsed && (
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 items-center justify-center bg-primary text-xs font-bold text-primary-foreground">
                B
              </span>
              <span className="truncate text-sm font-semibold tracking-wide text-sidebar-foreground uppercase">
                Bidy Admin
              </span>
            </div>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="cursor-pointer p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label={isCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
              title={isCollapsed ? "Mở rộng" : "Thu gọn"}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {!isCollapsed && (
            <span className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Quản trị
            </span>
          )}
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive = tab === item.key;
            const badgeCount = item.key === "messages" ? totalUnreadCount : 0;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                title={isCollapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                  isCollapsed && "justify-center px-0",
                  isActive
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                {/* Chỉ báo mục đang chọn */}
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 w-0.5 bg-primary transition-opacity",
                    isActive ? "opacity-100" : "opacity-0"
                  )}
                  aria-hidden
                />
                <span className="relative flex items-center justify-center">
                  {item.icon}
                  {isCollapsed && badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 size-2 rounded-full bg-primary" />
                  )}
                </span>
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    <UnreadDot count={badgeCount} />
                  </>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            title={isCollapsed ? "Đăng xuất" : undefined}
            className={cn(
              "group relative mt-1 flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-destructive",
              isCollapsed && "justify-center px-0"
            )}
          >
            <span className="relative flex items-center justify-center">
              <LogOut size={18} />
            </span>
            {!isCollapsed && <span className="flex-1 truncate text-left">Đăng xuất</span>}
          </button>
        </nav>

        {/* Chân rail */}
        <div
          className={cn(
            "flex h-12 items-center border-t border-sidebar-border",
            isCollapsed ? "justify-center" : "justify-between px-4"
          )}
        >
          {!isCollapsed && (
            <span className="text-xs text-muted-foreground">Bảng điều khiển</span>
          )}
          <ThemeToggle />
        </div>
      </aside>

      {/* ---------- Thanh tab (mobile / tablet) ---------- */}
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-background px-2 scrollbar-hide lg:hidden">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = tab === item.key;
          const badgeCount = item.key === "messages" ? totalUnreadCount : 0;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex cursor-pointer items-center gap-2 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {item.icon}
              <span>{item.shortLabel}</span>
              <UnreadDot count={badgeCount} />
            </button>
          );
        })}

        <button
          type="button"
          onClick={handleLogout}
          className="flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-destructive"
        >
          <LogOut size={18} />
          <span>Đăng xuất</span>
        </button>
      </nav>
    </>
  );
}
