/**
 * Admin Support Chat React Query Hooks
 * React Query hooks for admin chat functionality with optimized polling
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminSupportChats,
  getAdminChatDetail,
  sendAdminMessage,
  updateAdminChatStatus,
  markAdminChatAsRead,
  getAdminChatUnreadCount
} from './admin-chat.fetcher';
import type {
  AdminChatFilters,
  AdminSupportChat
} from '@/types/admin-chat';
import type { SupportChatMessage } from '@/types/chat';

// Custom type for chat detail with messages
interface ChatDetailWithMessages {
  status: string;
  message: string;
  data: {
    chat: AdminSupportChat;
    messages: SupportChatMessage[];
  };
}

// Query keys
export const adminChatKeys = {
  all: ['admin-chats'] as const,
  lists: () => [...adminChatKeys.all, 'list'] as const,
  list: (filters: Partial<AdminChatFilters>, page: number) => 
    [...adminChatKeys.lists(), filters, page] as const,
  details: () => [...adminChatKeys.all, 'detail'] as const,
  detail: (id: string, page: number) => [...adminChatKeys.details(), id, page] as const,
  unreadCount: () => [...adminChatKeys.all, 'unread-count'] as const,
};

// Get admin support chats list with optimized polling
export const useAdminSupportChatsList = (params: {
  page?: number;
  limit?: number;
  filters?: Partial<AdminChatFilters>;
  enabled?: boolean;
}) => {
  const { page = 1, limit = 20, filters = {}, enabled = true } = params;
  
  return useQuery({
    queryKey: adminChatKeys.list(filters, page),
    queryFn: () => getAdminSupportChats({ page, limit, ...filters }),
    enabled,
    staleTime: 120000, // 2 minutes - increased from 30 seconds
    refetchInterval: 180000, // Reduced frequency to 3 minutes from 1 minute
    refetchOnWindowFocus: false, // Prevent excessive refetches
    refetchOnMount: 'always', // Only refetch if data is older than staleTime
  });
};

// Get chat detail with messages - optimized for less frequent polling
export const useAdminChatDetail = (chatId: string, page: number = 1) => {
  return useQuery({
    queryKey: adminChatKeys.detail(chatId, page),
    queryFn: () => getAdminChatDetail(chatId, page),
    enabled: !!chatId,
    staleTime: 60000, // 1 minute - increased from 10 seconds
    refetchInterval: 120000, // 2 minutes - reduced from 30 seconds
    refetchOnWindowFocus: false, // Prevent excessive refetches on window focus
    refetchOnMount: 'always', // Always refetch on mount for real-time chat data
  });
};

// Số chat còn tin chưa đọc. Backend không có endpoint thống kê/hiệu suất nào
// khác cho support chat, nên các hook stats/metrics cũ đã bị gỡ thay vì gọi vào
// path không tồn tại (mọi path lạ đều rơi vào notFound handler → 404).
export const useAdminChatUnreadCount = () => {
  return useQuery({
    queryKey: adminChatKeys.unreadCount(),
    queryFn: getAdminChatUnreadCount,
    staleTime: 180000, // 3 minutes
    refetchInterval: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Send admin message mutation with optimistic updates
export const useSendAdminMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: sendAdminMessage,
    onSuccess: (data, variables) => {
      // Invalidate chat detail queries
      queryClient.invalidateQueries({ 
        queryKey: adminChatKeys.details() 
      });
      
      // Invalidate chat list to update lastMessage
      queryClient.invalidateQueries({ 
        queryKey: adminChatKeys.lists() 
      });
      
      // Update specific chat detail cache optimistically
      const existingDetail = queryClient.getQueryData(
        adminChatKeys.detail(variables.chatId, 1)
      );
      
      if (existingDetail) {
        // Optimistically add the new message
        queryClient.setQueryData(
          adminChatKeys.detail(variables.chatId, 1),
          (old: ChatDetailWithMessages | undefined) => {
            if (!old) return old;
            return {
              ...old,
              data: {
                ...old.data,
                messages: [...old.data.messages, data.data]
              }
            };
          }
        );
      }
    },
    onError: (error) => {
      console.error('Failed to send admin message:', error);
    }
  });
};

// Update chat status mutation with optimistic updates
export const useUpdateAdminChatStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateAdminChatStatus,
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ 
        queryKey: adminChatKeys.lists() 
      });
      queryClient.invalidateQueries({ 
        queryKey: adminChatKeys.details() 
      });
      queryClient.invalidateQueries({ 
        queryKey: adminChatKeys.unreadCount() 
      });
      
      // Update specific chat in cache optimistically
      queryClient.setQueryData(
        adminChatKeys.detail(variables.chatId, 1),
        (old: ChatDetailWithMessages | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              chat: {
                ...old.data.chat,
                status: variables.status,
                ...(variables.priority && { priority: variables.priority })
              }
            }
          };
        }
      );
    },
  });
};

// Mark chat as read mutation with optimistic updates
export const useMarkAdminChatAsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: markAdminChatAsRead,
    onSuccess: (data, chatId) => {
      // Update unread count in cache optimistically
      queryClient.invalidateQueries({ 
        queryKey: adminChatKeys.lists() 
      });
      queryClient.invalidateQueries({ 
        queryKey: adminChatKeys.unreadCount() 
      });
      
      // Update specific chat detail optimistically
      queryClient.setQueryData(
        adminChatKeys.detail(chatId, 1),
        (old: ChatDetailWithMessages | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: {
              ...old.data,
              chat: {
                ...old.data.chat,
                unreadByAdmin: 0
              }
            }
          };
        }
      );
    },
  });
};
