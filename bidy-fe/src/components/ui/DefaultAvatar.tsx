"use client";

import React from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { getDefaultAvatar } from '@/lib/image-utils';

interface DefaultAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'user' | 'admin' | 'gradient' | 'image';
  name?: string;
  showOnlineStatus?: boolean;
  src?: string;
}

const getSizeClasses = (size: string) => {
  switch (size) {
    case 'sm': return 'w-8 h-8';
    case 'md': return 'w-10 h-10';
    case 'lg': return 'w-14 h-14';
    case 'xl': return 'w-16 h-16';
    default: return 'w-10 h-10';
  }
};

const getIconSize = (size: string) => {
  switch (size) {
    case 'sm': return 16;
    case 'md': return 20;
    case 'lg': return 28;
    case 'xl': return 32;
    default: return 20;
  }
};

const getVariantClasses = (variant: string, name?: string) => {
  switch (variant) {
    case 'admin':
      return 'bg-gradient-to-br from-blue-500 to-purple-600 text-white';
    case 'user':
      return 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white';
    case 'gradient':
      return 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white';
    default:
      // Generate gradient based on name hash for consistency
      if (name) {
        const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const gradients = [
          'from-blue-500 to-purple-600',
          'from-emerald-500 to-teal-600',
          'from-pink-500 to-rose-600',
          'from-orange-500 to-red-600',
          'from-indigo-500 to-blue-600',
          'from-green-500 to-emerald-600',
          'from-purple-500 to-pink-600',
          'from-cyan-500 to-blue-600',
        ];
        return `bg-gradient-to-br ${gradients[hash % gradients.length]} text-white`;
      }
      return 'bg-gradient-to-br from-blue-500 to-purple-600 text-white';
  }
};

const getInitials = (name?: string) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

export function DefaultAvatar({
  size = 'md',
  className = '',
  variant = 'gradient',
  name,
  showOnlineStatus = false,
  src
}: DefaultAvatarProps) {
  const { theme } = useTheme();
  const sizeClasses = getSizeClasses(size);
  const iconSize = getIconSize(size);
  const variantClasses = getVariantClasses(variant, name);

  // If src is provided or variant is 'image', show image with fallback
  if (src || variant === 'image') {
    return (
      <div className={`relative ${className}`}>
        <div className={`${sizeClasses} rounded-full overflow-hidden shadow-sm bg-gray-100`}>
          <Image
            src={src || getDefaultAvatar(theme)}
            alt={name || 'Avatar'}
            width={size === 'sm' ? 32 : size === 'md' ? 40 : size === 'lg' ? 56 : 64}
            height={size === 'sm' ? 32 : size === 'md' ? 40 : size === 'lg' ? 56 : 64}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to default avatar on error
              e.currentTarget.src = getDefaultAvatar(theme);
            }}
          />
        </div>

        {/* Online status indicator */}
        {showOnlineStatus && (
          <div className={`absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full border-2 border-white ${
            size === 'sm' ? 'w-2.5 h-2.5' :
            size === 'md' ? 'w-3 h-3' :
            size === 'lg' ? 'w-4 h-4' : 'w-5 h-5'
          }`} />
        )}
      </div>
    );
  }

  // Original gradient/initials/icon avatar
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClasses} rounded-full flex items-center justify-center ${variantClasses} shadow-sm`}>
        {name ? (
          <span className={`font-semibold ${
            size === 'sm' ? 'text-xs' :
            size === 'md' ? 'text-sm' :
            size === 'lg' ? 'text-base' : 'text-lg'
          }`}>
            {getInitials(name)}
          </span>
        ) : (
          <User size={iconSize} />
        )}
      </div>

      {/* Online status indicator */}
      {showOnlineStatus && (
        <div className={`absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full border-2 border-white ${
          size === 'sm' ? 'w-2.5 h-2.5' :
          size === 'md' ? 'w-3 h-3' :
          size === 'lg' ? 'w-4 h-4' : 'w-5 h-5'
        }`} />
      )}
    </div>
  );
}