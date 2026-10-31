"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { AdminChatFilters, AdminChatDetail, AdminMessage } from "@/types/admin-chat";
import { useAdminSupportChats } from "@/hooks/useAdminSupportChats";
import { useAdminChatDetail } from "@/hooks/useAdminChatDetail";
import { useNotifications } from "@/contexts/NotificationContext";
import { markAdminChatAsRead } from "@/services/admin/admin-chat.fetcher";
import { Button } from "@/components/ui/button";
import { APP_ROUTES } from "@/constants/routes.constants";

import ChatListSidebar from "./ChatListSidebar";
import ActiveChatWindow from "./ActiveChatWindow";

interface ErrorWithMessage {
  message?: string;
}

const INITIAL_FILTERS: AdminChatFilters = {
  status: "all",
  priority: "all",
  unread: "all",
  search: "",
};

interface AdminChatDashboardProps {
  onUnreadCountChange?: (count: number) => void;
}

export default function AdminChatDashboard({
  onUnreadCountChange,
}: AdminChatDashboardProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get chatId from URL query parameter only
  const urlChatId = searchParams.get("chat");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(urlChatId || null);
  const [filters, setFilters] = useState<AdminChatFilters>(INITIAL_FILTERS);
  const { markChatNotificationsAsRead } = useNotifications();

  // Update selectedChatId when URL changes
  useEffect(() => {
    const urlChatId = searchParams.get("chat");
    if (urlChatId && urlChatId !== selectedChatId) {
      setSelectedChatId(urlChatId);
    }
  }, [searchParams, selectedChatId]);

  // Chat list data
  const {
    chats,
    stats,
    pagination,
    isLoading: isListLoading,
    error: listError,
    isConnected,
    updateFilters,
    refreshChats,
    performBulkAction,
    unreadCount,
    changePage,
  } = useAdminSupportChats({
    initialPage: 1,
    initialLimit: 20,
    initialFilters: filters,
  });

  // Selected chat detail data
  const {
    chat: selectedChat,
    messages: selectedMessages,
    isLoading: isChatLoading,
    error: chatError,
    sendMessage,
    loadMoreMessages,
    isLoadingMore,
  } = useAdminChatDetail(selectedChatId ? { chatId: selectedChatId } : { chatId: "" });

  // Memoized chat list with priority indicators
  const prioritizedChats = useMemo(() => {
    return chats
      .map((chat) => {
        let priorityIndicator:
          | "default"
          | "unread"
          | "inactive"
          | "needs_response"
          | "recently_replied" = "default";

        if (chat.unreadByAdmin > 0) {
          priorityIndicator = "unread";
        } else if (chat.status === "open" && !chat.lastAdminReplyAt) {
          priorityIndicator = "needs_response";
        } else if (
          chat.lastAdminReplyAt &&
          new Date().getTime() - new Date(chat.lastAdminReplyAt).getTime() < 3600000
        ) {
          priorityIndicator = "recently_replied";
        } else {
          priorityIndicator = "inactive";
        }

        return {
          ...chat,
          priorityIndicator,
        };
      })
      .sort((a, b) => {
        // Sort by priority: unread > needs_response > recently_replied > inactive
        const priorityOrder = {
          unread: 0,
          needs_response: 1,
          recently_replied: 2,
          inactive: 3,
          default: 4,
        };

        const aPriority = priorityOrder[a.priorityIndicator as keyof typeof priorityOrder];
        const bPriority = priorityOrder[b.priorityIndicator as keyof typeof priorityOrder];

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // If same priority, sort by last message time.
        // `lastMessageAt` là null khi ticket chưa có tin nhắn nào — đẩy xuống cuối.
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [chats]);

  // Handle chat selection
  const handleChatSelect = useCallback(
    async (chatId: string) => {
      // Always clear frontend notifications for this chat
      markChatNotificationsAsRead(chatId);

      // Call backend API to mark chat as read
      try {
        await markAdminChatAsRead(chatId);
      } catch (error) {
        console.warn("⚠️ Failed to mark chat as read on backend:", error);
      }

      if (selectedChatId === chatId) return;

      setSelectedChatId(chatId);

      // Update URL without full navigation - use query parameter instead of route parameter
      window.history.replaceState(null, "", `/admin/support-chat?chat=${chatId}`);
    },
    [selectedChatId, markChatNotificationsAsRead]
  );

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<AdminChatFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    updateFilters(updatedFilters);
  };

  // Handle sending messages
  const handleSendMessage = async (message: string) => {
    if (!selectedChatId || !message.trim()) return;

    try {
      await sendMessage(message, "text");
    } catch (error: unknown) {
      const errorWithMessage = error as ErrorWithMessage;
      toast.error(errorWithMessage.message || "Không thể gửi tin nhắn");
    }
  };

  // Load more chats
  const handleLoadMore = () => {
    if (pagination.hasMore && !isListLoading) {
      changePage((prev) => prev + 1);
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action: string, chatIds: string[], value?: string) => {
    try {
      const validAction = action as "mark_resolved" | "mark_closed" | "change_priority";
      await performBulkAction(chatIds, validAction, value);
      toast.success("Thao tác thực hiện thành công");
    } catch (err: unknown) {
      const errorWithMessage = err as ErrorWithMessage;
      toast.error(errorWithMessage.message || "Có lỗi xảy ra khi thực hiện thao tác");
    }
  };

  // Clear notifications for initially selected chat
  useEffect(() => {
    if (selectedChatId) {
      markChatNotificationsAsRead(selectedChatId);
    }
  }, [selectedChatId, markChatNotificationsAsRead]);

  // Notify parent about unread count changes
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl + 1-9 for quick chat selection
      if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (prioritizedChats[index]) {
          handleChatSelect(prioritizedChats[index].id);
        }
      }

      // Escape to clear selection (mobile friendly)
      if (e.key === "Escape" && window.innerWidth < 768) {
        setSelectedChatId(null);
        router.push(APP_ROUTES.ADMIN_SUPPORT_CHAT);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [prioritizedChats, router, handleChatSelect]);

  // Handle connection status
  const connectionStatus = isConnected ? (
    <div className="flex items-center gap-1.5 text-xs font-medium text-success">
      <Wifi size={14} />
      <span>Đã kết nối</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
      <WifiOff size={14} />
      <span>Mất kết nối</span>
    </div>
  );

  if (listError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md border border-border bg-background p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 size-10 text-destructive" />
          <h3 className="mb-1 text-base font-semibold text-foreground">Có lỗi xảy ra</h3>
          <p className="mb-4 text-sm text-muted-foreground">{listError}</p>
          <Button
            onClick={refreshChats}
            variant="default"
            className="cursor-pointer rounded-none"
          >
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Chat List Sidebar */}
      <div
        className={`
          ${selectedChatId ? "hidden md:flex" : "flex"} 
          h-full w-full shrink-0 flex-col overflow-hidden border-r border-border bg-background md:w-[380px]
        `}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-background p-4">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-base font-semibold text-foreground">Hỗ trợ trực tuyến</h1>
            {connectionStatus}
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full bg-destructive" aria-hidden />
              <span className="font-medium tabular-nums text-foreground">{unreadCount}</span>
              <span>chưa đọc</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full bg-info" aria-hidden />
              <span className="font-medium tabular-nums text-foreground">
                {stats.open?.count || 0}
              </span>
              <span>đang mở</span>
            </div>
          </div>
        </div>

        <ChatListSidebar
          chats={prioritizedChats}
          selectedChatId={selectedChatId}
          filters={filters}
          stats={stats}
          pagination={pagination}
          isLoading={isListLoading}
          onChatSelect={handleChatSelect}
          onFilterChange={handleFilterChange}
          onLoadMore={handleLoadMore}
          onBulkAction={handleBulkAction}
        />
      </div>

      {/* Chat Window */}
      <div
        className={`
          ${selectedChatId ? "flex" : "hidden md:flex"} 
          h-full flex-1 flex-col overflow-hidden bg-background
        `}
      >
        {selectedChatId ? (
          <ActiveChatWindow
            chat={
              selectedChat
                ? ({
                    ...selectedChat,
                    updatedAt: selectedChat.lastMessageAt || selectedChat.createdAt,
                  } as AdminChatDetail)
                : null
            }
            messages={selectedMessages as AdminMessage[]}
            isLoading={isChatLoading}
            error={chatError}
            hasMoreMessages={false}
            isLoadingMore={isLoadingMore}
            onSendMessage={handleSendMessage}
            onLoadMore={loadMoreMessages}
            onBack={() => {
              setSelectedChatId(null);
              router.push(APP_ROUTES.ADMIN_SUPPORT_CHAT);
            }}
          />
        ) : (
          // Welcome screen
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <MessageSquare size={40} className="mx-auto mb-3 text-muted-foreground" />
              <h3 className="mb-1 text-sm font-semibold text-foreground">
                Chưa chọn cuộc trò chuyện
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Chọn một cuộc trò chuyện từ danh sách bên trái để bắt đầu hỗ trợ khách hàng
              </p>
              <div className="inline-flex items-center gap-1.5 border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                <span>
                  Mẹo: Nhấn <kbd className="font-mono font-semibold text-foreground">Ctrl + 1-9</kbd>{" "}
                  để chọn nhanh
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile overlay backdrop */}
      {selectedChatId && (
        <div
          className="fixed inset-0 z-40 bg-overlay md:hidden"
          onClick={() => setSelectedChatId(null)}
        />
      )}
    </div>
  );
}