"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  MoreVertical,
  Send,
  AlertCircle,
  Info,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

import { AdminChatDetail, AdminMessage } from "@/types/admin-chat";
import { DefaultAvatar } from "@/components/ui/DefaultAvatar";
import { toValidDate } from "@/utils/common.utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner, PageLoader } from "@/components/common/loading";
import StatusPill from "@/app/admin/components/StatusPill";

interface ActiveChatWindowProps {
  chat: AdminChatDetail | null;
  messages: AdminMessage[];
  isLoading: boolean;
  error: string | null;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  onSendMessage: (message: string, attachments?: File[]) => Promise<void>;
  onLoadMore: () => void;
  onBack: () => void;
}

export default function ActiveChatWindow({
  chat,
  messages,
  isLoading,
  error,
  hasMoreMessages,
  isLoadingMore,
  onSendMessage,
  onLoadMore,
  onBack,
}: ActiveChatWindowProps) {
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Focus input on chat change
  useEffect(() => {
    if (chat && messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [chat]);

  // Handle infinite scroll for loading more messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !hasMoreMessages || isLoadingMore) return;

    const handleScroll = () => {
      if (container.scrollTop === 0) {
        onLoadMore();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMoreMessages, isLoadingMore, onLoadMore]);

  // Handle send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!messageText.trim()) return;
    if (isSending) return;

    try {
      setIsSending(true);
      await onSendMessage(messageText);
      setMessageText("");

      // Reset textarea height
      if (messageInputRef.current) {
        messageInputRef.current.style.height = "40px";
      }

      // Focus back to input
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 100);
    } catch (sendError) {
      console.error("Failed to send message:", sendError);
    } finally {
      setIsSending(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Bộ gõ tiếng Việt dùng Enter để chốt chữ đang soạn — đừng gửi tin giữa chừng.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Status & Priority pills using StatusPill
  const renderStatusPill = (status: string) => {
    switch (status) {
      case "open":
        return <StatusPill label="Đang mở" tone="info" />;
      case "in_progress":
        return <StatusPill label="Đang xử lý" tone="warning" />;
      case "resolved":
        return <StatusPill label="Đã giải quyết" tone="success" />;
      case "closed":
        return <StatusPill label="Đã đóng" tone="neutral" />;
      default:
        return <StatusPill label={status || "Không xác định"} tone="neutral" />;
    }
  };

  const renderPriorityPill = (priority?: string) => {
    if (priority === "high") {
      return <StatusPill label="Ưu tiên cao" tone="destructive" />;
    }
    if (priority === "low") {
      return <StatusPill label="Ưu tiên thấp" tone="info" />;
    }
    return null;
  };

  // Format message time
  const formatMessageTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check if should show date separator
  const shouldShowDateSeparator = (currentMsg: AdminMessage, prevMsg?: AdminMessage) => {
    if (!prevMsg) return true;

    const currentDate = new Date(currentMsg.timestamp).toDateString();
    const prevDate = new Date(prevMsg.timestamp).toDateString();

    return currentDate !== prevDate;
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <PageLoader message="Đang tải cuộc trò chuyện..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md border border-border bg-background p-6 text-center">
          <AlertCircle className="mx-auto mb-3 size-10 text-destructive" />
          <h3 className="mb-1 text-base font-semibold text-foreground">Có lỗi xảy ra</h3>
          <p className="mb-4 text-sm text-muted-foreground">{error}</p>
          <Button
            variant="default"
            onClick={onBack}
            className="cursor-pointer rounded-none"
          >
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">Không tìm thấy cuộc trò chuyện</p>
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-screen flex-1 flex-col bg-background">
      {/* Chat Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Back button for mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="size-8 cursor-pointer rounded-none md:hidden"
            aria-label="Quay lại danh sách"
          >
            <ArrowLeft size={16} />
          </Button>

          {/* User Avatar */}
          {chat.user.avatarUrl ? (
            <div className="relative shrink-0">
              <Image
                src={chat.user.avatarUrl}
                alt={chat.user.fullname}
                width={36}
                height={36}
                className="size-9 rounded-full object-cover"
              />
              <div className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-success" />
            </div>
          ) : (
            <DefaultAvatar
              size="sm"
              name={chat.user.fullname}
              variant="user"
              showOnlineStatus={true}
            />
          )}

          {/* User Info */}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {chat.user.fullname}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {renderStatusPill(chat.status)}
              {renderPriorityPill(chat.priority)}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowUserInfo(!showUserInfo)}
            className="size-8 cursor-pointer rounded-none text-muted-foreground hover:text-foreground"
            title="Thông tin người dùng"
          >
            <Info size={16} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer rounded-none text-muted-foreground hover:text-foreground"
            title="Thao tác khác"
          >
            <MoreVertical size={16} />
          </Button>
        </div>
      </div>

      {/* User Info Panel */}
      {showUserInfo && (
        <div className="shrink-0 border-b border-border bg-muted/40 p-4">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </dt>
              <dd className="mt-0.5 truncate text-foreground">{chat.user.email}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
                Ngày tạo
              </dt>
              <dd className="mt-0.5 text-foreground">
                {(() => {
                  const createdAt = toValidDate(chat.createdAt);
                  return createdAt
                    ? formatDistanceToNow(createdAt, { addSuffix: true, locale: vi })
                    : "—";
                })()}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
                Số tin nhắn
              </dt>
              <dd className="mt-0.5 font-mono tabular-nums text-foreground">
                {messages.length}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 space-y-3 overflow-y-auto p-4 bg-background"
      >
        {/* Load more button */}
        {hasMoreMessages && (
          <div className="py-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="h-7 cursor-pointer rounded-none text-xs text-primary hover:bg-accent hover:text-primary"
            >
              {isLoadingMore ? (
                <Spinner size="xs" tone="primary" label="Đang tải..." />
              ) : (
                "Tải tin nhắn cũ hơn"
              )}
            </Button>
          </div>
        )}

        {messages.map((message, index) => {
          const prevMessage = index > 0 ? messages[index - 1] : undefined;
          const showDate = shouldShowDateSeparator(message, prevMessage);
          const isAdmin = message.senderType === "admin";
          const isConsecutive =
            prevMessage &&
            prevMessage.senderType === message.senderType &&
            new Date(message.timestamp).getTime() - new Date(prevMessage.timestamp).getTime() <
              60000;

          return (
            <div key={message.id}>
              {/* Date separator */}
              {showDate && (
                <div className="my-4 text-center">
                  <span className="border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleDateString("vi-VN", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}

              <div className={cn("flex", isAdmin ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[75%]", isConsecutive ? "mt-1" : "mt-3")}>
                  {/* Message bubble */}
                  <div
                    className={cn(
                      "p-3 text-sm whitespace-pre-wrap break-words",
                      isAdmin
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted text-foreground border border-border"
                    )}
                  >
                    {message.message}
                  </div>

                  {/* Timestamp */}
                  {!isConsecutive && (
                    <div
                      className={cn(
                        "mt-1 px-0.5 text-xs tabular-nums text-muted-foreground",
                        isAdmin ? "text-right" : "text-left"
                      )}
                    >
                      {formatMessageTime(new Date(message.timestamp))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="shrink-0 border-t border-border bg-background p-3 sm:p-4">
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          {/* Message input */}
          <div className="relative flex-1">
            <textarea
              ref={messageInputRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Nhập tin nhắn..."
              rows={1}
              className="flex min-h-10 max-h-32 w-full resize-none border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              style={{
                height: "40px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "40px";
                target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
              }}
            />
          </div>

          {/* Send button */}
          <Button
            type="submit"
            variant="default"
            size="icon"
            disabled={!messageText.trim() || isSending}
            className="size-10 shrink-0 cursor-pointer rounded-none"
            aria-label="Gửi tin nhắn"
          >
            {isSending ? (
              <Spinner size="xs" tone="onColor" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}