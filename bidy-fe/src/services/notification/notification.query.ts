import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getNotifications,
  getUnreadCount,
  getNotificationStats,
  getNotificationsByCategory,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createTestNotification,
  type Notification,
} from './notification.fetcher'

// Query keys
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...notificationKeys.lists(), filters] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  stats: () => [...notificationKeys.all, 'stats'] as const,
  category: (category: string) => [...notificationKeys.all, 'category', category] as const,
}

// Get notifications with pagination and filters
export const useNotifications = (
  params?: {
    page?: number
    limit?: number
    category?: string
    isRead?: boolean
    priority?: string
    type?: string
  },
  /** `enabled`: dropdown chuông chỉ nạp danh sách khi người dùng mở panel. */
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: notificationKeys.list(params || {}),
    queryFn: () => getNotifications(params),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  })
}

// Get unread notification count
export const useUnreadCount = () => {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: getUnreadCount,
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 1 * 60 * 1000, // 1 minute
    // Không polling nữa: server đẩy event `notification` vào room user_<id>,
    // `useRealtimeNotifications` cộng badge tại chỗ khi có tin mới.
    //
    // Nhưng chỉ tin vào socket thì badge sai âm thầm mỗi khi kết nối rớt: số
    // đứng nguyên, nhìn như "không có gì mới". Bật riêng refetch-on-focus cho
    // đúng query này làm lưới an toàn — nó rẻ (một con số) và là thứ user nhìn
    // vào để biết có gì mới. Default toàn app vẫn là `false`, đừng đổi.
    refetchOnWindowFocus: true,
  })
}

// Get notification statistics
export const useNotificationStats = () => {
  return useQuery({
    queryKey: notificationKeys.stats(),
    queryFn: getNotificationStats,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get notifications by category
export const useNotificationsByCategory = (
  category: string,
  params?: {
    page?: number
    limit?: number
    includeRead?: boolean
  }
) => {
  return useQuery({
    queryKey: notificationKeys.category(category),
    queryFn: () => getNotificationsByCategory(category, params),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!category,
  })
}

// Mark notification as read
export const useMarkAsRead = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      // Update the notifications cache
      queryClient.setQueryData(
        notificationKeys.unreadCount(),
        (oldData: { count: number } | undefined) => {
          if (!oldData) return oldData
          return {
            count: Math.max(0, oldData.count - 1)
          }
        }
      )

      // Update notification lists
      queryClient.invalidateQueries({
        queryKey: notificationKeys.lists()
      })

      // Update stats
      queryClient.invalidateQueries({
        queryKey: notificationKeys.stats()
      })

      toast.success('Đã đánh dấu đã đọc')
    },
    onError: (error: Error) => {
      toast.error(`Lỗi: ${error.message}`)
    },
  })
}

// Mark all notifications as read
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: (result: { modifiedCount: number }) => {
      // Reset unread count to 0
      queryClient.setQueryData(
        notificationKeys.unreadCount(),
        { count: 0 }
      )

      // Invalidate all notification-related queries
      queryClient.invalidateQueries({
        queryKey: notificationKeys.all
      })

      toast.success(`Đã đánh dấu ${result.modifiedCount} thông báo là đã đọc`)
    },
    onError: (error: Error) => {
      toast.error(`Lỗi: ${error.message}`)
    },
  })
}

// Delete notification
export const useDeleteNotification = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      // Remove notification from cache
      queryClient.setQueryData(
        notificationKeys.unreadCount(),
        (oldData: { count: number } | undefined) => {
          if (!oldData) return oldData
          return {
            count: Math.max(0, oldData.count - 1)
          }
        }
      )

      // Invalidate notification lists
      queryClient.invalidateQueries({
        queryKey: notificationKeys.lists()
      })

      // Invalidate stats
      queryClient.invalidateQueries({
        queryKey: notificationKeys.stats()
      })

      toast.success('Đã xóa thông báo')
    },
    onError: (error: Error) => {
      toast.error(`Lỗi: ${error.message}`)
    },
  })
}

// Create test notification (development only)
export const useCreateTestNotification = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTestNotification,
    onSuccess: () => {
      // Invalidate all notification queries to refresh data
      queryClient.invalidateQueries({
        queryKey: notificationKeys.all
      })

      toast.success('Đã tạo thông báo test')
    },
    onError: (error: Error) => {
      toast.error(`Lỗi: ${error.message}`)
    },
  })
}

// Custom hook for real-time notification updates
export const useNotificationUpdates = () => {
  const queryClient = useQueryClient()

  const refreshNotifications = () => {
    queryClient.invalidateQueries({
      queryKey: notificationKeys.all
    })
  }

  const updateUnreadCount = (count: number) => {
    queryClient.setQueryData(
      notificationKeys.unreadCount(),
      { count }
    )
  }

  const addNotification = (notification: Notification) => {
    // Add to cache without invalidating (optimistic update)
    queryClient.setQueryData(
      notificationKeys.unreadCount(),
      (oldData: { count: number } | undefined) => {
        if (!oldData) return { count: 1 }
        return {
          count: oldData.count + (notification.isRead ? 0 : 1)
        }
      }
    )

    // Invalidate lists to show new notification
    queryClient.invalidateQueries({
      queryKey: notificationKeys.lists()
    })
  }

  return {
    refreshNotifications,
    updateUnreadCount,
    addNotification,
  }
}

// Custom hook for notification preferences (future use)
export const useNotificationPreferences = () => {
  // This can be extended later to handle user notification preferences
  // like which types of notifications to receive, delivery channels, etc.
  return {
    preferences: {
      inApp: true,
      email: false,
      push: true,
    },
    updatePreferences: (newPreferences: Record<string, unknown>) => {
      // Implementation for updating preferences
      console.log('Updating preferences:', newPreferences)
    },
  }
}