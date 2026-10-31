'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useState } from 'react';

/** Ảnh mặc định khi src hỏng hoặc rỗng. */
export const FALLBACK_IMAGE = '/images.jpeg';

export interface ImageWithFallbackProps extends Omit<ImageProps, 'src' | 'onError'> {
  src?: string | null;
  /** Ghi đè ảnh dự phòng cho từng chỗ nếu cần. */
  fallbackSrc?: string;
}

/**
 * `next/image` kèm fallback khi ảnh lỗi.
 *
 * Không dùng `onError={e => (e.target as HTMLImageElement).src = '...'}`:
 * cách đó chỉ đổi thuộc tính `src` trên DOM node, trong khi `next/image` vẫn
 * giữ `srcSet` trỏ tới URL hỏng — trình duyệt có thể chọn lại ứng viên từ
 * `srcSet` và ảnh vỡ quay lại. Next cũng có thể ghi đè khi re-render.
 * Thay vào đó đổi src qua state để Next dựng lại cả `srcSet`.
 */
export function ImageWithFallback({
  src,
  fallbackSrc = FALLBACK_IMAGE,
  alt,
  ...props
}: ImageWithFallbackProps) {
  const initial = src && src.trim() ? src : fallbackSrc;
  const [currentSrc, setCurrentSrc] = useState(initial);

  // Đổi item (ví dụ list được filter lại) thì phải thử lại ảnh mới.
  useEffect(() => {
    setCurrentSrc(initial);
  }, [initial]);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
      }}
    />
  );
}

export default ImageWithFallback;
