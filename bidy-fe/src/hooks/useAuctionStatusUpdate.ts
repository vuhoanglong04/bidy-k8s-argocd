'use client';

import { useEffect, useRef } from 'react';
import { useWebSocketCore } from './useWebSocketCore';
import { WEBSOCKET_EVENTS } from '@/constants/app.enum';

export interface AuctionStatusUpdatePayload {
  auctionId: string;
  /** Backend chỉ phát 'happening' và 'ended', không bao giờ mang 'cancelled'. */
  status: 'happening' | 'ended';
  timestamp?: string;
}

/**
 * Lắng nghe cập nhật trạng thái phiên đấu giá realtime qua socket (auctionStatusUpdate).
 *
 * Client tự động vào room `auction_status_sync` ngay khi kết nối socket (không cần đăng nhập
 * hay emit joinRoom).
 * Không polling. Payload từ cron backend chỉ mang { auctionId, status, timestamp }, không có
 * giá hiện tại hay bidCount nên không dùng để patch cache trực tiếp.
 * Event không bao giờ mang 'cancelled', chỉ có 'happening' và 'ended'.
 */
export function useAuctionStatusUpdate(
  auctionId: string | undefined,
  onUpdate: (update: AuctionStatusUpdatePayload) => void
) {
  const { socket } = useWebSocketCore();
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!socket || !auctionId) return;

    const handleStatusUpdate = (data: unknown) => {
      if (typeof data !== 'object' || data === null) return;
      const raw = data as Record<string, unknown>;
      const updateAuctionId = raw.auctionId ?? raw.auction_id ?? raw.id;
      if (!updateAuctionId || String(updateAuctionId) !== String(auctionId)) return;

      const status = raw.status;
      if (status !== 'happening' && status !== 'ended') return;

      onUpdateRef.current?.({
        auctionId: String(updateAuctionId),
        status,
        timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : undefined,
      });
    };

    socket.on(WEBSOCKET_EVENTS.AUCTION_STATUS_UPDATE, handleStatusUpdate);

    return () => {
      socket.off(WEBSOCKET_EVENTS.AUCTION_STATUS_UPDATE, handleStatusUpdate);
    };
  }, [socket, auctionId]);
}

export default useAuctionStatusUpdate;
