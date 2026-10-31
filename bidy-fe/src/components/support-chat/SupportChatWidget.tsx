"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, Headphones, Sparkles } from 'lucide-react';
import { SupportChatWindow } from './SupportChatWindow';
import { useSupportChat } from '@/hooks';
import { useAuth } from '@/hooks/useAuth';

interface SupportChatWidgetProps {
  className?: string;
}

const SupportChatWidgetComponent: React.FC<SupportChatWidgetProps> = ({
  className = ''
}) => {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  
  // Widget state - initialize hooks before any early returns
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  
  // Get ALL data from the hook to pass to the window
  // Use static autoConnect to prevent re-renders when isAuthenticated changes
  const chatData = useSupportChat({
    autoConnect: true
  });
  
  // Destructure what we need at this level
  const { unreadCount, connectionState, currentChat } = chatData;

  // Debug authentication state (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [DEBUG] SupportChatWidget auth state', {
        isAuthenticated,
        pathname
      });
    }
  }, [isAuthenticated, pathname]);

  // Show pulse animation for new messages when widget is closed
  useEffect(() => {
    if (unreadCount > 0 && !isOpen) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [unreadCount, isOpen]);

  // Don't render support chat widget on admin pages
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  // Don't render if user is not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const handleToggleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      setIsMinimized(false);
    } else {
      setIsOpen(true);
      setIsMinimized(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const getButtonColor = () => {
    if (!connectionState.isConnected) {
      return 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600';
    }
    
    if (unreadCount > 0) {
      return 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 shadow-red-500/25';
    }
    
    return 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-blue-500/25';
  };

  const getButtonIcon = () => {
    if (isOpen) {
      return <X className="h-5 w-5" />;
    }
    // Use headphones icon for a more friendly support appearance
    return (
      <div className="relative">
        <Headphones className="h-5 w-5" />
        {unreadCount > 0 && (
          <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-yellow-300 animate-pulse" />
        )}
      </div>
    );
  };

  return (
    <>
      {/* Chat Window - Pass the hook data from parent */}
      <SupportChatWindow
        isOpen={isOpen}
        isMinimized={isMinimized}
        onClose={handleClose}
        onMinimize={handleMinimize}
        onToggleMinimize={handleToggleMinimize}
        chatData={chatData}
      />

      {/* Floating Chat Button */}
      <div className={`fixed bottom-4 right-4 z-40 ${className}`}>
        <button
          onClick={handleToggleOpen}
          data-support-chat-widget="true"
          className={`
            relative flex items-center justify-center
            h-12 w-12 rounded-full text-white shadow-xl
            transition-all duration-300 ease-in-out transform
            focus:outline-none focus:ring-4 focus:ring-blue-300/50
            backdrop-blur-sm
            ${getButtonColor()}
            ${showPulse ? 'animate-pulse' : ''}
            ${isOpen ? 'scale-95 rotate-90' : 'hover:scale-110 hover:shadow-2xl'}
          `}
          aria-label={isOpen ? 'Đóng chat hỗ trợ' : 'Mở chat hỗ trợ'}
        >
          {/* Button Icon */}
          {getButtonIcon()}

          {/* Unread Messages Badge */}
          {unreadCount > 0 && !isOpen && (
            <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center animate-bounce border-2 border-white shadow-lg">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}

          {/* Connection Status Indicator */}
          <div 
            className={`
              absolute bottom-0 right-0 h-5 w-5 rounded-full border-3 border-white shadow-lg
              ${connectionState.isConnected ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-yellow-400 to-orange-500'}
              ${connectionState.isConnected ? '' : 'animate-pulse'}
            `}
            title={connectionState.isConnected ? 'Đã kết nối' : 'Đang kết nối...'}
          />
          {/* Extra glow effect for connection status */}
          {connectionState.isConnected && (
            <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-green-400 opacity-20 animate-ping" />
          )}

          {/* Pulse rings for attention */}
          {showPulse && unreadCount > 0 && (
            <>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-400 to-pink-400 animate-ping opacity-25 scale-110"></div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 animate-ping opacity-15 scale-125" style={{ animationDelay: '0.3s' }}></div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 to-blue-400 animate-ping opacity-10 scale-150" style={{ animationDelay: '0.6s' }}></div>
            </>
          )}
        </button>

        {/* Tooltip */}
        {!isOpen && (
          <div className="absolute bottom-20 right-0 mb-2 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all duration-200 pointer-events-none z-50">
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm rounded-lg py-2 px-4 whitespace-nowrap shadow-xl backdrop-blur-sm border border-gray-700">
              {currentChat ? '💬 Tiếp tục trò chuyện' : '🎧 Hỗ trợ khách hàng Bidy'}
              <div className="absolute top-full right-6 border-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
        )}
      </div>

      {/* Global styles for animations */}
      <style jsx global>{`
        @keyframes bounce-subtle {
          0%, 20%, 53%, 80%, 100% {
            transform: translate3d(0,0,0);
          }
          40%, 43% {
            transform: translate3d(0, -8px, 0);
          }
          70% {
            transform: translate3d(0, -4px, 0);
          }
          90% {
            transform: translate3d(0, -2px, 0);
          }
        }
        
        .animate-bounce-subtle {
          animation: bounce-subtle 2s infinite;
        }
      `}</style>
    </>
  );
};

// Memoize component to prevent unnecessary re-renders
export const SupportChatWidget = React.memo(SupportChatWidgetComponent, (prevProps, nextProps) => {
  return prevProps.className === nextProps.className;
});