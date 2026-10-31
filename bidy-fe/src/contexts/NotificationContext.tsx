"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AdminNotification } from '@/types/admin-chat';
import { toast } from 'sonner';

interface NotificationContextType {
  notifications: AdminNotification[];
  unreadCount: number;
  urgentCount: number;
  addNotification: (notification: Omit<AdminNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  markChatNotificationsAsRead: (chatId: string) => void;
  clearAll: () => void;
  requestPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  // Check initial notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setHasPermission(Notification.permission === 'granted');
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      setHasPermission(true);
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('User has denied notification permissions');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, []);

  // Add notification
  const addNotification = useCallback((notificationData: Omit<AdminNotification, 'id' | 'timestamp' | 'isRead'>) => {
    const notification: AdminNotification = {
      ...notificationData,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      isRead: false
    };

    setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50

    // Show browser notification if permission granted
    if (hasPermission && 'Notification' in window) {
      try {
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id,
          badge: '/favicon.ico',
          silent: notification.priority === 'low',
          requireInteraction: notification.priority === 'high'
        });

        // Auto close after 5 seconds for non-high priority
        if (notification.priority !== 'high') {
          setTimeout(() => browserNotification.close(), 5000);
        }

        // Handle click to navigate to chat
        browserNotification.onclick = () => {
          if (notification.chatId) {
            window.focus();
            window.location.href = `/admin/support-chat/${notification.chatId}`;
          }
          browserNotification.close();
        };
      } catch (error) {
        console.error('Error showing browser notification:', error);
      }
    }

    // Show in-app toast notification
    const getIcon = () => {
      switch (notification.type) {
        case 'new_chat': return '💬';
        case 'new_message': return '✉️';
        case 'urgent_chat': return '🚨';
        case 'chat_resolved': return '✅';
        case 'admin_mentioned': return '👋';
        case 'system': return '⚙️';
        default: return '📢';
      }
    };

    const getDuration = () => {
      switch (notification.priority) {
        case 'high': return 8000;
        case 'medium': return 5000;
        case 'low': return 3000;
        default: return 4000;
      }
    };

    toast(notification.title, {
      description: notification.message,
      icon: getIcon(),
      duration: getDuration(),
      action: notification.chatId ? {
        label: 'Xem ngay',
        onClick: () => window.location.href = `/admin/support-chat/${notification.chatId}`
      } : undefined,
      className: notification.priority === 'high' ? 'border-l-4 border-red-500' :
                 notification.priority === 'medium' ? 'border-l-4 border-yellow-500' :
                 'border-l-4 border-green-500'
    });
  }, [hasPermission]);

  // Remove notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Mark as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      )
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  // Mark all notifications for specific chat as read
  const markChatNotificationsAsRead = useCallback((chatId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.chatId === chatId ? { ...n, isRead: true } : n
      )
    );
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Auto-cleanup old notifications (older than 24 hours)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setNotifications(prev => 
        prev.filter(n => {
          const ageInHours = (now.getTime() - n.timestamp.getTime()) / (1000 * 60 * 60);
          return ageInHours < 24;
        })
      );
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(interval);
  }, []);

  // Calculate counts
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const urgentCount = notifications.filter(n => !n.isRead && n.priority === 'high').length;

  const value = {
    notifications,
    unreadCount,
    urgentCount,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    markChatNotificationsAsRead,
    clearAll,
    requestPermission
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}