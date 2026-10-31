"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, MoreHorizontal, X, MessageSquare } from "lucide-react";

import {
  AdminChatListItem,
  AdminChatFilters,
  AdminChatStats,
  AdminChatPagination,
} from "@/types/admin-chat";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/common/loading";

import ChatCardMessenger from "./ChatCardMessenger";

interface ExtendedChatItem extends AdminChatListItem {
  priorityIndicator: "unread" | "needs_response" | "recently_replied" | "inactive" | "default";
}

interface ChatListSidebarProps {
  chats: ExtendedChatItem[];
  selectedChatId: string | null;
  filters: AdminChatFilters;
  stats: AdminChatStats;
  pagination: AdminChatPagination;
  isLoading: boolean;
  onChatSelect: (chatId: string) => void;
  onFilterChange: (filters: Partial<AdminChatFilters>) => void;
  onLoadMore: () => void;
  onBulkAction: (action: string, chatIds: string[], value?: string) => void;
}

export default function ChatListSidebar({
  chats,
  selectedChatId,
  filters,
  stats,
  pagination,
  isLoading,
  onChatSelect,
  onFilterChange,
  onLoadMore,
  onBulkAction,
}: ChatListSidebarProps) {
  const [searchValue, setSearchValue] = useState(filters.search || "");
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      onFilterChange({ search: searchValue });
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchValue, onFilterChange]);

  // Simplified filter - only show unread messages filter
  const quickFilters = [
    {
      id: "unread",
      label: "Chưa đọc",
      count: Object.values(stats).reduce(
        (total: number, statusStats: { count: number; unread: number }) => {
          return total + (statusStats.unread || 0);
        },
        0
      ),
      active: filters.unread === "unread",
      onClick: () =>
        onFilterChange({ unread: filters.unread === "unread" ? "all" : "unread" }),
    },
  ];

  // Handle bulk selection
  const handleSelectAll = () => {
    if (selectedChats.length === chats.length) {
      setSelectedChats([]);
    } else {
      setSelectedChats(chats.map((chat) => chat.id));
    }
  };

  const handleChatToggleSelect = (chatId: string) => {
    setSelectedChats((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const handleBulkActionClick = (action: string, value?: string) => {
    if (selectedChats.length > 0) {
      onBulkAction(action, selectedChats, value);
      setSelectedChats([]);
    }
    setShowBulkActions(false);
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchValue("");
    onFilterChange({
      status: "all",
      priority: "all",
      unread: "all",
      search: "",
    });
  };

  // Get active filter count
  const activeFilterCount = Object.entries(filters).filter(
    ([, value]) => value && value !== "all" && value !== ""
  ).length;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Search Bar */}
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
          />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Tìm kiếm theo tên, tin nhắn..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="h-9 rounded-none border-border bg-background pl-9 pr-8 text-sm placeholder:text-muted-foreground"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => setSearchValue("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Xóa tìm kiếm"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Filters */}
      <div className="border-b border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {quickFilters.map((filter) => (
              <Button
                key={filter.id}
                variant={filter.active ? "default" : "outline"}
                size="sm"
                onClick={filter.onClick}
                className="h-7 cursor-pointer rounded-none px-2.5 text-xs"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    filter.id === "unread" ? "bg-destructive" : "bg-muted-foreground",
                    filter.active && "bg-primary-foreground"
                  )}
                  aria-hidden
                />
                <span>{filter.label}</span>
                {filter.count > 0 && (
                  <span
                    className={cn(
                      "ml-1 font-mono tabular-nums",
                      filter.active ? "text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    ({filter.count})
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Clear filters if any active */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-7 cursor-pointer rounded-none px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedChats.length > 0 && (
        <div className="border-b border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={selectedChats.length === chats.length && chats.length > 0}
                onChange={handleSelectAll}
                className="rounded-none border-border"
              />
              <span>Đã chọn {selectedChats.length} cuộc trò chuyện</span>
            </label>

            <div className="relative">
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="h-7 cursor-pointer rounded-none px-2.5 text-xs"
              >
                <MoreHorizontal size={14} />
                <span>Thao tác</span>
              </Button>

              {showBulkActions && (
                <div className="absolute right-0 top-full z-10 mt-1 w-48 border border-border bg-background py-1 shadow-none">
                  <button
                    type="button"
                    onClick={() => handleBulkActionClick("mark_resolved")}
                    className="w-full px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Đánh dấu đã giải quyết
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkActionClick("mark_closed")}
                    className="w-full px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Đóng cuộc trò chuyện
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkActionClick("change_priority", "high")}
                    className="w-full px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Đặt độ ưu tiên cao
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && chats.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner size="md" tone="primary" />
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <MessageSquare size={32} className="mx-auto mb-3 text-muted-foreground" />
            <h3 className="mb-1 text-sm font-semibold text-foreground">Không có tin nhắn</h3>
            <p className="max-w-xs text-xs text-muted-foreground">
              {activeFilterCount > 0
                ? "Không có tin nhắn nào phù hợp với bộ lọc hiện tại"
                : "Chưa có tin nhắn hỗ trợ nào từ người dùng"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {chats.map((chat, index) => (
              <ChatCardMessenger
                key={chat.id}
                chat={chat}
                isSelected={selectedChatId === chat.id}
                isMultiSelectMode={selectedChats.length > 0}
                isChecked={selectedChats.includes(chat.id)}
                shortcutNumber={index < 9 ? index + 1 : undefined}
                onSelect={() => onChatSelect(chat.id)}
                onToggleSelect={() => handleChatToggleSelect(chat.id)}
              />
            ))}

            {/* Load More */}
            {pagination.hasMore && (
              <div className="p-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLoadMore}
                  disabled={isLoading}
                  className="w-full cursor-pointer rounded-none border-border text-xs"
                >
                  {isLoading ? (
                    <Spinner size="xs" tone="muted" label="Đang tải..." />
                  ) : (
                    `Tải thêm tin nhắn (${pagination.total - chats.length} còn lại)`
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}