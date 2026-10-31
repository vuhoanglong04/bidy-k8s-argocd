'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  useNotifications, 
  useUnreadCount, 
  useNotificationStats,
  useMarkAsRead, 
  useMarkAllAsRead, 
  useDeleteNotification,
  useCreateTestNotification,
  type Notification 
} from '@/services/notification'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Search,
  MoreVertical,
  Plus,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { resolveNotificationActionUrl } from '@/utils'
import {
  APP_ROUTES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_PRIORITY_LABELS,
  type NotificationCategory,
  type NotificationPriority,
} from '@/constants'
import { NotificationIcon } from '@/components/common/notification'

type FilterOption = 'all' | NotificationCategory
type ReadFilter = 'all' | 'unread' | 'read'
type PriorityFilter = 'all' | NotificationPriority

export default function NotificationsPage() {
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<FilterOption>('all')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [showFilters, setShowFilters] = useState(false)

  const pageSize = 20

  // Queries
  const { 
    data: notificationData, 
    isLoading, 
    refetch 
  } = useNotifications({
    page: currentPage,
    limit: pageSize,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    isRead: readFilter !== 'all' ? readFilter === 'read' : undefined,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
  })

  const { data: unreadData } = useUnreadCount()
  const { data: statsData } = useNotificationStats()

  // Mutations
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const deleteNotification = useDeleteNotification()
  const createTestNotification = useCreateTestNotification()

  // Filter notifications by search query
  const filteredNotifications = useMemo(() => {
    if (!notificationData?.notifications) return []
    
    if (!searchQuery.trim()) return notificationData.notifications

    const query = searchQuery.toLowerCase()
    return notificationData.notifications.filter(notification =>
      notification.title.toLowerCase().includes(query) ||
      notification.message.toLowerCase().includes(query)
    )
  }, [notificationData?.notifications, searchQuery])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead.mutateAsync(notificationId)
    } catch (error) {
      console.error('Mark as read error:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead.mutateAsync()
    } catch (error) {
      console.error('Mark all as read error:', error)
    }
  }

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteNotification.mutateAsync(notificationId)
    } catch (error) {
      console.error('Delete notification error:', error)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.isRead) {
      handleMarkAsRead(notification.id)
    }

    // Navigate to action URL if available
    if (notification.actionUrl) {
      router.push(resolveNotificationActionUrl(notification.actionUrl))
    } else if (
      notification.type.startsWith('withdrawal_') ||
      notification.type === 'payment_released' ||
      notification.type === 'topup_success'
    ) {
      router.push(APP_ROUTES.MY_WALLET)
    }
  }

  const handleCreateTestNotification = async () => {
    try {
      await createTestNotification.mutateAsync({
        type: 'system_maintenance',
        title: 'Thông báo test',
        message: 'Đây là thông báo test để kiểm tra hệ thống notification',
      })
    } catch (error) {
      console.error('Create test notification error:', error)
    }
  }

  const getNotificationIcon = (notification: Notification) => (
    <NotificationIcon type={notification.type} className="size-5" />
  )

  /** Chỉ ưu tiên thật sự mới đáng chiếm màu — normal để chữ trần cho đỡ nhiễu. */
  const getPriorityBadge = (priority: string) => {
    const base =
      'px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide'
    switch (priority) {
      case 'urgent':
        return (
          <span className={cn(base, 'bg-destructive text-destructive-foreground')}>
            Khẩn cấp
          </span>
        )
      case 'high':
        return (
          <span className={cn(base, 'bg-warning text-warning-foreground')}>Cao</span>
        )
      default:
        return null
    }
  }

  const getCategoryName = (category: NotificationCategory) =>
    NOTIFICATION_CATEGORY_LABELS[category] ?? category

  const formatRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true, 
        locale: vi 
      })
    } catch {
      return 'Vừa xong'
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Thông báo</h1>
            {unreadData && unreadData.count > 0 && (
              <span className="bg-destructive px-2 py-0.5 text-[11px] font-semibold tabular-nums text-destructive-foreground">
                {unreadData.count} chưa đọc
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-foreground-secondary">
            {notificationData?.pagination.totalCount || 0} thông báo tổng cộng
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Làm mới
          </Button>

          {unreadData && unreadData.count > 0 && (
            <Button
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Đánh dấu tất cả đã đọc
            </Button>
          )}

          {process.env.NODE_ENV === 'development' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateTestNotification}
              disabled={createTestNotification.isPending}
            >
              <Plus className="w-4 h-4 mr-1" />
              Test
            </Button>
          )}
        </div>
      </header>

      {/* Stats */}
      {statsData && (
        <div className="grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
          {[
            { label: 'Tổng chưa đọc', value: statsData.totalUnread ?? 0 },
            { label: 'Đấu giá chưa đọc', value: statsData.categories?.auction ?? 0 },
            { label: 'Đặt giá chưa đọc', value: statsData.categories?.bid ?? 0 },
            {
              label: 'Ưu tiên cao chưa đọc',
              value:
                (statsData.priorities?.urgent ?? 0) +
                (statsData.priorities?.high ?? 0),
            },
          ].map((card) => (
            <div key={card.label} className="flex flex-col gap-1 bg-card px-4 py-3">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {card.value}
              </span>
              <span className="text-xs text-foreground-secondary">{card.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-secondary"
            aria-hidden
          />
          <input
            type="text"
            placeholder="Tìm kiếm thông báo..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="h-10 w-full border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="button"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex h-10 items-center gap-2 border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Filter className="size-4" aria-hidden />
          Bộ lọc
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="grid grid-cols-1 gap-4 border border-border bg-card p-4 lg:grid-cols-3">
          {/* Category Filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Danh mục
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as FilterOption)}
              className="h-10 w-full border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Tất cả</option>
              {NOTIFICATION_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {NOTIFICATION_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>

          {/* Read Status Filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Trạng thái
            </label>
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value as ReadFilter)}
              className="h-10 w-full border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Tất cả</option>
              <option value="unread">Chưa đọc</option>
              <option value="read">Đã đọc</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Độ ưu tiên
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              className="h-10 w-full border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Tất cả</option>
              {NOTIFICATION_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {NOTIFICATION_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="border border-dashed border-border px-6 py-14 text-center">
          <Bell className="mx-auto size-8 text-foreground-secondary" aria-hidden />
          <p className="mt-3 text-base font-medium text-foreground">
            {searchQuery ? 'Không tìm thấy thông báo' : 'Chưa có thông báo nào'}
          </p>
          <p className="mt-1 text-sm text-foreground-secondary">
            {searchQuery
              ? 'Thử thay đổi từ khoá tìm kiếm hoặc bộ lọc.'
              : 'Khi có thông báo mới, chúng sẽ xuất hiện ở đây.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filteredNotifications.map((notification) => (
            <li
              key={notification.id}
              className={cn(
                'group cursor-pointer border-l-2 border border-border bg-card p-4 transition-colors hover:bg-accent',
                notification.isRead
                  ? 'border-l-transparent'
                  : 'border-l-primary bg-accent-subtle'
              )}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  {getNotificationIcon(notification)}
                </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3
                          className={cn(
                            'text-sm',
                            notification.isRead
                              ? 'font-medium text-foreground'
                              : 'font-semibold text-foreground'
                          )}
                        >
                          {notification.title}
                        </h3>

                        <p className="mt-1 line-clamp-2 text-sm text-foreground-secondary">
                          {notification.message}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-foreground-secondary">
                            {formatRelativeTime(notification.createdAt)}
                          </span>

                          <span className="text-xs text-foreground-secondary">
                            · {getCategoryName(notification.category)}
                          </span>

                          {getPriorityBadge(notification.priority)}

                          {notification.actionUrl && (
                            <ExternalLink
                              className="size-3 text-foreground-secondary"
                              aria-hidden
                            />
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!notification.isRead && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              handleMarkAsRead(notification.id)
                            }}>
                              <Check className="w-4 h-4 mr-2" />
                              Đánh dấu đã đọc
                            </DropdownMenuItem>
                          )}
                          
                          {notification.actionUrl && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              router.push(resolveNotificationActionUrl(notification.actionUrl!))
                            }}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Xem chi tiết
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteNotification(notification.id)
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Xoá
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {notificationData && notificationData.pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
            Trước
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: notificationData.pagination.totalPages }, (_, i) => i + 1)
              .filter(page => 
                page === 1 || 
                page === notificationData.pagination.totalPages || 
                Math.abs(page - currentPage) <= 2
              )
              .map((page, index, array) => (
                <div key={page} className="flex items-center">
                  {index > 0 && array[index - 1] < page - 1 && (
                    <span className="px-2 text-foreground-secondary">...</span>
                  )}
                  <Button
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                </div>
              ))}
          </div>

          <Button
            variant="outline"
            disabled={currentPage === notificationData.pagination.totalPages}
            onClick={() => setCurrentPage(prev => Math.min(notificationData.pagination.totalPages, prev + 1))}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
  )
}