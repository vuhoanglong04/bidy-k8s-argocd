"use client";

import React from 'react';
import ProductGridCard, { ProductAttachment } from './ProductGridCard';

interface GridConfig {
  columns: number;
  maxItems: number;
}

interface ProductGridMessageProps {
  message: string;
  timestamp: Date;
  productAttachments?: ProductAttachment[];
  gridConfig?: GridConfig;
  isOwnMessage: boolean;
}

export default function ProductGridMessage({
  message,
  timestamp,
  productAttachments,
  gridConfig,
  isOwnMessage
}: ProductGridMessageProps) {

  // Format timestamp
  const formatTime = (date: Date) => {
    const messageDate = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      return 'Vừa xong';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} phút trước`;
    } else if (diffMinutes < 1440) { // 24 hours
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours} giờ trước`;
    } else {
      return messageDate.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Get grid columns (responsive)
  const gridColumns = gridConfig?.columns || 3;
  const maxItems = gridConfig?.maxItems || 9;

  return (
    <div className={`
      product-grid-message
      flex flex-col
      max-w-[85%]
      ${isOwnMessage
        ? 'bg-blue-50 rounded-tl-2xl rounded-bl-2xl rounded-br-2xl'
        : 'bg-gray-100 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'
      }
      p-3
    `}>
      {/* Optional text caption */}
      {message && (
        <p className="text-sm text-gray-800 mb-3 whitespace-pre-wrap">
          {message}
        </p>
      )}

      {/* Product Grid */}
      {productAttachments && productAttachments.length > 0 && (
        <div className={`
          grid gap-2
          grid-cols-2 sm:grid-cols-${gridColumns}
        `}>
          {productAttachments.slice(0, maxItems).map((product, index) => (
            <ProductGridCard
              key={product.productId || index}
              product={product}
            />
          ))}
        </div>
      )}

      {/* Timestamp */}
      <p className="text-xs text-gray-500 mt-2 text-right">
        {formatTime(timestamp)}
      </p>
    </div>
  );
}
