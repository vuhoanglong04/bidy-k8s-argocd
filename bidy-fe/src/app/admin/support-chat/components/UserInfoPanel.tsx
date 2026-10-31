"use client";

import React from 'react';
import Image from 'next/image';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Activity, 
  MessageSquare, 
  Clock, 
  Tag 
} from 'lucide-react';
import { AdminSupportChat } from '@/types/admin-chat';

interface UserInfoPanelProps {
  chat: AdminSupportChat;
  onClose: () => void;
}

export default function UserInfoPanel({ chat, onClose }: UserInfoPanelProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return 'Cao';
      case 'medium': return 'Trung bình';
      case 'low': return 'Thấp';
      default: return priority;
    }
  };

  return (
    <div className="h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Thông tin khách hàng</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-6 h-[calc(100%-60px)] overflow-y-auto">
        {/* User Profile */}
        <div className="space-y-4">
          <div className="text-center">
            {chat.user.avatarUrl ? (
              <Image
                src={chat.user.avatarUrl}
                alt={chat.user.fullname}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover mx-auto mb-3"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <User size={32} className="text-primary" />
              </div>
            )}
            <h4 className="font-semibold text-foreground">{chat.user.fullname}</h4>
            <p className="text-sm text-muted-foreground">{chat.user.email}</p>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{chat.user.email}</p>
              </div>
            </div>

            {chat.user.phone && (
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Số điện thoại</p>
                  <p className="text-sm text-muted-foreground">{chat.user.phone}</p>
                </div>
              </div>
            )}

            {chat.user.username && (
              <div className="flex items-center gap-3">
                <User size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Tên đăng nhập</p>
                  <p className="text-sm text-muted-foreground">{chat.user.username}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Activity size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Trạng thái</p>
                <p className="text-sm text-green-600">Hoạt động</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Info */}
        <div className="border-t border-border pt-6">
          <h5 className="font-medium text-foreground mb-3">Thông tin cuộc trò chuyện</h5>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <MessageSquare size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Chủ đề</p>
                <p className="text-sm text-muted-foreground">{chat.subject}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Tag size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Độ ưu tiên</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(chat.priority)}`}>
                  {getPriorityText(chat.priority)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Được tạo</p>
                <p className="text-sm text-muted-foreground">{formatDate(chat.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Tin nhắn cuối</p>
                <p className="text-sm text-muted-foreground">{formatDate(chat.lastMessageAt)}</p>
              </div>
            </div>

            {chat.unreadByAdmin > 0 && (
              <div className="flex items-center gap-3">
                <MessageSquare size={16} className="text-red-500" />
                <div>
                  <p className="text-sm font-medium">Tin nhắn chưa đọc</p>
                  <p className="text-sm text-red-600">{chat.unreadByAdmin} tin nhắn</p>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Previous Support Chats */}
        <div className="border-t border-border pt-6">
          <h5 className="font-medium text-foreground mb-3">Lịch sử hỗ trợ</h5>
          <div className="text-sm text-muted-foreground">
            <p>• Cuộc trò chuyện đầu tiên với khách hàng này</p>
            <p>• Chưa có lịch sử hỗ trợ trước đó</p>
          </div>
        </div>

        {/* User Activity Summary */}
        <div className="border-t border-border pt-6">
          <h5 className="font-medium text-foreground mb-3">Hoạt động trên nền tảng</h5>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>• Tham gia đấu giá: Chưa có thông tin</p>
            <p>• Giao dịch thành công: Chưa có thông tin</p>
            <p>• Đánh giá: Chưa có thông tin</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-t border-border pt-6">
          <h5 className="font-medium text-foreground mb-3">Thao tác nhanh</h5>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded transition-colors">
              Xem lịch sử đấu giá
            </button>
            <button className="w-full text-left px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded transition-colors">
              Xem thông tin tài khoản
            </button>
            <button className="w-full text-left px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded transition-colors">
              Gửi email hỗ trợ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}