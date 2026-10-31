"use client";

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2, CheckCheck, Check, Crown } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { SupportChatMessage, TypingIndicator, AdminInfo } from '@/types/chat';
import { toValidDate } from '@/utils/common.utils';
import { Skeleton } from '@/components/ui/skeleton';
import ProductGridMessage from './ProductGridMessage';

interface MessageListProps {
  messages: SupportChatMessage[];
  adminInfo: AdminInfo | null;
  typingIndicator: TypingIndicator;
  canLoadMore: boolean;
  isLoading: boolean;
  /** Đang tải trang tin nhắn cũ hơn (scroll lên), khác với lần nạp đầu. */
  isLoadingOlder?: boolean;
  onLoadOlder: () => void;
  onMarkAsRead?: () => void;
  className?: string;
}

const MessageListComponent: React.FC<MessageListProps> = ({
  messages,
  adminInfo,
  typingIndicator,
  canLoadMore,
  isLoading,
  isLoadingOlder = false,
  onLoadOlder,
  className = ''
}) => {
  // Messages are already deduplicated in useSupportChat hook
  // Just sort them by timestamp for display
  const processedMessages = useMemo(() => {
    return [...messages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [messages]);

  // Removed debug log
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottom = useRef(true);
  const prevScrollHeight = useRef<number>(0);
  const isFetchingOlderRef = useRef(false);

  // Giờ hiển thị ở đáy bong bóng, kiểu messenger.
  const formatClock = (timestamp: Date) => {
    const date = toValidDate(timestamp);
    if (!date) return '';
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Nhãn của dải phân cách ngày.
  const formatDayLabel = (timestamp: Date) => {
    const date = toValidDate(timestamp);
    if (!date) return '';

    const startOfDay = (value: Date) =>
      new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) {
      return date.toLocaleDateString('vi-VN', { weekday: 'long' });
    }
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  /** Tin nhắn đầu tiên của một ngày mới thì phía trên nó cần dải phân cách. */
  const needsDaySeparator = (message: SupportChatMessage, index: number) => {
    const current = toValidDate(message.timestamp);
    if (!current) return false;
    if (index === 0) return true;

    const previous = toValidDate(processedMessages[index - 1]?.timestamp);
    if (!previous) return true;

    return current.toDateString() !== previous.toDateString();
  };

  // Auto-scroll to bottom for new messages
  const scrollToBottom = useCallback(() => {
    if (shouldScrollToBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Handle scroll to detect if user scrolled up and load more messages
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // If user is near bottom (within 100px), auto-scroll for new messages
    shouldScrollToBottom.current = distanceFromBottom < 100;
    
    // If user scrolled to near top (within 50px) and can load more, trigger load
    if (scrollTop < 50 && canLoadMore && !isLoading && !isLoadingOlder && !isFetchingOlderRef.current) {
      isFetchingOlderRef.current = true;
      prevScrollHeight.current = scrollHeight;
      onLoadOlder();
    }
  }, [canLoadMore, isLoading, isLoadingOlder, onLoadOlder]);

  // Auto-scroll for new messages or maintain scroll position when loading older
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (isFetchingOlderRef.current && !isLoading && !isLoadingOlder) {
      // Just finished loading older messages, maintain scroll position
      const newScrollHeight = container.scrollHeight;
      const scrollDiff = newScrollHeight - prevScrollHeight.current;
      container.scrollTop = container.scrollTop + scrollDiff;
      isFetchingOlderRef.current = false;
    } else if (!isFetchingOlderRef.current) {
      // Normal auto-scroll for new messages
      scrollToBottom();
    }
  }, [messages, isLoading, isLoadingOlder, scrollToBottom]);

  // REMOVED: Auto mark-as-read - was causing timeout issues
  // The feature has been disabled to simplify the system

  // Render message status icon
  const renderMessageStatus = (message: SupportChatMessage) => {
    if (message.senderType !== 'user') return null;

    return (
      <div className="flex items-center ml-2">
        {message.isRead ? (
          <CheckCheck className="h-3 w-3 text-info" />
        ) : (
          <Check className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    );
  };

  // Render individual message
  const renderMessage = (message: SupportChatMessage, index: number) => {
    const isUser = message.senderType === 'user';
    const isConsecutive =
      index > 0 &&
      processedMessages[index - 1].senderType === message.senderType;

    // Create a unique key combining id, index, and timestamp to ensure uniqueness
    const uniqueKey = `${message.id}-${index}-${new Date(message.timestamp).getTime()}`;

    // Check if this is a product grid message
    const isProductGrid = message.messageType === 'product_grid';

    const dayLabel = needsDaySeparator(message, index) ? formatDayLabel(message.timestamp) : '';

    return (
      <React.Fragment key={uniqueKey}>
        {dayLabel && (
          <div className="flex items-center gap-2 py-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {dayLabel}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        )}
        <div
          className={`flex mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}
        >
        {/* Conditional rendering based on message type */}
        {isProductGrid ? (
          <ProductGridMessage
            message={message.message}
            timestamp={message.timestamp}
            productAttachments={message.productAttachments}
            gridConfig={message.gridConfig}
            isOwnMessage={isUser}
          />
        ) : (
          /* Regular text message */
          <div className="max-w-[75%] min-w-0">
            {/* Nhãn bên gửi — chỉ ở tin đầu của mỗi lượt, đủ để phân biệt
                khách với đội hỗ trợ mà không lặp lại ở từng dòng. */}
            {!isConsecutive && !isUser && (
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {adminInfo?.name || 'Hỗ trợ Bidy'}
              </span>
            )}

            {/* Message bubble */}
            <div
              className={`
                px-3 py-2 text-sm break-words
                ${isUser
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
                }
              `}
            >
              {typeof message.message === 'string' ? message.message : JSON.stringify(message.message)}
            </div>

            {/* Giờ gửi luôn hiển thị — trước đây để `opacity-0` nên trên thiết bị
                cảm ứng (không có hover) là không bao giờ thấy. */}
            <div
              className={`mt-0.5 flex items-center gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <span className="text-[11px] text-muted-foreground">
                {formatClock(message.timestamp)}
              </span>
              {renderMessageStatus(message)}
            </div>
          </div>
        )}
        </div>
      </React.Fragment>
    );
  };

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (!typingIndicator.isTyping) return null;

    return (
      <div className="flex mb-1">
        <div className="bg-muted px-3 py-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {/* Skeleton cho lần nạp lịch sử đầu tiên — giữ layout, tránh nhảy khung
            như khi dùng spinner trần. */}
        {isLoading && messages.length === 0 && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(row => (
              <div
                key={row}
                className={`flex ${row % 2 === 0 ? 'justify-start' : 'justify-end'}`}
              >
                <Skeleton
                  className={`h-10 ${row % 2 === 0 ? 'w-40' : 'w-32'}`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Tải trang tin nhắn cũ hơn khi scroll lên đầu */}
        {isLoadingOlder && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {/* No messages state */}
        {messages.length === 0 && !isLoading && !typingIndicator.isTyping && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="relative w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4 shadow-lg">
              <div className="relative">
                <Avatar className="h-12 w-12 border-2 border-white shadow-md">
                  <AvatarImage 
                    src={adminInfo?.avatar || '/admin-avatar.png'} 
                    alt={adminInfo?.name || 'Support Agent'} 
                  />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                    {adminInfo?.name ? adminInfo.name.charAt(0).toUpperCase() : '🎧'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full border-2 border-white flex items-center justify-center">
                  <Crown className="h-2 w-2 text-white" />
                </div>
              </div>
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-blue-400 rounded-full opacity-10 animate-pulse"></div>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              Chào mừng đến với hỗ trợ khách hàng Bidy! 👋
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Gửi tin nhắn để bắt đầu trò chuyện với đội ngũ hỗ trợ chuyên nghiệp
            </p>
            <div className="flex items-center space-x-1 text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Đang trực tuyến • Sẵn sàng hỗ trợ</span>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-400 mt-3 bg-gray-100 px-2 py-1 rounded">
                Debug: {messages.length} messages, {isLoading ? 'loading' : 'ready'}
              </div>
            )}
          </div>
        )}

        {/* Render messages (oldest first for chat flow) */}
        {processedMessages.map((message, index) => renderMessage(message, index))}

        {/* Typing indicator */}
        {renderTypingIndicator()}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders
export const MessageList = React.memo(MessageListComponent, (prevProps, nextProps) => {
  // Custom comparison - check message count instead of reference equality
  return (
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isLoadingOlder === nextProps.isLoadingOlder &&
    prevProps.canLoadMore === nextProps.canLoadMore &&
    prevProps.typingIndicator.isTyping === nextProps.typingIndicator.isTyping &&
    prevProps.adminInfo?.name === nextProps.adminInfo?.name
  );
});