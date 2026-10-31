"use client";

import React from "react";
import { User, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

import { AdminChatListItem } from "@/types/admin-chat";
import { toValidDate } from "@/utils/common.utils";
import { cn } from "@/lib/utils";

interface ExtendedChatItem extends AdminChatListItem {
  priorityIndicator: "unread" | "needs_response" | "recently_replied" | "inactive" | "default";
}

interface ChatCardMessengerProps {
  chat: ExtendedChatItem;
  isSelected: boolean;
  isMultiSelectMode: boolean;
  isChecked: boolean;
  shortcutNumber?: number;
  onSelect: () => void;
  onToggleSelect: () => void;
}

export default function ChatCardMessenger({
  chat,
  isSelected,
  isMultiSelectMode,
  isChecked,
  shortcutNumber,
  onSelect,
  onToggleSelect,
}: ChatCardMessengerProps) {
  const hasUnreadMessages = chat.unreadByAdmin > 0;

  // Truncate message
  const truncateMessage = (message: string, maxLength: number = 60) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + "...";
  };

  // Format time safely
  const formatTime = (date?: Date | string | null) => {
    const messageDate = toValidDate(date);
    if (!messageDate) return "";

    const now = new Date();
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return formatDistanceToNow(messageDate, {
        addSuffix: true,
        locale: vi,
      });
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "relative flex cursor-pointer items-center gap-3 p-3 text-left transition-colors",
        isSelected
          ? "border-l-2 border-primary bg-accent"
          : "bg-background hover:bg-accent/60"
      )}
      onClick={isMultiSelectMode ? onToggleSelect : onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (isMultiSelectMode) {
            onToggleSelect();
          } else {
            onSelect();
          }
        }
      }}
    >
      {/* Keyboard shortcut indicator */}
      {shortcutNumber && !isMultiSelectMode && (
        <div className="absolute top-2 left-2 size-4 rounded-full bg-muted text-[10px] font-mono font-semibold text-muted-foreground flex items-center justify-center">
          {shortcutNumber}
        </div>
      )}

      {/* Multi-select checkbox */}
      {isMultiSelectMode && (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="rounded-none border-border"
        />
      )}

      {/* User Avatar */}
      <div className="relative shrink-0">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-full border bg-muted text-foreground-secondary",
            isSelected ? "border-primary/40" : "border-border"
          )}
        >
          <User size={18} />
        </div>

        {/* Unread indicator dot */}
        {hasUnreadMessages && (
          <div className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-destructive" />
        )}
      </div>

      {/* Chat Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3
            className={cn(
              "truncate text-sm",
              hasUnreadMessages
                ? "font-semibold text-foreground"
                : "font-medium text-foreground"
            )}
          >
            {chat.user.fullname}
          </h3>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Unread badge */}
            {hasUnreadMessages && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-destructive-foreground">
                {chat.unreadByAdmin > 99 ? "99+" : chat.unreadByAdmin}
              </span>
            )}

            {/* Timestamp */}
            <span
              className={cn(
                "text-xs tabular-nums",
                hasUnreadMessages
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {formatTime(chat.lastMessageAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1">
          <p
            className={cn(
              "flex-1 truncate text-xs",
              hasUnreadMessages
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            )}
          >
            {chat.lastMessage?.senderType === "admin" && (
              <span className="mr-1 font-medium text-primary">Bạn: </span>
            )}
            {truncateMessage(
              chat.lastMessage?.message ||
                (chat.lastMessage as { content?: string } | undefined)?.content ||
                "Không có tin nhắn"
            )}
          </p>

          {isSelected && (
            <ChevronRight size={14} className="shrink-0 text-primary" />
          )}
        </div>
      </div>
    </div>
  );
}