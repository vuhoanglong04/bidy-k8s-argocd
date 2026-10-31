"use client";

import React, { useState, useEffect } from "react";
import AdminSidebar from "@/app/admin/components/AdminSidebar";
import AdminChatDashboard from "./components/AdminChatDashboard";
import { useWebSocketNotifications } from "@/hooks/useWebSocketNotifications";
import { useWebSocketCore } from "@/hooks/useWebSocketCore";

export default function AdminSupportChatPage() {
  const [isEmbedded, setIsEmbedded] = useState(true); // Default to embedded mode

  // Check if this is a direct access to support-chat route
  useEffect(() => {
    // If the URL starts with /admin/support-chat (direct access), show sidebar
    const isDirectAccess = window.location.pathname.startsWith("/admin/support-chat");
    setIsEmbedded(!isDirectAccess);
  }, []);

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

  // Unread count from AdminChatDashboard to prevent duplicate API calls
  const [unreadCount, setUnreadCount] = React.useState(0);

  // Handle navigation from sidebar
  const handleTabChange = (newTab: string) => {
    if (newTab === "messages") {
      // Stay on current support chat page
      return;
    }
    // Navigate to admin page with selected tab
    window.location.href = `/admin?tab=${newTab}`;
  };

  // If embedded in /admin page, just return the dashboard component
  if (isEmbedded) {
    return <AdminChatDashboard onUnreadCountChange={setUnreadCount} />;
  }

  // If direct access, render with sidebar
  return (
    <div className="flex h-screen overflow-hidden bg-background flex-col lg:flex-row">
      <AdminSidebar
        tab="messages"
        setTab={handleTabChange}
        unreadChatsCount={unreadCount}
        isCollapsed={false}
      />
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="shrink-0 border-b border-border bg-background px-6 py-4">
          <h1 className="text-lg font-semibold text-foreground">Tin nhắn hỗ trợ</h1>
          <p className="text-sm text-muted-foreground">
            Hộp thoại hỗ trợ realtime với người dùng
          </p>
        </div>

        {/* Chat dashboard content */}
        <div className="flex-1 overflow-hidden">
          <AdminChatDashboard onUnreadCountChange={setUnreadCount} />
        </div>
      </div>
    </div>
  );
}