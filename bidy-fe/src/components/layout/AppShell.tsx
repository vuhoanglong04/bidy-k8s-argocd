"use client";

import { usePathname } from "next/navigation";
import { APP_ROUTES } from "@/constants/routes.constants";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { SearchParamsWrapper } from "@/components/common/SearchParamsWrapper";
import { SupportChatWidget } from "@/components/support-chat/SupportChatWidget";
import Header from "./Header";
import Footer from "./Footer";

/**
 * Quyết định "vỏ" của app theo vai trò.
 *
 * - admin: không Header/Footer của user, không widget chat hỗ trợ (admin là
 *   phía trả lời chat, không phải phía hỏi). Chỉ render children — layout riêng
 *   của khu admin nằm ở `app/admin/layout.tsx`.
 * - user/guest: shell mặc định Header + content + Footer.
 *
 * Trong lúc auth còn khôi phục từ cookie, đường dẫn `/admin` cũng được coi là
 * shell admin để Header không loé lên rồi biến mất.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useIsAdmin();
  const pathname = usePathname();

  const isAdminRoute =
    pathname === APP_ROUTES.ADMIN ||
    pathname.startsWith(`${APP_ROUTES.ADMIN}/`);

  if (isAdmin || isAdminRoute) {
    return <div data-shell="admin">{children}</div>;
  }

  return (
    <div data-shell="user">
      <SearchParamsWrapper>
        <Header />
      </SearchParamsWrapper>
      {children}
      <Footer />
      <SupportChatWidget />
    </div>
  );
}

export default AppShell;
