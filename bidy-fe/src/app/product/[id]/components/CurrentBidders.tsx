'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Crown, Eye, Flame, Gavel, Tag, Users } from 'lucide-react';
import { STATUS_AUCTIONS, WEBSOCKET_EVENTS } from '@/constants/app.enum';
import { useAuctionWebSocket } from '@/hooks/useAuctionWebSocket';
import { useAuctionBidders, mapAuctionBidders, type AuctionBidders, type BidderUpdatePayload } from '@/services/bid';

interface CurrentBiddersProps {
  auctionId: string;
  auctionStatus: STATUS_AUCTIONS;
  formatCurrency: (amount: number) => string;
}

const MAX_VISIBLE = 8;

export default function CurrentBidders({
  auctionId,
  auctionStatus,
  formatCurrency
}: Readonly<CurrentBiddersProps>) {
  const { bidders: snapshot, isLoading } = useAuctionBidders(auctionId, auctionStatus);
  const [live, setLive] = useState<AuctionBidders | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Use auction-specific hook that auto-joins rooms
  const { socket, isConnected, isJoined } = useAuctionWebSocket(auctionId, {
    autoJoin: auctionStatus === STATUS_AUCTIONS.HAPPENING,
    rejoinOnReconnect: true
  });

  useEffect(() => {
    setLive(null);
    setLastUpdated('');
  }, [auctionId]);

  // Listen for real-time bidder updates - only when joined to auction room
  useEffect(() => {
    if (!socket || !isConnected || !isJoined || auctionStatus !== STATUS_AUCTIONS.HAPPENING) {
      return;
    }

    const handleUpdate = (data: { auctionId?: string } & BidderUpdatePayload) => {
      if (data?.auctionId !== auctionId) return;
      setLive(mapAuctionBidders(data));
      setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
    };

    // Snapshot lúc join room cũng bắn `bidderUpdate`; `currentBidderStats` đã bị backend bỏ.
    socket.on(WEBSOCKET_EVENTS.BIDDER_UPDATE, handleUpdate);

    return () => {
      socket.off(WEBSOCKET_EVENTS.BIDDER_UPDATE, handleUpdate);
    };
  }, [socket, isConnected, isJoined, auctionId, auctionStatus]);

  if (auctionStatus !== STATUS_AUCTIONS.HAPPENING || isLoading) {
    return null;
  }

  const data = live ?? snapshot;
  const visible = data.bidders.slice(0, MAX_VISIBLE);
  const totalBidders = data.totalBidders;

  const header = (
    <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-foreground-secondary" />
        <h2 className="text-xs uppercase tracking-widest font-semibold text-foreground-secondary">
          Người đấu giá hiện tại
        </h2>
      </div>
      <span className="flex items-center gap-3 text-xs">
        {data.watcherCount > 0 && (
          <span className="flex items-center gap-1 text-foreground-secondary">
            <Eye size={14} />
            {data.watcherCount} đang xem
          </span>
        )}
        {totalBidders > 0 ? (
          <span className="flex items-center gap-1 font-semibold text-destructive">
            <Flame size={14} />
            {totalBidders} đã đặt giá
          </span>
        ) : (
          <span className="text-foreground-secondary">Chưa có người tham gia</span>
        )}
      </span>
    </div>
  );

  if (totalBidders === 0) {
    return (
      <div className="flex flex-col gap-4 w-full">
        {header}
        <div className="flex flex-col items-center gap-3 py-8 border border-border bg-background">
          <Tag className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-foreground-secondary text-center px-4">
            Hãy là người đầu tiên đặt giá cho sản phẩm này!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {header}

      {lastUpdated && (
        <span className="text-xs text-foreground-secondary -mt-2">
          Cập nhật lúc {lastUpdated}
        </span>
      )}

      {/* `layout` + key theo userId: khi thứ hạng đổi, hàng tự trượt lên vị trí mới */}
      <div className="flex flex-col border border-border bg-background divide-y divide-border">
        <AnimatePresence initial={false}>
          {visible.map((bidder) => {
            const isLeader = bidder.rank === 1;
            const isLastBidder = data.lastBid?.userId === bidder.userId;

            return (
              <motion.div
                key={bidder.userId}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className={`flex items-center gap-3 p-3 ${
                  isLastBidder && !data.lastBid?.isAuto ? 'bg-accent-subtle' : ''
                }`}
              >
                {/* Rank */}
                <span
                  className={`w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isLeader
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {bidder.rank}
                </span>

                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <Image
                    src="/images.jpeg"
                    alt={bidder.userName}
                    width={36}
                    height={36}
                    className="rounded-full object-cover w-9 h-9"
                  />
                  {isLeader && (
                    <Crown
                      size={14}
                      className="absolute -bottom-1 -right-1 text-warning fill-warning"
                    />
                  )}
                </div>

                {/* Bidder Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm truncate">
                      {bidder.userName}
                    </span>
                    {isLeader && (
                      <span className="text-xs px-1.5 py-0.5 bg-success text-success-foreground font-medium flex-shrink-0">
                        Dẫn đầu
                      </span>
                    )}
                    {isLastBidder && data.lastBid?.isAuto && (
                      <span
                        className="flex items-center gap-1 text-xs px-1.5 py-0.5 bg-accent-subtle text-accent-foreground font-medium flex-shrink-0"
                        title="Hệ thống tự đặt giá thay người này"
                      >
                        <Bot size={11} />
                        Tự động
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-xs text-foreground-secondary">
                    <Gavel size={12} />
                    {bidder.bidCount} lần đấu giá
                  </span>
                </div>

                {/* Bid Amount — nhấp nháy khi chính người này vừa bid */}
                <motion.span
                  key={`${bidder.userId}-${bidder.highestAmount}`}
                  initial={{ scale: 1.25, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className={`text-sm font-bold text-right ${
                    isLeader ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {formatCurrency(bidder.highestAmount)}
                </motion.span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Backend báo bằng cờ `truncated`, không tự so độ dài mảng */}
      {data.truncated && (
        <span className="flex items-center gap-2 text-xs text-foreground-secondary">
          <Users size={14} />
          +{Math.max(totalBidders - visible.length, 0)} người khác đang tham gia
        </span>
      )}

      {/* Activity Indicator */}
      <div className="flex items-center gap-2 text-xs text-foreground-secondary pt-3 border-t border-border">
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected && isJoined ? 'bg-success animate-pulse' : 'bg-warning'
          }`}
        />
        <span>
          {isConnected && isJoined
            ? 'Đấu giá đang diễn ra — Cập nhật trực tiếp'
            : 'Đấu giá đang diễn ra — Đang kết nối...'}
        </span>
      </div>
    </div>
  );
}
