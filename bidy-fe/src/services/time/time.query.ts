'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { fetchServerTime } from './time.fetcher';

export const timeKeys = {
  all: ['time'] as const,
  current: () => [...timeKeys.all, 'current'] as const,
};

/**
 * Đồng hồ máy user có thể lệch hàng phút, nên mọi so sánh liên quan tới hạn
 * đấu giá phải dựa trên giờ server.
 *
 * Hook đo **offset** một lần (chênh lệch giữa giờ server và giờ máy) rồi cộng
 * offset đó vào `Date.now()` mỗi khi cần — không poll liên tục, và vẫn chạy
 * mượt giữa các lần refetch.
 *
 * Round-trip latency được bù bằng cách trừ đi nửa thời gian đi-về, giả định
 * đường truyền đối xứng — đủ chính xác cho countdown ở mức giây.
 */
export const useServerTime = () => {
  const { data: offset = 0, isPending } = useQuery({
    queryKey: timeKeys.current(),
    queryFn: async () => {
      const sentAt = Date.now();
      const response = await fetchServerTime();
      const receivedAt = Date.now();

      const roundTrip = receivedAt - sentAt;
      const clientAtServerStamp = sentAt + roundTrip / 2;

      return response.timestamp - clientAtServerStamp;
    },
    // Offset trôi rất chậm; đo lại mỗi 5 phút là quá đủ.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  /** Giờ server hiện tại (epoch ms). Rơi về giờ máy nếu chưa đo được offset. */
  const getServerNow = useCallback(() => Date.now() + offset, [offset]);

  return { getServerNow, offset, isPending };
};
