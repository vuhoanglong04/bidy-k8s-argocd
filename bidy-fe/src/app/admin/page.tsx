"use client";
import React, { useState } from "react";
import AdminSidebar, { ADMIN_NAV_ITEMS } from "./components/AdminSidebar";
import AdminTopbar from "./components/AdminTopbar";
import { useAdminAuctions, useAdminUserList } from "@/services/admin";
import { useWebSocketNotifications } from "@/hooks/useWebSocketNotifications";
import { useWebSocketCore } from "@/hooks/useWebSocketCore";

// Import components directly for immediate loading - eliminating lazy loading delay
import AdminDashboardContent from "./components/AdminDashboardContent";
import AdminProductList from "./components/AdminProductList";
import AdminAuctionRequestList from "./components/AdminAuctionRequestList";
import AdminCategoryList from "./components/AdminCategoryList";
import AdminUserList from "./components/AdminUserList";
import AdminFinanceContent from "./components/AdminFinanceContent";
import AdminSupportChatPage from "./support-chat/page";

const TAB_DESCRIPTIONS: Record<string, string> = {
  dashboard: "Tổng hợp số liệu và hoạt động mới nhất của sàn đấu giá",
  products: "Theo dõi và quản lý toàn bộ phiên đấu giá trên hệ thống",
  "auction-requests": "Duyệt yêu cầu đăng phiên đấu giá của người bán",
  categories: "Quản lý cây danh mục phân cấp tối đa 3 cấp",
  users: "Tra cứu, xem chi tiết và khoá tài khoản người dùng",
  finance: "Quản lý dòng tiền, tiền tạm giữ, duyệt chi rút tiền và điều chỉnh số dư",
  messages: "Hộp thoại hỗ trợ realtime với người dùng",
};

export default function AdminPage() {
  const [tab, setTab] = useState("dashboard");

  // Initialize tab from URL query parameter
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabFromUrl = urlParams.get("tab");
    if (
      tabFromUrl &&
      [
        "dashboard",
        "products",
        "auction-requests",
        "categories",
        "users",
        "finance",
        "messages",
      ].includes(tabFromUrl)
    ) {
      setTab(tabFromUrl);
    }
  }, []);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  // Tab người dùng tự fetch chi tiết theo id, nên ở đây chỉ giữ id để điều
  // hướng chéo từ dashboard sang.
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Initialize WebSocket connection for admin
  const { connect, isConnected } = useWebSocketCore();

  // Initialize WebSocket notifications
  useWebSocketNotifications();

  // Connect to WebSocket when component mounts
  React.useEffect(() => {
    if (!isConnected) {
      connect();
    }
  }, [connect, isConnected]);
  // Danh sách rút gọn chỉ phục vụ thẻ "Người dùng mới" trên dashboard; tab
  // người dùng có bộ lọc và phân trang riêng.
  const { users: recentUsers } = useAdminUserList({ limit: 4 });
  const [paramsProduct, setParamsProduct] = useState({
    page: 1,
    limit: 10,
    search: "",
  });
  const {
    auctions: products,
    pagination,
  } = useAdminAuctions({
    page: paramsProduct.page,
    limit: paramsProduct.limit,
    search: paramsProduct.search,
  });

  // Support chat unread count - lightweight fetch
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread count only once on mount and when tab changes to/from support-chat
  React.useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        // Import axiosClient dynamically to avoid SSR issues
        const { default: axiosClient } = await import("@/lib/axios-client");
        const { API_ROUTES } = await import("@/constants/routes.constants");
        const response = await axiosClient.get(
          API_ROUTES.ADMIN_SUPPORT_CHATS_UNREAD_COUNT
        );

        if (response.data?.success) {
          setUnreadCount(response.data.data?.unreadCount || 0);
        }
      } catch (error) {
        // Silently fail - unread count is not critical for UX
        console.debug("Could not fetch unread count:", error);
        setUnreadCount(0);
      }
    };

    fetchUnreadCount();
  }, [tab]); // Only refetch when switching tabs

  const activeNavItem =
    ADMIN_NAV_ITEMS.find((item) => item.key === tab) ?? ADMIN_NAV_ITEMS[0];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/40 lg:flex-row">
      <AdminSidebar
        tab={tab}
        setTab={setTab}
        unreadChatsCount={unreadCount}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopbar
          section={activeNavItem.label}
          description={TAB_DESCRIPTIONS[tab]}
          isConnected={isConnected}
        />

        <main className="flex-1 overflow-hidden">
          {tab === "dashboard" && (
            <div className="h-full overflow-auto p-5">
              <AdminDashboardContent
                setTab={setTab}
                setSelectedAuctionId={setSelectedAuctionId}
                setSelectedUserId={setSelectedUserId}
                users={recentUsers}
              />
            </div>
          )}
          {tab === "products" && (
            <div className="h-full overflow-auto p-5">
              <AdminProductList
                selectedAuctionId={selectedAuctionId}
                setSelectedAuctionId={setSelectedAuctionId}
                paramsProduct={paramsProduct}
                setParamsProduct={setParamsProduct}
                products={products}
                totalPagesProducts={pagination?.totalPages ?? 1}
                currentPageProduct={pagination?.page ?? 1}
              />
            </div>
          )}
          {tab === "auction-requests" && (
            <div className="h-full overflow-auto p-5">
              <AdminAuctionRequestList />
            </div>
          )}
          {tab === "categories" && (
            <div className="h-full overflow-auto p-5">
              <AdminCategoryList />
            </div>
          )}
          {tab === "users" && (
            <div className="h-full overflow-auto p-5">
              <AdminUserList
                setTab={setTab}
                setSelectedAuctionId={setSelectedAuctionId}
                selectedUserId={selectedUserId}
                setSelectedUserId={setSelectedUserId}
              />
            </div>
          )}
          {tab === "finance" && (
            <div className="h-full overflow-auto p-5">
              <AdminFinanceContent />
            </div>
          )}
          {/* Messages tab fills the entire available space without padding */}
          {tab === "messages" && <AdminSupportChatPage />}
        </main>
      </div>
    </div>
  );
}
