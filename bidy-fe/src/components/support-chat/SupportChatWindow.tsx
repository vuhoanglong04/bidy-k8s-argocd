"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/common';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import type { SupportChatHookReturn } from '@/hooks/useSupportChatClean';

interface SupportChatWindowProps {
  isOpen: boolean;
  isMinimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMinimize: () => void;
  className?: string;
  // Pass all the hook data from parent
  chatData: SupportChatHookReturn;
}

const SupportChatWindowComponent: React.FC<SupportChatWindowProps> = ({
  isOpen,
  isMinimized,
  onClose,
  onMinimize,
  onToggleMinimize,
  className = '',
  chatData
}) => {
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Destructure the chatData prop instead of calling the hook
  const {
    connectionState,
    currentChat,
    messages,
    adminInfo,
    typingIndicator,
    isLoading,
    isSending,
    isLoadingOlder,
    hasMoreMessages,
    startChat,
    sendMessage,
    sendTypingIndicator,
    markMessagesAsRead,
    loadOlderMessages,
    hasUnreadMessages
  } = chatData;

  // Removed debug logging

  // Mark all messages as read when chat window is opened
  useEffect(() => {
    if (isOpen && !isMinimized && currentChat?.id) {
      // Mark all unread messages as read
      if (hasUnreadMessages) {
        console.log('💬 Chat opened, marking all messages as read');
        markMessagesAsRead(currentChat.id);
      }
    }
  }, [isOpen, isMinimized, currentChat?.id, hasUnreadMessages, markMessagesAsRead]);

  // Handle first message send (start chat)
  const handleSendMessage = async (message: string) => {
    try {
      if (!currentChat) {
        // Start new chat
        setIsInitializing(true);
        const newChat = await startChat({ subject: 'Hỗ trợ khách hàng Bidy' });

        if (!newChat || !newChat.id) {
          throw new Error('Không thể tạo cuộc trò chuyện mới');
        }

        // `user_start_chat` chỉ mở ticket, không nhận nội dung tin nhắn. Phải
        // gửi tin đầu tiên bằng một lời gọi riêng, nếu không nó rơi mất không
        // dấu vết. Handler đã tự join room nên gửi được ngay.
        await sendMessage({
          chatId: newChat.id,
          message,
          messageType: 'text',
        });
      } else {
        // Send message to existing chat
        if (!currentChat.id) {
          throw new Error('Chat ID không hợp lệ');
        }
        await sendMessage({
          chatId: currentChat.id,
          message,
          messageType: 'text'
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Không báo gì thì bong bóng lạc quan biến mất lặng lẽ — người dùng chỉ
      // thấy tin nhắn "bị nuốt". Chữ trong ô nhập vẫn được `MessageInput` giữ.
      toast.error('Không gửi được tin nhắn', {
        description: 'Dịch vụ hỗ trợ đang không phản hồi. Nội dung vẫn còn trong ô nhập, thử lại sau ít phút.',
      });
      throw error;
    } finally {
      setIsInitializing(false);
    }
  };

  // Handle typing indicator
  const handleTyping = (isTyping: boolean) => {
    if (currentChat) {
      sendTypingIndicator(currentChat.id, isTyping);
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  const windowHeight = isMinimized ? 'h-12' : 'h-[450px]';
  const windowWidth = 'w-80';

  return (
    <div 
      data-chat-open={isOpen && !isMinimized ? "true" : "false"}
      className={`
        fixed bottom-20 right-4 ${windowWidth} ${windowHeight}
        bg-white border border-gray-300 rounded-lg shadow-lg
        transition-all duration-300 ease-in-out transform
        z-50 flex flex-col overflow-hidden
        ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        ${className}
      `}
    >
      {/* Chat Header */}
      <ChatHeader
        adminInfo={adminInfo}
        connectionState={connectionState}
        onClose={onClose}
        onMinimize={isMinimized ? onToggleMinimize : onMinimize}
      />

      {/* Chat Content - Only show when not minimized */}
      {!isMinimized && (
        <>
          {/* 1. Chat is initializing (new chat creation in progress) */}
          {isInitializing && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
                  <div className="absolute inset-0 rounded-full bg-blue-100 opacity-20 animate-pulse"></div>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">Đang khởi tạo cuộc trò chuyện...</p>
                <p className="text-xs text-gray-500">Kết nối với đội hỗ trợ 🚀</p>
              </div>
            </div>
          )}

          {/* 2. Loading initial chat history on first load */}
          {isLoading && messages.length === 0 && !isInitializing && (
            <div className="flex-1 flex flex-col justify-center p-4 space-y-3">
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <div className="space-y-3 px-2">
                <div className="flex justify-start">
                  <Skeleton className="h-9 w-40 rounded-none" />
                </div>
                <div className="flex justify-end">
                  <Skeleton className="h-9 w-48 rounded-none" />
                </div>
                <div className="flex justify-start">
                  <Skeleton className="h-9 w-32 rounded-none" />
                </div>
              </div>
            </div>
          )}

          {/* 3. Has chat history -> Always render old messages */}
          {messages.length > 0 && !isInitializing && (
            <div className="flex-1 flex flex-col min-h-0">
              <MessageList
                messages={messages}
                adminInfo={adminInfo}
                typingIndicator={typingIndicator}
                canLoadMore={hasMoreMessages}
                isLoading={isLoading}
                isLoadingOlder={isLoadingOlder}
                onLoadOlder={loadOlderMessages}
                onMarkAsRead={() => currentChat?.id && markMessagesAsRead(currentChat.id)}
                className="flex-1"
              />
            </div>
          )}

          {/* 4. Chat history is empty -> Only now render start chat banner */}
          {messages.length === 0 && !isLoading && !isInitializing && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg relative">
                  <div className="text-3xl">💬</div>
                  {/* Subtle glow effect */}
                  <div className="absolute inset-0 bg-blue-400 rounded-full opacity-10 animate-pulse"></div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Bắt đầu trò chuyện với Bidy
                </h3>
                <p className="text-sm text-gray-600 mb-4 max-w-xs mx-auto">
                  Gửi tin nhắn để kết nối với đội ngũ hỗ trợ chuyên nghiệp của chúng tôi 🎧
                </p>
                <div className="flex items-center justify-center space-x-1 text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full inline-flex">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Trực tuyến 24/7</span>
                </div>
              </div>
            </div>
          )}

          {/* Message Input */}
          <MessageInput
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            disabled={!connectionState.isConnected || isInitializing}
            isSending={isSending || isInitializing}
            placeholder={
              messages.length === 0 && !currentChat 
                ? "Nhập tin nhắn để bắt đầu..."
                : "Nhập tin nhắn..."
            }
          />
        </>
      )}

      {/* Minimized state indicator */}
      {isMinimized && hasUnreadMessages && (
        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center shadow-sm">
          {currentChat?.unreadByUser || 0}
        </div>
      )}
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders
export const SupportChatWindow = React.memo(SupportChatWindowComponent, (prevProps, nextProps) => {
  // Check if chatData has changed - specifically the messages
  const chatDataEqual = (
    prevProps.chatData.messages.length === nextProps.chatData.messages.length &&
    prevProps.chatData.currentChat?.id === nextProps.chatData.currentChat?.id &&
    prevProps.chatData.connectionState.isConnected === nextProps.chatData.connectionState.isConnected &&
    prevProps.chatData.isLoading === nextProps.chatData.isLoading &&
    prevProps.chatData.isSending === nextProps.chatData.isSending
  );
  
  return (
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.isMinimized === nextProps.isMinimized &&
    prevProps.className === nextProps.className &&
    chatDataEqual
  );
});