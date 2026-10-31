"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWebSocketCore } from "./useWebSocketCore";
import { WEBSOCKET_EVENTS } from "@/constants/app.enum";

export interface WalletTopupSuccessPayload {
  transactionId?: string;
  walletId: string;
  amount: string | number;
}

/**
 * Lắng nghe sự kiện nạp tiền ví realtime (wallet:topup_success).
 * Tự động làm mới cache query ['wallet'] và gọi callback (nếu có).
 */
export const useWalletTopupListener = (
  callback?: (payload: WalletTopupSuccessPayload) => void
) => {
  const { socket } = useWebSocketCore();
  const queryClient = useQueryClient();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!socket) return;

    const handleTopupSuccess = (payload: WalletTopupSuccessPayload) => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      callbackRef.current?.(payload);
    };

    socket.on(WEBSOCKET_EVENTS.WALLET_TOPUP_SUCCESS, handleTopupSuccess);

    return () => {
      socket.off(WEBSOCKET_EVENTS.WALLET_TOPUP_SUCCESS, handleTopupSuccess);
    };
  }, [socket, queryClient]);
};
