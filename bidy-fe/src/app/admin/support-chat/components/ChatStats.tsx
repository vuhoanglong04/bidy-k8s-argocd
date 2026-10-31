"use client";

import React from 'react';
import { 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { AdminChatStats } from '@/types/admin-chat';

interface ChatStatsProps {
  stats: AdminChatStats | null | undefined;
}

interface StatCard {
  title: string;
  value: number;
  icon: React.ReactElement;
  color: string;
  bgColor: string;
  borderColor: string;
  highlight?: boolean;
}

export default function ChatStats({ stats }: ChatStatsProps) {
  // Return loading state if stats is not available
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="p-4 rounded-lg border bg-gray-50 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const getTotalCount = () => {
    if (!stats) return 0;
    return Object.values(stats).reduce((total, stat) => total + (stat?.count || 0), 0);
  };

  const getTotalUnread = () => {
    if (!stats) return 0;
    return Object.values(stats).reduce((total, stat) => total + (stat?.unread || 0), 0);
  };

  const statsCards: StatCard[] = [
    {
      title: 'Tổng tin nhắn',
      value: getTotalCount(),
      icon: <MessageSquare size={20} />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Tin nhắn mở',
      value: stats?.open?.count ?? 0,
      icon: <AlertCircle size={20} />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    {
      title: 'Đang xử lý',
      value: stats?.in_progress?.count ?? 0,
      icon: <Clock size={20} />,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    {
      title: 'Đã giải quyết',
      value: stats?.resolved?.count ?? 0,
      icon: <CheckCircle2 size={20} />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Chưa đọc',
      value: getTotalUnread(),
      icon: <MessageSquare size={20} />,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      highlight: getTotalUnread() > 0
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {statsCards.map((stat, index) => (
        <div
          key={index}
          className={`relative p-4 rounded-lg border transition-all hover:shadow-md ${
            stat.bgColor
          } ${stat.borderColor} ${
            stat.highlight ? 'ring-2 ring-red-200 shadow-md' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {stat.title}
              </p>
              <p className={`text-2xl font-bold ${stat.color}`}>
                {(stat.value ?? 0).toLocaleString()}
              </p>
            </div>
            <div className={`${stat.color} opacity-80`}>
              {stat.icon}
            </div>
          </div>
          
          {stat.highlight && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
      ))}
    </div>
  );
}