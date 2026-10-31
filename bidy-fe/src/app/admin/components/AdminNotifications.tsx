"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  NotificationPanel,
  type NotificationItemData,
  type NotificationTone,
} from '@/components/common/notification';
import { useNotifications } from '@/contexts/NotificationContext';
import type { AdminNotification } from '@/types/admin-chat';
import { cn } from '@/lib/utils';
import { APP_ROUTES } from '@/constants/routes.constants';

interface AdminNotificationsProps {
  className?: string;
}

/**
 * Thang priority của support-chat (`low|medium|high`) KHÁC thang của
 * notification người dùng (`normal|high|urgent`) — hai hệ riêng biệt, chỉ gặp
 * nhau ở tone hiển thị.
 */
const PRIORITY_TONES: Record<
  AdminNotification['priority'],
  NotificationTone | null
> = {
  low: null,
  medium: 'warning',
  high: 'critical',
};

const PRIORITY_LABELS: Record<AdminNotification['priority'], string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
};

const formatTime = (date: Date) => {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  return new Date(date).toLocaleDateString('vi-VN');
};

export default function AdminNotifications({ className = '' }: AdminNotificationsProps) {
  const {
    notifications,
    unreadCount,
    urgentCount,
    removeNotification,
    markAsRead,
    markAllAsRead,
    requestPermission
  } = useNotifications();

  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);

  // Request notification permission on first interaction
  useEffect(() => {
    if (!hasRequestedPermission && 'Notification' in window) {
      const checkPermission = async () => {
        if (Notification.permission === 'default') {
          await requestPermission();
        }
        setHasRequestedPermission(true);
      };
      checkPermission();
    }
  }, [requestPermission, hasRequestedPermission]);

  const items: NotificationItemData[] = useMemo(
    () =>
      notifications.map((n) => {
        const tone = PRIORITY_TONES[n.priority] ?? null;
        return {
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: n.isRead,
          timeLabel: formatTime(n.timestamp),
          badgeLabel: tone ? PRIORITY_LABELS[n.priority] : undefined,
          badgeTone: tone ?? undefined,
        };
      }),
    [notifications]
  );

  const handleSelect = (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;

    markAsRead(id);
    if (target.chatId) {
      setIsVisible(false);
      router.push(APP_ROUTES.ADMIN_SUPPORT_CHAT_DETAIL(target.chatId));
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* Notification Bell */}
      <button
        type="button"
        onClick={() => setIsVisible((prev) => !prev)}
        aria-label="Thông báo"
        aria-expanded={isVisible}
        className="relative cursor-pointer p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {urgentCount > 0 && unreadCount === 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-2 animate-pulse rounded-full bg-destructive" />
        )}
      </button>

      {isVisible && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsVisible(false)}
            aria-hidden
          />
          <NotificationPanel
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50"
            notifications={items}
            unreadCount={unreadCount}
            onSelect={handleSelect}
            onDismiss={removeNotification}
            onMarkAllAsRead={markAllAsRead}
          />
        </>
      )}
    </div>
  );
}
