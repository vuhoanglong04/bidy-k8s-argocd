import { API_ROUTES } from '@/constants'
import axiosClient from '@/lib/axios-client'
import type { components, paths } from '@/types/openapi'
import type { NotificationType } from '@/constants/notification.constants'

type NotificationSchema = components['schemas']['Notification']

/**
 * Chỉ có ở đúng 2 type do người dùng gây ra: `new_bid` và `bid_outbid`; mọi
 * type còn lại là null — mọi chỗ đọc phải null-safe.
 *
 * BE đã thu hẹp còn 3 field để bịt rò PII (trước đây trả nguyên User row kèm
 * email/SĐT ra cả REST lẫn socket). `fullname` sẽ không bao giờ được trả nữa —
 * cần hiện tên thì dùng `username`. `avatarFileId` là storage key CHƯA presign,
 * đừng dựng URL từ nó.
 */
export type NotificationActor = NonNullable<NotificationSchema['actor']>

/**
 * Shape đổi theo `type` — xem description trong swagger. Ba chỗ dễ vỡ:
 * `auction_won`/`auction_lost` dùng `finalPrice` còn các type auction/bid khác
 * dùng `currentPrice` (không type nào có cả hai); `payment_reminder` không có
 * `auction` nên không có ảnh; không tồn tại key `bid` hay `payment` — số tiền
 * nằm ở `bidAmount`/`newBidAmount`/`yourBid`/`amount` tuỳ type.
 *
 * `account_suspended`/`account_banned` mang `reason` (câu admin tự viết, hiển
 * thị thẳng được) và `suspendedUntil` — null với ban vĩnh viễn.
 */
export type NotificationRelatedData = NonNullable<
  NotificationSchema['relatedData']
>

export type NotificationAuctionRef = NonNullable<
  NotificationRelatedData['auction']
>

/**
 * Item notification. Swagger không khai `required` nên mọi field trong schema
 * generate ra đều optional; ở đây siết lại những field BE luôn trả để chỗ dùng
 * không phải `?.` vô nghĩa.
 *
 * `id` là bigint Postgres — TypeORM trả về STRING. Đừng parseInt (mất chính xác
 * ở giá trị lớn) và đừng so `===` với number.
 */
export interface Notification extends Omit<NotificationSchema, 'type'> {
  id: string
  recipientId: string
  type: NotificationType
  title: string
  message: string
  category: NonNullable<NotificationSchema['category']>
  priority: NonNullable<NotificationSchema['priority']>
  isRead: boolean
  createdAt: string
}

export interface NotificationResponse {
  notifications: Notification[]
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    limit: number
    hasMore: boolean
  }
  unreadCount: number
}

export type NotificationStats = NonNullable<
  paths['/api/v1/notifications/stats']['get']['responses'][200]['content']['application/json']['data']
>

// Get user notifications with pagination and filters
export const getNotifications = async (params?: {
  page?: number
  limit?: number
  category?: string
  isRead?: boolean
  priority?: string
  type?: string
}): Promise<NotificationResponse> => {
  const response = await axiosClient.get<{ data: NotificationResponse }>(
    API_ROUTES.NOTIFICATIONS,
    { params }
  )
  return response.data.data
}

// Get unread notification count
export const getUnreadCount = async (): Promise<{ count: number }> => {
  const response = await axiosClient.get<{ data: { count: number } }>(
    API_ROUTES.NOTIFICATIONS_UNREAD_COUNT
  )
  return response.data.data
}

// Get notification statistics
export const getNotificationStats = async (): Promise<NotificationStats> => {
  const response = await axiosClient.get<{ data: NotificationStats }>(
    API_ROUTES.NOTIFICATIONS_STATS
  )
  return response.data.data
}

// Get notifications by category
export const getNotificationsByCategory = async (
  category: string,
  params?: {
    page?: number
    limit?: number
    includeRead?: boolean
  }
): Promise<{
  notifications: Notification[]
  category: string
  pagination: {
    page: number
    limit: number
    hasMore: boolean
  }
}> => {
  const response = await axiosClient.get<{
    data: {
      notifications: Notification[]
      category: string
      pagination: {
        page: number
        limit: number
        hasMore: boolean
      }
    }
  }>(API_ROUTES.NOTIFICATIONS_BY_CATEGORY(category), { params })
  return response.data.data
}

// Mark notification as read
export const markAsRead = async (notificationId: string): Promise<Notification> => {
  const response = await axiosClient.put<{ data: Notification }>(
    API_ROUTES.NOTIFICATION_READ(notificationId)
  )
  return response.data.data
}

// Mark all notifications as read
export const markAllAsRead = async (): Promise<{ modifiedCount: number }> => {
  const response = await axiosClient.put<{ data: { modifiedCount: number } }>(
    API_ROUTES.NOTIFICATIONS_MARK_ALL_READ
  )
  return response.data.data
}

// Delete notification
export const deleteNotification = async (notificationId: string): Promise<{ deletedCount: number }> => {
  const response = await axiosClient.delete<{ data: { deletedCount: number } }>(
    API_ROUTES.NOTIFICATION_BY_ID(notificationId)
  )
  return response.data.data
}

// Create test notification (development only)
export const createTestNotification = async (data?: {
  type?: string
  title?: string
  message?: string
}): Promise<Notification> => {
  const response = await axiosClient.post<{ data: Notification }>(
    API_ROUTES.NOTIFICATIONS_TEST,
    data || {}
  )
  return response.data.data
}