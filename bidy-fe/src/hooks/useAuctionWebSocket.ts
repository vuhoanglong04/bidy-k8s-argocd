'use client';

import { useEffect, useState, useRef } from 'react';

import { WEBSOCKET_EVENTS } from '@/constants/app.enum';

import { useAuth } from './useAuth';
import { useWebSocketCore } from './useWebSocketCore';

interface AuctionWebSocketOptions {
  autoJoin?: boolean;
  rejoinOnReconnect?: boolean;
}


/**
 * Auction-specific WebSocket hook that restores the old functionality
 * Automatically joins/leaves auction rooms and handles auction-specific events
 */
export function useAuctionWebSocket(
  auctionId: string,
  options: AuctionWebSocketOptions = {}
) {
  const { autoJoin = true, rejoinOnReconnect = true } = options;
  const { socket, isConnected } = useWebSocketCore();
  const { user } = useAuth();
  const userId = user?._id;

  // Track join state to prevent duplicate joins
  const [isJoined, setIsJoined] = useState(false);
  const hasJoinedRef = useRef(false);
  const previousAuctionIdRef = useRef<string | null>(null);

  // Join auction room when socket connects
  useEffect(() => {
    if (!socket || !isConnected || !auctionId || !autoJoin) {
      return;
    }

    // Check if we need to join/rejoin
    const shouldJoin = !hasJoinedRef.current || 
                      (rejoinOnReconnect && previousAuctionIdRef.current !== auctionId);

    if (shouldJoin) {
      console.log(`🏛️ [useAuctionWebSocket] Joining auction room: ${auctionId}`);
      
      // BE: socket.on('joinAuction', ({ auctionId, userId })) -> room `auction_{id}`
      socket.emit(WEBSOCKET_EVENTS.JOIN_AUCTION, { auctionId, userId });

      hasJoinedRef.current = true;
      previousAuctionIdRef.current = auctionId;
      setIsJoined(true);
    }

    return () => {
      if (hasJoinedRef.current && auctionId) {
        console.log(`🏛️ [useAuctionWebSocket] Leaving auction room: ${auctionId}`);
        
        // BE: socket.on('leaveAuction', ({ auctionId }))
        socket.emit(WEBSOCKET_EVENTS.LEAVE_AUCTION, { auctionId });

        hasJoinedRef.current = false;
        setIsJoined(false);
      }
    };
  }, [socket, isConnected, auctionId, autoJoin, rejoinOnReconnect, userId]);

  // Handle reconnection
  useEffect(() => {
    if (!socket || !rejoinOnReconnect) return;

    const handleReconnect = () => {
      console.log('🏛️ [useAuctionWebSocket] WebSocket reconnected, preparing to rejoin...');
      hasJoinedRef.current = false; // Reset join state to trigger rejoin
    };

    socket.on('connect', handleReconnect);

    return () => {
      socket.off('connect', handleReconnect);
    };
  }, [socket, rejoinOnReconnect]);

  // Request current auction status after joining
  useEffect(() => {
    if (!socket || !isConnected || !isJoined || !auctionId) {
      return;
    }

    // Small delay to ensure room join is processed
    const timer = setTimeout(() => {
      console.log(`🏛️ [useAuctionWebSocket] Requesting current auction status for: ${auctionId}`);
      
      // BE bất đối xứng: requestAuctionStatus nhận object, requestBidderStats nhận string trần.
      socket.emit(WEBSOCKET_EVENTS.REQUEST_AUCTION_STATUS, { auctionId });
      socket.emit(WEBSOCKET_EVENTS.REQUEST_BIDDER_STATS, auctionId);
    }, 500);

    return () => clearTimeout(timer);
  }, [socket, isConnected, isJoined, auctionId]);

  return {
    socket,
    isConnected,
    isJoined,
    
    // Helper methods for manual control
    joinAuction: () => {
      if (socket && isConnected && auctionId) {
        socket.emit(WEBSOCKET_EVENTS.JOIN_AUCTION, { auctionId, userId });
      }
    },

    leaveAuction: () => {
      if (socket && auctionId) {
        socket.emit(WEBSOCKET_EVENTS.LEAVE_AUCTION, { auctionId });
      }
    },

    // Request fresh data
    requestAuctionStatus: () => {
      if (socket && auctionId) {
        socket.emit(WEBSOCKET_EVENTS.REQUEST_AUCTION_STATUS, { auctionId });
      }
    },

    requestBidderStats: () => {
      if (socket && auctionId) {
        socket.emit(WEBSOCKET_EVENTS.REQUEST_BIDDER_STATS, auctionId);
      }
    }
  };
}