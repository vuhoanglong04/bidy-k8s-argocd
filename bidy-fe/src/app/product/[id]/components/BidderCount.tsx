'use client';

import { useEffect, useState } from 'react';
import { Eye, Flame, Users } from 'lucide-react';
import { STATUS_AUCTIONS, WEBSOCKET_EVENTS } from '@/constants/app.enum';
import { useAuctionWebSocket } from '@/hooks/useAuctionWebSocket';
import { useAuctionBidders, mapAuctionBidders, type BidderUpdatePayload } from '@/services/bid';
import { Spinner } from '@/components/common/loading';

interface BidderCountProps {
  auctionId: string;
  auctionStatus: STATUS_AUCTIONS;
  initialCount?: number;
}

export default function BidderCount({
  auctionId,
  auctionStatus,
  initialCount = 0
}: Readonly<BidderCountProps>) {
  const { bidders, isLoading } = useAuctionBidders(auctionId, auctionStatus);
  const [live, setLive] = useState<{ totalBidders: number; watcherCount: number } | null>(null);

  // Use auction-specific hook that auto-joins rooms
  const { socket, isConnected, isJoined } = useAuctionWebSocket(auctionId, {
    autoJoin: auctionStatus === STATUS_AUCTIONS.HAPPENING,
    rejoinOnReconnect: true
  });

  // Snapshot REST là nguồn ban đầu; socket ghi đè khi có cập nhật
  useEffect(() => {
    setLive(null);
  }, [auctionId]);

  useEffect(() => {
    if (!socket || !isConnected || !isJoined || auctionStatus !== STATUS_AUCTIONS.HAPPENING) {
      return;
    }

    const handleUpdate = (data: { auctionId?: string } & BidderUpdatePayload) => {
      if (data?.auctionId !== auctionId) return;
      const mapped = mapAuctionBidders(data);
      setLive({ totalBidders: mapped.totalBidders, watcherCount: mapped.watcherCount });
    };

    // Snapshot lúc join room cũng bắn `bidderUpdate`; `currentBidderStats` đã bị backend bỏ.
    socket.on(WEBSOCKET_EVENTS.BIDDER_UPDATE, handleUpdate);

    return () => {
      socket.off(WEBSOCKET_EVENTS.BIDDER_UPDATE, handleUpdate);
    };
  }, [socket, isConnected, isJoined, auctionId, auctionStatus]);

  // Don't show for non-happening auctions
  if (auctionStatus !== STATUS_AUCTIONS.HAPPENING) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-border bg-muted">
        <Spinner size="xs" tone="muted" />
        <span className="text-sm text-muted-foreground">Đang tải...</span>
      </div>
    );
  }

  const bidderCount = live?.totalBidders ?? bidders.totalBidders ?? initialCount;
  const watcherCount = live?.watcherCount ?? bidders.watcherCount;

  // `watcherCount` đếm socket đang mở, dedupe theo user đã đăng nhập — hiểu là
  // "đang xem", không phải số người duy nhất. Chỉ đúng khi backend chạy 1 instance.
  const watcherBadge = watcherCount > 0 && (
    <span className="flex items-center gap-1 text-xs text-foreground-secondary">
      <Eye size={14} />
      {watcherCount} đang xem
    </span>
  );

  if (bidderCount === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-border bg-muted">
        <Users size={16} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Chưa có người tham gia</span>
        {watcherBadge && <span className="ml-auto">{watcherBadge}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border border-destructive/40 bg-destructive/10">
      <Flame size={16} className="text-destructive" />
      <span className="text-sm text-destructive">
        <strong className="font-bold">{bidderCount}</strong> người đã đặt giá
      </span>
      <span className="ml-auto flex items-center gap-2">
        {watcherBadge}
        {isConnected && isJoined && (
          <span
            className="w-2 h-2 rounded-full bg-success animate-pulse"
            title="Cập nhật trực tiếp"
          />
        )}
      </span>
    </div>
  );
}
