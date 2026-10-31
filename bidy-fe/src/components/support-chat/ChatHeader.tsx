"use client";

import React from 'react';
import { X, Minus, Shield } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { AdminInfo, ConnectionState } from '@/types/chat';

interface ChatHeaderProps {
  adminInfo: AdminInfo | null;
  connectionState: ConnectionState;
  onClose: () => void;
  onMinimize: () => void;
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  adminInfo,
  connectionState,
  onClose,
  onMinimize,
  className = ''
}) => {
  const getStatusText = () => {
    if (!connectionState.isConnected) {
      return 'Đang kết nối...';
    }
    
    if (adminInfo) {
      return adminInfo.isOnline ? 'Đang hoạt động' : 'Hoạt động 1 giờ trước';
    }
    
    return 'Hỗ trợ khách hàng';
  };

  const getStatusColor = () => {
    if (!connectionState.isConnected) {
      return 'text-yellow-500';
    }
    
    if (adminInfo) {
      return adminInfo.isOnline ? 'text-green-500' : 'text-gray-500';
    }
    
    return 'text-blue-500';
  };

  return (
    <div className={`flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 rounded-t-lg shadow-sm ${className}`}>
      {/* Left side - Admin info */}
      <div className="flex items-center space-x-3 flex-1">
        <div className="relative">
          <Avatar className="h-9 w-9 border border-gray-200">
            <AvatarImage 
              src={adminInfo?.avatar || '/admin-avatar.png'} 
              alt={adminInfo?.name || 'Support Agent'} 
              className="object-cover"
            />
            <AvatarFallback className="bg-blue-500 text-white text-sm font-semibold">
              {adminInfo?.name ? adminInfo.name.charAt(0).toUpperCase() : 'HT'}
            </AvatarFallback>
          </Avatar>
          {/* Online status indicator */}
          {connectionState.isConnected && adminInfo?.isOnline && (
            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-white rounded-full"></div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {adminInfo?.name || 'Hỗ trợ khách hàng Bidy'}
            </h3>
            {/* Verification badge */}
            <div className="flex-shrink-0">
              <Shield className="h-3 w-3 text-blue-500" />
            </div>
          </div>
          
          <div className="flex items-center space-x-1 mt-0.5">
            {/* Status text with Messenger-style formatting */}
            <span className={`text-xs ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
        </div>
      </div>

      {/* Right side - Action buttons with Messenger-style */}
      <div className="flex items-center space-x-1">
        <button
          onClick={onMinimize}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors duration-150"
          aria-label="Thu nhỏ"
        >
          <Minus className="h-4 w-4" />
        </button>
        
        <button
          onClick={onClose}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors duration-150"
          aria-label="Đóng chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Connection error indicator */}
      {connectionState.error && (
        <div className="absolute top-full left-0 right-0 bg-red-50 border-l-4 border-red-400 px-3 py-2 text-xs text-red-700">
          Lỗi kết nối: {connectionState.error}
        </div>
      )}
    </div>
  );
};