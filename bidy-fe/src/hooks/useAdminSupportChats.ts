"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocketCore } from './useWebSocketCore';
import { WEBSOCKET_EVENTS } from '@/constants/app.enum';
import { useAuth } from './useAuth';
import { 
  AdminChatListItem, 
  AdminChatFilters, 
  AdminChatStats, 
  AdminChatPagination,
  AdminChatListResponse,
  AdminNotification
} from '@/types/admin-chat';
import axiosClient from '@/lib/axios-client';
import { API_ROUTES } from '@/constants/routes.constants';
import { mapAdminChats } from '@/services/support-chat.mapper';

interface UseAdminSupportChatsParams {
  initialPage?: number;
  initialLimit?: number;
  initialFilters?: Partial<AdminChatFilters>;
}

export function useAdminSupportChats({
  initialPage = 1,
  initialLimit = 20,
  initialFilters = {}
}: UseAdminSupportChatsParams = {}) {
  const [chats, setChats] = useState<AdminChatListItem[]>([]);
  const [stats, setStats] = useState<AdminChatStats>({
    open: { count: 0, unread: 0 },
    in_progress: { count: 0, unread: 0 },
    resolved: { count: 0, unread: 0 },
    closed: { count: 0, unread: 0 }
  });
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [currentLimit] = useState(initialLimit);
  const [pagination, setPagination] = useState<AdminChatPagination>({
    page: initialPage,
    limit: initialLimit,
    total: 0,
    totalPages: 0,
    hasMore: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  const currentFilters = useRef<AdminChatFilters>({
    status: 'all',
    priority: 'all', 
    unread: 'all',
    search: '',
    ...initialFilters
  });

  // Get authenticated admin info
  const { user } = useAuth();
  const adminId = user?._id || 'current-admin'; // Fallback for development
  
  // WebSocket connection for real-time updates
  const { socket, isConnected } = useWebSocketCore();

  // Debouncing for API calls to prevent rate limiting
  const lastFetchTimeRef = useRef<number>(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MIN_FETCH_INTERVAL = 1000; // 1 second minimum between fetches

  // Internal fetch function (actual API call)
  const fetchChatsInternal = useCallback(async (pageToFetch?: number) => {
    const actualPage = pageToFetch ?? currentPage;
    const params = new URLSearchParams({
      page: actualPage.toString(),
      limit: currentLimit.toString(),
      ...Object.entries(currentFilters.current)
        .filter(([, value]) => value && value !== 'all')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
    });

    try {
      setIsLoading(true);
      setError(null);

      const response = await axiosClient.get<AdminChatListResponse>(`${API_ROUTES.ADMIN_SUPPORT_CHATS}?${params}`);
      
      if (response.data.status === 'success') {
        // Response là PHẲNG: `chats` / `statusCounts` / `totalPages` /
        // `currentPage` / `totalChats`. Không có object `pagination` bọc ngoài
        // và không có `stats` — backend xác nhận sẽ không thêm.
        const { chats: newChats, statusCounts, totalPages, currentPage, totalChats } =
          response.data.data ?? {};

        // Ticket là entity thô kèm `lastMessageAt`/`unreadByAdmin`; `priority`
        // thì backend chưa có cột (mapper để default 'medium').
        setChats(mapAdminChats(newChats));

        if (statusCounts) {
          // `statusCounts` tính trên TOÀN BỘ ticket và đã gồm `unread`, nên
          // không cộng xấp xỉ theo trang (sai ngay khi có >1 trang).
          setStats(prev => {
            const next = { ...prev };
            (Object.keys(prev) as (keyof AdminChatStats)[]).forEach(status => {
              next[status] = {
                count: statusCounts[status]?.count ?? 0,
                unread: statusCounts[status]?.unread ?? 0,
              };
            });
            return next;
          });
        }

        if (typeof totalChats === 'number') {
          setPagination({
            page: currentPage ?? actualPage,
            limit: currentLimit,
            total: totalChats,
            totalPages: totalPages ?? 1,
            hasMore: (currentPage ?? actualPage) < (totalPages ?? 1),
          });
        }
      } else {
        console.error('❌ Response not successful:', response.data);
        setError(response.data.message || 'Không thể tải danh sách tin nhắn');
      }
    } catch (err: unknown) {
      const error = err as Error & { response?: { status?: number; data?: { message?: string } }; message?: string };
      console.error('Error fetching admin chats:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        url: `${API_ROUTES.ADMIN_SUPPORT_CHATS}?${params}`
      });
      
      const errorMessage = error.response?.data?.message || error.message || 'Lỗi kết nối server';
      if (error.response?.status === 401) {
        setError('Không có quyền truy cập. Vui lòng đăng nhập lại.');
      } else if (error.response?.status === 403) {
        setError('Không có quyền admin. Vui lòng liên hệ quản trị viên.');
      } else if (error.response?.status === 400) {
        // Filter `?status=` sai vocabulary giờ trả 400 thay vì trang rỗng —
        // trang rỗng và filter gõ sai trông giống hệt nhau từ phía client.
        setError(error.response.data?.message || 'Bộ lọc không hợp lệ');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, currentLimit]); // Include currentPage and currentLimit dependencies

  // Debounced fetch function to prevent too frequent API calls
  const debouncedFetchChats = useCallback(async (pageToFetch?: number) => {
    const now = Date.now();
    
    // Clear existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    // If enough time has passed since last fetch, execute immediately
    if (now - lastFetchTimeRef.current >= MIN_FETCH_INTERVAL) {
      lastFetchTimeRef.current = now;
      return fetchChatsInternal(pageToFetch);
    }
    
    // Otherwise, debounce the call
    return new Promise<void>((resolve) => {
      fetchTimeoutRef.current = setTimeout(() => {
        lastFetchTimeRef.current = Date.now();
        fetchChatsInternal(pageToFetch).then(() => resolve());
      }, MIN_FETCH_INTERVAL - (now - lastFetchTimeRef.current));
    });
  }, [fetchChatsInternal]);

  // Update filters and refetch
  const updateFilters = useCallback((newFilters: Partial<AdminChatFilters>) => {
    currentFilters.current = { ...currentFilters.current, ...newFilters };
    setCurrentPage(1); // This will trigger fetchChats via useEffect
  }, []);

  // Refresh chat list
  const refreshChats = useCallback(() => {
    debouncedFetchChats(currentPage);
  }, [currentPage, debouncedFetchChats]);

  // Mark chat as read (UI-first update like user chat)
  const markChatAsRead = useCallback(async (chatId: string) => {
    // Get current unread count for this chat
    const currentChat = chats.find(c => c.id === chatId);
    const unreadCount = currentChat?.unreadByAdmin || 0;
    
    if (unreadCount === 0) return; // Already read
    
    console.log(`✅ Admin marking ${unreadCount} messages as read for chat ${chatId}`);
    
    // Update UI immediately for better UX
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, unreadByAdmin: 0 }
          : chat
      )
    );
    
    // Also update stats immediately
    setStats(prevStats => {
      const chatStatus = currentChat?.status || 'open';
      return {
        ...prevStats,
        [chatStatus]: {
          ...prevStats[chatStatus as keyof AdminChatStats],
          unread: Math.max(0, (prevStats[chatStatus as keyof AdminChatStats]?.unread || 0) - unreadCount)
        }
      } as AdminChatStats;
    });
    
    try {
      // Call API to persist the change
      const response = await axiosClient.patch(API_ROUTES.ADMIN_SUPPORT_CHAT_READ(chatId));
      
      if (response.data.status === 'success') {
        console.log('✅ Admin messages marked as read in database');
        
        // Emit WebSocket event to notify backend
        if (socket?.connected) {
          // BE: socket.on('user_read_messages', ({ chatId, messageIds })) —
          // danh tính lấy từ JWT ở handshake, không gửi kèm nữa.
          socket.emit(WEBSOCKET_EVENTS.USER_READ_MESSAGES, { chatId, messageIds: [] });
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('Failed to mark admin messages as read:', error);
      // UI already updated, so user experience is not affected
    }
  }, [chats, socket]);

  // Update chat status
  const updateChatStatus = useCallback(async (
    chatId: string, 
    status: AdminChatListItem['status'],
    priority?: AdminChatListItem['priority']
  ) => {
    try {
      const updateData: { status: AdminChatListItem['status']; priority?: AdminChatListItem['priority'] } = { status };
      if (priority) updateData.priority = priority;

      const response = await axiosClient.patch(API_ROUTES.ADMIN_SUPPORT_CHAT_STATUS(chatId), updateData);
      
      if (response.data.success) {
        // Update local state
        setChats(prevChats => 
          prevChats.map(chat => 
            chat.id === chatId 
              ? { ...chat, status, ...(priority && { priority }) }
              : chat
          )
        );
        
        // Refresh stats
        refreshChats();
      }
      
      return response.data;
    } catch (err: unknown) {
      // Backend giờ từ chối status ngoài enum đóng bằng 400 thay vì lặng lẽ ghi
      // vào DB. Hiện message của backend để không nuốt lỗi.
      const error = err as Error & {
        response?: { status?: number; data?: { message?: string } };
      };
      console.error('Error updating chat status:', error);
      if (error.response?.status === 400) {
        setError(error.response.data?.message || 'Trạng thái không hợp lệ');
      }
      throw error;
    }
  }, [refreshChats]);

  // Bulk actions
  const performBulkAction = useCallback(async (
    chatIds: string[], 
    action: 'mark_resolved' | 'mark_closed' | 'change_priority',
    value?: string
  ) => {
    try {
      // Backend không có endpoint bulk — gọi lần lượt PATCH status cho từng chat.
      const body =
        action === 'change_priority'
          ? { priority: value }
          : { status: action === 'mark_resolved' ? 'resolved' : 'closed' };

      const results = await Promise.all(
        chatIds.map((chatId) =>
          axiosClient.patch(API_ROUTES.ADMIN_SUPPORT_CHAT_STATUS(chatId), body)
        )
      );

      refreshChats();

      return results.map((res) => res.data);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error performing bulk action:', error);
      throw error;
    }
  }, [refreshChats]);

  // WebSocket event handlers
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewChat = (data: AdminChatListItem) => {
      setChats(prevChats => [data, ...prevChats]);
      setStats(prevStats => ({
        ...prevStats,
        open: {
          count: (prevStats.open?.count || 0) + 1,
          unread: (prevStats.open?.unread || 0) + 1
        }
      }));

      // Add notification
      const notification: AdminNotification = {
        id: Date.now().toString(),
        type: 'new_chat',
        title: 'Tin nhắn mới',
        message: `${data.user.fullname} đã gửi tin nhắn hỗ trợ`,
        chatId: data.id,
        userId: data.userId,
        priority: data.priority,
        timestamp: new Date(),
        isRead: false
      };
      setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50
    };

    const handleNewMessage = (data: {
      chatId: string;
      message: string;
      senderType: 'user' | 'admin';
      timestamp: string;
    }) => {
      // Update chat list with latest message
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === data.chatId 
            ? {
                ...chat,
                lastMessage: {
                  message: data.message,
                  senderType: data.senderType,
                  timestamp: new Date(data.timestamp)
                },
                lastMessageAt: new Date(data.timestamp),
                unreadByAdmin: data.senderType === 'user' ? chat.unreadByAdmin + 1 : chat.unreadByAdmin
              }
            : chat
        )
      );

      if (data.senderType === 'user') {
        // Note: Stats and notifications will be updated via separate WebSocket events
        // to avoid dependency on the chats array which causes infinite loops
      }
    };

    const handleChatStatusUpdate = (data: { chatId: string; status: string }) => {
      setChats(prevChats =>
        prevChats.map(chat =>
          chat.id === data.chatId
            ? { ...chat, status: data.status as AdminChatListItem['status'] }
            : chat
        )
      );
    };

    // Đã gỡ `handleStatsUpdate` và `handleUnreadCountUpdate`: backend không hề emit
    // `chat_stats_updated` / `unread_count_updated` nên chúng chưa từng chạy.
    // Stats và unread count giờ được cập nhật trong `handleNewMessage` + refetch.

    // BE: socket.on('admin_join_all') -> join admin_room + admin_notifications.
    // Không còn tham số; server tự kiểm role 'admin' trong token.
    socket.emit(WEBSOCKET_EVENTS.ADMIN_JOIN_ALL);

    // Subscribe to events.
    // BE không có `chat_stats_updated` / `unread_count_updated` — stats và unread count
    // được suy ra tại chỗ từ `support_chat_created` / `new_support_message`, hoặc refetch.
    socket.on(WEBSOCKET_EVENTS.SUPPORT_CHAT_CREATED, handleNewChat);
    socket.on(WEBSOCKET_EVENTS.NEW_SUPPORT_MESSAGE, handleNewMessage);
    socket.on(WEBSOCKET_EVENTS.CHAT_STATUS_CHANGED, handleChatStatusUpdate);
    socket.on(WEBSOCKET_EVENTS.SUPPORT_CHAT_STATUS_UPDATE, handleChatStatusUpdate);

    return () => {
      socket.off(WEBSOCKET_EVENTS.SUPPORT_CHAT_CREATED, handleNewChat);
      socket.off(WEBSOCKET_EVENTS.NEW_SUPPORT_MESSAGE, handleNewMessage);
      socket.off(WEBSOCKET_EVENTS.CHAT_STATUS_CHANGED, handleChatStatusUpdate);
      socket.off(WEBSOCKET_EVENTS.SUPPORT_CHAT_STATUS_UPDATE, handleChatStatusUpdate);
    };
  }, [socket, isConnected, adminId]);

  // Initial fetch on mount only
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      debouncedFetchChats();
    }
  }, [debouncedFetchChats]);

  // Separate effect to refetch when page/filters change 
  useEffect(() => {
    if (hasMountedRef.current) {
      debouncedFetchChats();
    }
  }, [currentPage, debouncedFetchChats]); // Only trigger when currentPage changes

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  // Dismiss notification
  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  return {
    // Data
    chats,
    stats,
    pagination,
    notifications,
    
    // States
    isLoading,
    error,
    isConnected,
    
    // Actions
    fetchChats: debouncedFetchChats,
    refreshChats,
    updateFilters,
    markChatAsRead,
    updateChatStatus,
    performBulkAction,
    dismissNotification,
    markAllNotificationsAsRead,
    changePage: setCurrentPage,
    
    // Pagination data
    currentPage,
    
    // Computed values
    unreadCount: Object.values(stats ?? {}).reduce((total, statusStats) => {
      if (typeof statusStats === 'object' && statusStats && 'unread' in statusStats && typeof statusStats.unread === 'number') {
        return total + statusStats.unread;
      }
      return total;
    }, 0),
    hasUnreadNotifications: notifications.some(n => !n.isRead)
  };
}