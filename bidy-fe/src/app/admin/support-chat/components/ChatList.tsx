"use client";

import React, { useState } from 'react';
import { 
  Filter,
  MoreHorizontal,
  MessageSquare
} from 'lucide-react';
import { AdminChatListItem, AdminChatFilters, AdminChatStats, AdminChatPagination } from '@/types/admin-chat';
import ChatCard from './ChatCard';
import ChatFilters from './ChatFilters';
import ChatStats from './ChatStats';

interface ChatListProps {
  chats: AdminChatListItem[];
  stats: AdminChatStats;
  pagination: AdminChatPagination;
  isLoading: boolean;
  filters: AdminChatFilters;
  selectedChats: string[];
  onFilterChange: (filters: Partial<AdminChatFilters>) => void;
  onChatSelect: (chatId: string) => void;
  onChatToggleSelect: (chatId: string) => void;
  onBulkAction: (action: string, chatIds: string[], value?: string) => void;
  onLoadMore: () => void;
}

export default function ChatList({
  chats,
  stats,
  pagination,
  isLoading,
  filters,
  selectedChats,
  onFilterChange,
  onChatSelect,
  onChatToggleSelect,
  onBulkAction,
  onLoadMore
}: ChatListProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const handleSelectAll = () => {
    if (selectedChats.length === chats.length) {
      // Deselect all
      chats.forEach(chat => onChatToggleSelect(chat.id));
    } else {
      // Select all visible chats
      chats.forEach(chat => {
        if (!selectedChats.includes(chat.id)) {
          onChatToggleSelect(chat.id);
        }
      });
    }
  };

  const handleBulkActionClick = (action: string, value?: string) => {
    if (selectedChats.length > 0) {
      onBulkAction(action, selectedChats, value);
    }
    setShowBulkActions(false);
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      {/* Header with Stats */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-foreground">Tin nhắn hỗ trợ</h1>
          
          <div className="flex items-center gap-3">
            {selectedChats.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <MoreHorizontal size={16} />
                  Thao tác ({selectedChats.length})
                </button>
                
                {showBulkActions && (
                  <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => handleBulkActionClick('mark_resolved')}
                      className="w-full px-4 py-2 text-left hover:bg-muted transition-colors"
                    >
                      Đánh dấu đã giải quyết
                    </button>
                    <button
                      onClick={() => handleBulkActionClick('mark_closed')}
                      className="w-full px-4 py-2 text-left hover:bg-muted transition-colors"
                    >
                      Đóng cuộc trò chuyện
                    </button>
                    <button
                      onClick={() => handleBulkActionClick('change_priority', 'high')}
                      className="w-full px-4 py-2 text-left hover:bg-muted transition-colors"
                    >
                      Đặt độ ưu tiên cao
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                showFilters 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              <Filter size={16} />
              Bộ lọc
            </button>
          </div>
        </div>
        
        <ChatStats stats={stats} />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-6">
          <ChatFilters 
            filters={filters} 
            onChange={onFilterChange}
            onClose={() => setShowFilters(false)}
          />
        </div>
      )}

      {/* Chat List */}
      <div className="space-y-4">
        {/* Select All Header */}
        {chats.length > 0 && (
          <div className="flex items-center justify-between py-3 px-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedChats.length === chats.length && chats.length > 0}
                onChange={handleSelectAll}
                className="rounded border-border"
              />
              <span className="text-sm text-muted-foreground">
                {selectedChats.length > 0 
                  ? `Đã chọn ${selectedChats.length} cuộc trò chuyện`
                  : 'Chọn tất cả'
                }
              </span>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Hiển thị {chats.length} / {pagination.total} cuộc trò chuyện
            </div>
          </div>
        )}

        {/* Chat Cards */}
        {chats.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Không có tin nhắn</h3>
            <p className="text-muted-foreground">
              {Object.values(filters).some(v => v && v !== 'all') 
                ? 'Không có tin nhắn nào phù hợp với bộ lọc hiện tại'
                : 'Chưa có tin nhắn hỗ trợ nào từ người dùng'
              }
            </p>
          </div>
        ) : (
          <>
            {chats.map((chat) => (
              <ChatCard
                key={chat.id}
                chat={chat}
                isSelected={selectedChats.includes(chat.id)}
                onSelect={() => onChatSelect(chat.id)}
                onToggleSelect={() => onChatToggleSelect(chat.id)}
              />
            ))}
            
            {/* Load More Button */}
            {pagination.hasMore && (
              <div className="text-center py-6">
                <button
                  onClick={onLoadMore}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Tải thêm tin nhắn
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}