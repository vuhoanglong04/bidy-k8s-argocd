"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export interface ProductAttachment {
  productId: string;
  productTitle: string;
  productImage: string;
  currentPrice: number;
  bidStatus: 'active' | 'completed' | 'cancelled';
  productUrl: string;
}

interface ProductGridCardProps {
  product: ProductAttachment;
}

export default function ProductGridCard({ product }: ProductGridCardProps) {
  // Format Vietnamese currency
  const formatPrice = (price: number) => {
    return price.toLocaleString('vi-VN');
  };

  // Get status badge text and color
  const getStatusBadge = () => {
    if (product.bidStatus === 'completed') {
      return { text: 'Đã kết thúc', color: 'bg-gray-600' };
    }
    if (product.bidStatus === 'cancelled') {
      return { text: 'Đã hủy', color: 'bg-red-600' };
    }
    return null;
  };

  const statusBadge = getStatusBadge();

  return (
    <Link href={product.productUrl} className="block">
      <div className="
        bg-white rounded-lg overflow-hidden
        border border-gray-200
        hover:shadow-md hover:border-blue-500
        transition-all duration-200
        cursor-pointer
        aspect-square
        flex flex-col
      ">
        {/* Product Image - 2/3 of card height */}
        <div className="relative w-full h-2/3 bg-gray-100">
          <Image
            src={product.productImage}
            alt={product.productTitle}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            loading="lazy"
          />

          {/* Status Badge (only for non-active) */}
          {statusBadge && (
            <div className={`
              absolute top-1 right-1
              px-2 py-0.5 rounded-full
              text-xs font-medium text-white
              ${statusBadge.color}
            `}>
              {statusBadge.text}
            </div>
          )}
        </div>

        {/* Product Info - 1/3 of card height */}
        <div className="p-2 h-1/3 flex flex-col justify-between">
          {/* Title - Max 2 lines */}
          <h4 className="
            text-xs font-medium
            text-gray-800
            line-clamp-2
            leading-tight
            mb-1
          ">
            {product.productTitle}
          </h4>

          {/* Price - Prominent */}
          <p className="text-sm font-bold text-blue-600">
            {formatPrice(product.currentPrice)}đ
          </p>
        </div>
      </div>
    </Link>
  );
}
