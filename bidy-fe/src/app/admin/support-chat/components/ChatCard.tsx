"use client";

import React from 'react';
import Image from 'next/image';
import { 
  Clock, 
  CheckCircle2,
  Circle,
  X
} from 'lucide-react';
import { AdminChatListItem } from '@/types/admin-chat';
import { DefaultAvatar } from '@/components/ui/DefaultAvatar';
import { toValidDate } from '@/utils/common.utils';

interface ChatCardProps {
  chat: AdminChatListItem;
  isSelected: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
}

export default function ChatCard({ chat, isSelected, onSelect, onToggleSelect }: ChatCardProps) {
  const formatTime = (date?: Date | string | null) => {
    const target = toValidDate(date);
    if (!target) return '';

    const now = new Date();
    const diff = now.getTime() - target.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    return `${days} ngày trước`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-600';
      case 'in_progress': return 'text-yellow-600';
      case 'resolved': return 'text-green-600';
      case 'closed': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Circle size={12} className="fill-current" />;
      case 'in_progress': return <Clock size={12} />;
      case 'resolved': return <CheckCircle2 size={12} />;
      case 'closed': return <X size={12} />;
      default: return <Circle size={12} />;
    }
  };

  return (
    <div 
      className={`relative cursor-pointer transition-colors hover:bg-muted/30 ${
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/30'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox - Hidden by default, shown on hover */}
        <div className="opacity-0 hover:opacity-100 transition-opacity">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-border"
          />
        </div>

        {/* User Avatar - Messenger style */}
        <div className="flex-shrink-0">
          {chat.user.avatarUrl ? (
            <div className="relative">
              <Image
                src={chat.user.avatarUrl}
                alt={chat.user.fullname}
                width={56}
                height={56}
                className="w-14 h-14 rounded-full object-cover"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
          ) : (
            <DefaultAvatar 
              size="lg" 
              name={chat.user.fullname}
              variant="user"
              showOnlineStatus={true}
            />
          )}
        </div>

        {/* Chat Content - Messenger layout */}
        <div className="flex-1 min-w-0">
          {/* Name and Time */}
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-foreground text-base truncate">
              {chat.user.fullname}
            </h3>
            
            <div className="flex items-center gap-2">
              {/* Unread Badge */}
              {chat.unreadByAdmin > 0 && (
                <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-semibold min-w-[20px] text-center">
                  {chat.unreadByAdmin > 99 ? '99+' : chat.unreadByAdmin}
                </div>
              )}
              
              {/* Time */}
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {formatTime(chat.lastMessageAt)}
              </span>
            </div>
          </div>

          {/* Last Message Preview */}
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              {chat.lastMessage ? (
                <p className="text-sm text-muted-foreground truncate">
                  {chat.lastMessage.senderType === 'admin' && (
                    <span className="text-blue-600 font-medium">Bạn: </span>
                  )}
                  {chat.lastMessage.message}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {chat.subject}
                </p>
              )}
            </div>

            {/* Priority & Status indicators */}
            <div className="flex items-center gap-2 ml-2">
              {/* Priority dot */}
              <div className={`w-2 h-2 rounded-full ${getPriorityColor(chat.priority)}`} />
              
              {/* Status icon */}
              <div className={`${getStatusColor(chat.status)} opacity-60`}>
                {getStatusIcon(chat.status)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selection overlay */}
      {isSelected && (
        <div className="absolute inset-0 bg-primary/5 pointer-events-none"></div>
      )}
    </div>
  );
}