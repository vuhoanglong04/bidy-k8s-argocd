"use client";

import React, { useState } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { AdminChatFilters } from '@/types/admin-chat';

interface ChatFiltersProps {
  filters: AdminChatFilters;
  onChange: (filters: Partial<AdminChatFilters>) => void;
  onClose: () => void;
}

export default function ChatFilters({ filters, onChange, onClose }: ChatFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.search || '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange({ search: localSearch });
  };

  const clearFilters = () => {
    setLocalSearch('');
    onChange({
      status: 'all',
      priority: 'all',
      unread: 'all',
      search: ''
    });
  };

  const hasActiveFilters = 
    filters.status !== 'all' || 
    filters.priority !== 'all' || 
    filters.unread !== 'all' || 
    filters.search;

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={16} />
          <h3 className="font-semibold text-foreground">Bộ lọc</h3>
          {hasActiveFilters && (
            <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
              Đã áp dụng
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Xóa bộ lọc
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-foreground mb-2">
            Tìm kiếm
          </label>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Tìm theo tên, email hoặc chủ đề..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Tìm
            </button>
          </form>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Trạng thái
          </label>
          <select
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value as AdminChatFilters['status'] })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">Tất cả</option>
            <option value="open">Mở</option>
            <option value="in_progress">Đang xử lý</option>
            <option value="resolved">Đã giải quyết</option>
            <option value="closed">Đã đóng</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Độ ưu tiên
          </label>
          <select
            value={filters.priority}
            onChange={(e) => onChange({ priority: e.target.value as AdminChatFilters['priority'] })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">Tất cả</option>
            <option value="high">Cao</option>
            <option value="medium">Trung bình</option>
            <option value="low">Thấp</option>
          </select>
        </div>

        {/* Unread Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Tin nhắn chưa đọc
          </label>
          <select
            value={filters.unread}
            onChange={(e) => onChange({ unread: e.target.value as AdminChatFilters['unread'] })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">Tất cả</option>
            <option value="unread">Chưa đọc</option>
            <option value="read">Đã đọc</option>
          </select>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Bộ lọc đang áp dụng:</span>
            
            {filters.status !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                Trạng thái: {filters.status}
                <button
                  onClick={() => onChange({ status: 'all' })}
                  className="hover:text-primary/70"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            
            {filters.priority !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                Ưu tiên: {filters.priority}
                <button
                  onClick={() => onChange({ priority: 'all' })}
                  className="hover:text-primary/70"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            
            {filters.unread !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                {filters.unread === 'unread' ? 'Chưa đọc' : 'Đã đọc'}
                <button
                  onClick={() => onChange({ unread: 'all' })}
                  className="hover:text-primary/70"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            
            {filters.search && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                Tìm kiếm: &quot;{filters.search}&quot;
                <button
                  onClick={() => {
                    setLocalSearch('');
                    onChange({ search: '' });
                  }}
                  className="hover:text-primary/70"
                >
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}