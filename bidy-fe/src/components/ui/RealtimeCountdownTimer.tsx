"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useWebSocketCore } from "@/hooks";
import { cn } from "@/lib/utils";
import { VNTimeUtils } from "@/utils/vnTimezone";
import logger from "@/utils/logger";

export interface AuctionState {
  state: "upcoming" | "happening" | "ended";
  displayText: string;
  timeRemaining: string;
  progress: number; // 0-100 percentage of auction progress
  lastSyncTime?: Date;
  serverTime?: Date;
}

interface RealtimeCountdownTimerProps {
  auctionId: string;
  startDate: string | Date;
  endDate?: string | Date;
  finishedTime?: string | Date; // Backward compatibility
  /** Trạng thái phiên từ backend ('pending' | 'happening' | 'ended' | 'cancelled') */
  status?: string;
  className?: string;
  onStateChange?: (state: AuctionState) => void;
  syncInterval?: number; // Milliseconds for server time sync
  variant?: 'default' | 'compact'; // New variant prop for different display styles
  position?: 'center' | 'top-right'; // Position prop for flexible placement
}

interface TimeSegments {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Tách chuỗi "HH:MM:SS" hoặc "N ngày HH:MM:SS" thành từng cụm số để render
 * theo phong cách 7-segment. Không thay đổi logic tính giờ, chỉ đọc lại kết quả.
 */
function parseTimeSegments(timeRemaining: string): TimeSegments {
  const dayMatch = /(\d+)\s*ngày/.exec(timeRemaining);
  const clockMatch = /(\d{1,2}):(\d{2}):(\d{2})/.exec(timeRemaining);

  return {
    days: dayMatch ? Number(dayMatch[1]) : 0,
    hours: clockMatch ? Number(clockMatch[1]) : 0,
    minutes: clockMatch ? Number(clockMatch[2]) : 0,
    seconds: clockMatch ? Number(clockMatch[3]) : 0,
  };
}

const SEGMENTS: Record<string, string> = {
  a: "9,7 14,2 46,2 51,7 46,12 14,12",
  b: "53,9 58,14 58,43 53,48 48,43 48,14",
  c: "53,52 58,57 58,86 53,91 48,86 48,57",
  d: "9,93 14,88 46,88 51,93 46,98 14,98",
  e: "7,52 12,57 12,86 7,91 2,86 2,57",
  f: "7,9 12,14 12,43 7,48 2,43 2,14",
  g: "9,50 14,45 46,45 51,50 46,55 14,55",
};

const ALL_SEGMENTS = ["a", "b", "c", "d", "e", "f", "g"] as const;

const DIGIT_SEGMENTS: Record<number, readonly string[]> = {
  0: ["a", "b", "c", "d", "e", "f"],
  1: ["b", "c"],
  2: ["a", "b", "g", "e", "d"],
  3: ["a", "b", "g", "c", "d"],
  4: ["f", "g", "b", "c"],
  5: ["a", "f", "g", "c", "d"],
  6: ["a", "f", "g", "e", "d", "c"],
  7: ["a", "b", "c"],
  8: ["a", "b", "c", "d", "e", "f", "g"],
  9: ["a", "b", "c", "d", "f", "g"],
};

/**
 * Một chữ số LCD 7-segment vẽ bằng SVG polygon thật.
 * Gồm lớp nét tắt (ghost) mờ phía sau và lớp nét sáng có drop-shadow glow phía trước.
 */
const SevenSegmentDigit = memo(function SevenSegmentDigit({
  digit,
  className,
}: {
  digit: number;
  className?: string;
}) {
  const activeKeys = DIGIT_SEGMENTS[digit] ?? [];

  return (
    <svg
      viewBox="0 0 60 100"
      aria-hidden="true"
      className={cn("h-full w-auto", className)}
      style={{ transform: "skewX(-6deg)" }}
    >
      {/* Nét tắt (ghost, giống LED thật) */}
      <g className="fill-current opacity-10 dark:opacity-[0.08]">
        {ALL_SEGMENTS.map((seg) => (
          <polygon key={seg} points={SEGMENTS[seg]} />
        ))}
      </g>
      {/* Nét sáng */}
      <g className="dark:[filter:drop-shadow(0_0_3px_currentColor)]">
        {activeKeys.map((seg) => (
          <polygon key={seg} points={SEGMENTS[seg]} className="fill-current" />
        ))}
      </g>
    </svg>
  );
});

/**
 * Một nhóm chữ số 7-segment (ví dụ: giờ, phút, giây hoặc ngày).
 */
const SegmentGroup = memo(function SegmentGroup({
  value,
  minDigits = 2,
  label,
  digitClass,
  heightClass,
}: {
  value: number;
  minDigits?: number;
  label?: string;
  digitClass: string;
  heightClass: string;
}) {
  const digits = String(value).padStart(minDigits, "0").split("").map(Number);

  return (
    <div className="flex flex-col items-center">
      <div className={cn("flex items-center gap-[3px]", heightClass, digitClass)}>
        {digits.map((digit, idx) => (
          <SevenSegmentDigit key={idx} digit={digit} />
        ))}
      </div>
      {label && (
        <span className="mt-1 text-[9px] uppercase tracking-[0.2em] text-lcd-label font-digital">
          {label}
        </span>
      )}
    </div>
  );
});

/**
 * Dấu hai chấm dạng 2 ô vuông SVG nhấp nháy giữa các cụm số.
 */
const SegmentColon = memo(function SegmentColon({
  digitClass,
  heightClass,
  spaced = false,
}: {
  digitClass: string;
  heightClass: string;
  spaced?: boolean;
}) {
  return (
    <div className="flex flex-col items-center" aria-hidden="true">
      <div className={cn("flex items-center", heightClass, digitClass)}>
        <svg
          viewBox="0 0 12 100"
          aria-hidden="true"
          className="h-full w-auto dark:[filter:drop-shadow(0_0_3px_currentColor)]"
        >
          <rect x="0" y="28" width="12" height="12" className="fill-current" />
          <rect x="0" y="66" width="12" height="12" className="fill-current" />
        </svg>
      </div>
      {/* Giữ chỗ ngang hàng với nhãn của các cụm số */}
      {spaced && <span className="mt-1 text-[9px] tracking-[0.2em] opacity-0">--</span>}
    </div>
  );
});

export default function RealtimeCountdownTimer({
  auctionId,
  startDate,
  endDate,
  finishedTime,
  status,
  className = "",
  onStateChange,
  syncInterval = 30000, // Sync with server every 30 seconds
  variant = 'default',
  position = 'center',
}: RealtimeCountdownTimerProps) {
  const webSocket = useWebSocketCore();
  
  const [auctionState, setAuctionState] = useState<AuctionState>({
    state: "upcoming",
    displayText: "Sắp bắt đầu",
    timeRemaining: "00:00:00",
    progress: 0,
  });

  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);

  // Ảnh chụp state đã render gần nhất, dùng để bỏ qua tick không đổi gì
  const lastRenderedRef = useRef<AuctionState | null>(null);

  // Extract auction updates for this specific auction
  const latestAuctionUpdate = webSocket.auctionUpdates?.find(
    (u) => String(u.auctionId) === String(auctionId)
  );
  
  // Get effective end time - memoized to prevent infinite loops
  const getEndTime = useCallback(() => {
    // Use WebSocket update if available
    if (latestAuctionUpdate?.endDate) {
      return new Date(latestAuctionUpdate.endDate);
    }
    
    // Fallback to props
    return new Date(endDate || finishedTime || new Date());
  }, [latestAuctionUpdate, endDate, finishedTime]);

  // Calculate auction state with server time synchronization
  const calculateAuctionState = useCallback((): AuctionState => {
    const now = new Date(Date.now() + serverTimeOffset);
    const start = new Date(startDate);
    const end = getEndTime();

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        state: "ended",
        displayText: "Thời gian không hợp lệ",
        timeRemaining: "00:00:00",
        progress: 100,
        lastSyncTime: new Date(),
        serverTime: now,
      };
    }

    const calculateProgress = (elapsed: number, total: number) => {
      return total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
    };

    const formatTimeRemaining = (milliseconds: number): string => {
      if (milliseconds <= 0) return "00:00:00";

      const totalSeconds = Math.floor(milliseconds / 1000);
      const days = Math.floor(totalSeconds / (24 * 3600));
      const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (days > 0) {
        return `${days} ngày ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      }
      
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    const nowTime = now.getTime();
    const startTime = start.getTime();
    const endTime = end.getTime();

    // Nguồn trạng thái theo thứ tự ưu tiên: latestAuctionUpdate?.status -> prop status -> suy từ thời gian
    const effectiveStatus = latestAuctionUpdate?.status ?? status;

    if (effectiveStatus === "pending") {
      if (startTime > nowTime) {
        const timeDiff = startTime - nowTime;
        return {
          state: "upcoming",
          displayText: "Sắp bắt đầu",
          timeRemaining: formatTimeRemaining(timeDiff),
          progress: 0,
          lastSyncTime: new Date(),
          serverTime: now,
        };
      }
      return {
        state: "upcoming",
        displayText: "Đang chờ mở phiên",
        timeRemaining: "00:00:00",
        progress: 0,
        lastSyncTime: new Date(),
        serverTime: now,
      };
    }

    if (effectiveStatus === "happening") {
      if (endTime > nowTime) {
        const timeDiff = endTime - nowTime;
        const totalDuration = endTime - startTime;
        const elapsed = nowTime - startTime;
        return {
          state: "happening",
          displayText: "Đang diễn ra",
          timeRemaining: formatTimeRemaining(timeDiff),
          progress: calculateProgress(elapsed, totalDuration),
          lastSyncTime: new Date(),
          serverTime: now,
        };
      }
      return {
        state: "happening",
        displayText: "Đang chốt phiên",
        timeRemaining: "00:00:00",
        progress: 100,
        lastSyncTime: new Date(),
        serverTime: now,
      };
    }

    if (effectiveStatus === "ended" || effectiveStatus === "cancelled") {
      return {
        state: "ended",
        displayText: effectiveStatus === "cancelled" ? "Đã huỷ" : "Đã kết thúc",
        timeRemaining: "00:00:00",
        progress: 100,
        lastSyncTime: new Date(),
        serverTime: now,
      };
    }

    // Không có status từ WS hoặc prop -> suy từ thời gian
    if (nowTime < startTime) {
      const timeDiff = startTime - nowTime;
      return {
        state: "upcoming",
        displayText: "Sắp bắt đầu",
        timeRemaining: formatTimeRemaining(timeDiff),
        progress: 0,
        lastSyncTime: new Date(),
        serverTime: now,
      };
    }

    if (nowTime < endTime) {
      const timeDiff = endTime - nowTime;
      const totalDuration = endTime - startTime;
      const elapsed = nowTime - startTime;
      return {
        state: "happening",
        displayText: "Đang diễn ra",
        timeRemaining: formatTimeRemaining(timeDiff),
        progress: calculateProgress(elapsed, totalDuration),
        lastSyncTime: new Date(),
        serverTime: now,
      };
    }

    return {
      state: "ended",
      displayText: "Đã kết thúc",
      timeRemaining: "00:00:00",
      progress: 100,
      lastSyncTime: new Date(),
      serverTime: now,
    };
  }, [startDate, getEndTime, serverTimeOffset, latestAuctionUpdate, status]);

  // Sync server time offset
  const syncServerTime = useCallback(async () => {
    try {
      const startTime = Date.now();
      const response = await fetch('/api/time/current');
      const endTime = Date.now();
      const roundTripTime = endTime - startTime;
      
      if (response.ok) {
        const data = await response.json();
        const serverTime = new Date(data.vnTime).getTime();
        const estimatedServerTime = serverTime + (roundTripTime / 2);
        const offset = estimatedServerTime - Date.now();
        
        setServerTimeOffset(offset);
        logger.info('Server time synchronized', { 
          offset: offset + 'ms', 
          roundTrip: roundTripTime + 'ms' 
        });
      }
    } catch (error) {
      logger.warn('Failed to sync server time:', { error: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  // Màu chữ số trên mặt LCD theo trạng thái phiên (dùng semantic token)
  const getStateColors = (state: AuctionState) => {
    switch (state.state) {
      case "upcoming":
        return { digit: "text-info" };
      case "happening": {
        // Đổi màu theo thời gian còn lại
        const segments = parseTimeSegments(state.timeRemaining);
        const totalHours = segments.days * 24 + segments.hours;

        if (totalHours < 1) {
          return { digit: "text-destructive" };
        }
        if (totalHours < 24) {
          return { digit: "text-lcd-warning" };
        }
        return { digit: "text-success" };
      }
      case "ended":
        return { digit: "text-lcd-label" };
      default:
        return { digit: "text-lcd-label" };
    }
  };

  // Update timer every second and handle WebSocket updates
  useEffect(() => {
    const updateTimer = () => {
      const newState = calculateAuctionState();

      // Chỉ set state khi phần hiển thị thật sự đổi. `lastSyncTime`/`serverTime`
      // đổi mỗi tick nhưng không lên màn hình, nên bỏ qua để tránh re-render thừa.
      const prev = lastRenderedRef.current;
      const changed =
        !prev ||
        prev.state !== newState.state ||
        prev.displayText !== newState.displayText ||
        prev.timeRemaining !== newState.timeRemaining ||
        Math.round(prev.progress * 10) !== Math.round(newState.progress * 10);

      if (!changed) return;

      lastRenderedRef.current = newState;
      setAuctionState(newState);

      // Notify parent component of state changes
      if (onStateChange) {
        onStateChange(newState);
      }
    };

    // Update immediately
    updateTimer();

    // Set up interval for updates
    const interval = setInterval(updateTimer, 1000);

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, [calculateAuctionState, onStateChange]);

  // Handle WebSocket auction updates
  useEffect(() => {
    if (latestAuctionUpdate) {
      logger.info('WebSocket auction update received', { update: latestAuctionUpdate });
      // Timer will automatically update with new data on next tick
    }
  }, [latestAuctionUpdate]);

  // Initial server time sync and periodic sync
  useEffect(() => {
    syncServerTime();
    
    const syncInterval_timer = setInterval(syncServerTime, syncInterval);
    
    return () => clearInterval(syncInterval_timer);
  }, [syncServerTime, syncInterval]);

  const colors = getStateColors(auctionState);
  const segments = parseTimeSegments(auctionState.timeRemaining);

  // Render compact variant for top-right positioning
  if (variant === 'compact') {
    const positionClasses = position === 'top-right'
      ? 'absolute top-4 right-4 z-[5]'
      : '';

    return (
      <div className={`${positionClasses} ${className}`}>
        {/* Vỏ ngoài (double border casing) */}
        <div className="inline-block bg-lcd-case border-2 border-lcd-case-edge p-1">
          {/* Mặt kính LCD */}
          <div className="flex items-center gap-2 bg-lcd-screen border border-lcd-screen-edge px-3 py-1.5">
            <span className="sr-only">
              {`${auctionState.displayText}: ${auctionState.timeRemaining}`}
            </span>

            {/* Chỉ báo kết nối realtime */}
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                webSocket.isConnected ? 'bg-success' : 'bg-destructive'
              }`}
              title={
                webSocket.isConnected
                  ? 'Kết nối thời gian thực'
                  : 'Kết nối thời gian thực bị gián đoạn'
              }
            />

            {/* Dãy chữ số 7-segment */}
            <div className="flex items-center gap-1">
              {segments.days > 0 && (
                <>
                  <SegmentGroup
                    value={segments.days}
                    digitClass={colors.digit}
                    heightClass="h-6"
                  />
                  <span className="text-[9px] uppercase tracking-widest text-lcd-label font-digital">
                    ngày
                  </span>
                </>
              )}
              <SegmentGroup
                value={segments.hours}
                digitClass={colors.digit}
                heightClass="h-6"
              />
              <SegmentColon digitClass={colors.digit} heightClass="h-6" />
              <SegmentGroup
                value={segments.minutes}
                digitClass={colors.digit}
                heightClass="h-6"
              />
              <SegmentColon digitClass={colors.digit} heightClass="h-6" />
              <SegmentGroup
                value={segments.seconds}
                digitClass={colors.digit}
                heightClass="h-6"
              />
            </div>

            <span className="text-[9px] uppercase tracking-[0.2em] text-lcd-label font-digital flex-shrink-0">
              {auctionState.displayText}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Default variant — mặt đồng hồ báo thức điện tử, khung viền đôi
  return (
    <div className={`bg-lcd-case border-2 border-lcd-case-edge p-2 ${className}`}>
      {/* Mặt kính LCD (viền trong) */}
      <div className="flex flex-col gap-3 bg-lcd-screen border border-lcd-screen-edge px-4 py-4">
        <span className="sr-only">
          {`${auctionState.displayText}: ${auctionState.timeRemaining}`}
        </span>

        {/* Thanh trạng thái trên mặt số */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-[0.25em] text-lcd-label font-digital">
            {auctionState.displayText}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                webSocket.isConnected ? 'bg-success' : 'bg-destructive'
              }`}
            />
            <span className="text-[10px] uppercase tracking-[0.2em] text-lcd-label font-digital">
              {webSocket.isConnected ? 'Live' : 'Offline'}
            </span>
          </span>
        </div>

        {/* Dãy chữ số 7-segment */}
        <div className="flex items-start justify-center gap-2">
          {segments.days > 0 && (
            <>
              <SegmentGroup
                value={segments.days}
                label="Ngày"
                digitClass={colors.digit}
                heightClass="h-12"
              />
              <SegmentColon digitClass={colors.digit} heightClass="h-12" spaced />
            </>
          )}
          <SegmentGroup
            value={segments.hours}
            label="Giờ"
            digitClass={colors.digit}
            heightClass="h-12"
          />
          <SegmentColon digitClass={colors.digit} heightClass="h-12" spaced />
          <SegmentGroup
            value={segments.minutes}
            label="Phút"
            digitClass={colors.digit}
            heightClass="h-12"
          />
          <SegmentColon digitClass={colors.digit} heightClass="h-12" spaced />
          <SegmentGroup
            value={segments.seconds}
            label="Giây"
            digitClass={colors.digit}
            heightClass="h-12"
          />
        </div>

        {/* Thanh tiến độ phiên đang diễn ra */}
        {auctionState.state === "happening" && (
          <div className="w-full h-1.5 bg-lcd-screen-edge">
            <div
              className={cn("h-full bg-current transition-[width] duration-1000", colors.digit)}
              style={{ width: `${auctionState.progress}%` }}
            />
          </div>
        )}

        {/* Mốc thời gian phụ */}
        {auctionState.state === "upcoming" && (
          <span className="text-[10px] tracking-widest text-lcd-label font-digital text-center">
            Bắt đầu: {VNTimeUtils.convertToVNTime(startDate).format("DD/MM/YYYY HH:mm")}
          </span>
        )}

        {auctionState.state === "ended" && (
          <span className="text-[10px] tracking-widest text-lcd-label font-digital text-center">
            Kết thúc: {VNTimeUtils.convertToVNTime(getEndTime()).format("DD/MM/YYYY HH:mm")}
          </span>
        )}

        {process.env.NODE_ENV === 'development' && auctionState.serverTime && (
          <span className="text-[10px] text-lcd-label opacity-60 font-digital text-center">
            Sync: {auctionState.lastSyncTime?.toLocaleTimeString()}
            {serverTimeOffset !== 0 && ` (${Math.round(serverTimeOffset)}ms)`}
          </span>
        )}
      </div>
    </div>
  );
}
