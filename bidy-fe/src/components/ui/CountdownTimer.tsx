"use client";

import { useState, useEffect, useCallback } from "react";

export interface AuctionState {
  state: "upcoming" | "happening" | "ended";
  displayText: string;
  timeRemaining: string;
  progress: number; // 0-100 percentage of auction progress
}

interface CountdownTimerProps {
  startDate: string | Date;
  endDate?: string | Date; // New primary field
  finishedTime?: string | Date; // Keep for backward compatibility
  className?: string;
  onStateChange?: (state: AuctionState) => void;
}

export default function CountdownTimer({
  startDate,
  endDate,
  finishedTime,
  className = "",
  onStateChange,
}: CountdownTimerProps) {
  const [auctionState, setAuctionState] = useState<AuctionState>({
    state: "upcoming",
    displayText: "Sắp bắt đầu",
    timeRemaining: "00:00:00",
    progress: 0,
  });

  // Calculate auction state and time remaining
  const calculateAuctionState = useCallback((): AuctionState => {
    const now = new Date().getTime();
    const start = new Date(startDate).getTime();
    // Use endDate if available, fallback to finishedTime for backward compatibility
    const end = new Date(endDate || finishedTime || new Date()).getTime();

    // Validate dates
    if (isNaN(start) || isNaN(end)) {
      return {
        state: "ended",
        displayText: "Thời gian không hợp lệ",
        timeRemaining: "00:00:00",
        progress: 100,
      };
    }

    if (now < start) {
      // Auction hasn't started yet
      const timeDiff = start - now;
      const timeString = formatTimeRemaining(timeDiff);
      const totalDuration = end - start;
      const progress = totalDuration > 0 ? 0 : 0;

      return {
        state: "upcoming",
        displayText: "Sắp bắt đầu",
        timeRemaining: timeString,
        progress,
      };
    } else if (now >= start && now < end) {
      // Auction is happening
      const timeDiff = end - now;
      const timeString = formatTimeRemaining(timeDiff);
      const totalDuration = end - start;
      const elapsed = now - start;
      const progress = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 100;

      return {
        state: "happening",
        displayText: "Đang diễn ra",
        timeRemaining: timeString,
        progress,
      };
    } else {
      // Auction has ended
      return {
        state: "ended",
        displayText: "Đã kết thúc",
        timeRemaining: "00:00:00",
        progress: 100,
      };
    }
  }, [startDate, endDate, finishedTime]);

  // Format milliseconds into readable time string
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

  // Get color classes based on auction state
  const getStateColors = (state: AuctionState) => {
    switch (state.state) {
      case "upcoming":
        return {
          bg: "bg-blue-500",
          text: "text-white",
          border: "border-blue-500",
        };
      case "happening":
        // Change color based on time remaining
        const [hours] = state.timeRemaining.split(":").map(Number);
        if (hours < 1) {
          return {
            bg: "bg-red-500",
            text: "text-white",
            border: "border-red-500",
          };
        } else if (hours < 24) {
          return {
            bg: "bg-orange-500",
            text: "text-white", 
            border: "border-orange-500",
          };
        }
        return {
          bg: "bg-green-500",
          text: "text-white",
          border: "border-green-500",
        };
      case "ended":
        return {
          bg: "bg-gray-500",
          text: "text-white",
          border: "border-gray-500",
        };
      default:
        return {
          bg: "bg-gray-500",
          text: "text-white",
          border: "border-gray-500",
        };
    }
  };

  // Update timer every second
  useEffect(() => {
    const updateTimer = () => {
      const newState = calculateAuctionState();
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
  }, [startDate, endDate, finishedTime, onStateChange, calculateAuctionState]);

  const colors = getStateColors(auctionState);

  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 ${colors.bg} ${colors.border} ${className}`}>
      {/* Status Text */}
      <div className={`text-lg font-bold ${colors.text} mb-2`}>
        {auctionState.displayText}
      </div>
      
      {/* Time Remaining */}
      <div className={`text-2xl font-mono font-bold ${colors.text} mb-2`}>
        {auctionState.timeRemaining}
      </div>
      
      {/* Progress Bar (optional visual indicator) */}
      {auctionState.state === "happening" && (
        <div className="w-full bg-white bg-opacity-30 rounded-full h-2 mt-2">
          <div
            className="bg-white h-2 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${auctionState.progress}%` }}
          />
        </div>
      )}
      
      {/* Additional info for upcoming auctions */}
      {auctionState.state === "upcoming" && (
        <div className={`text-sm ${colors.text} opacity-80 mt-1 text-center`}>
          Thời gian bắt đầu: {new Date(startDate).toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh"
          })}
        </div>
      )}
      
      {/* Additional info for ended auctions */}
      {auctionState.state === "ended" && (
        <div className={`text-sm ${colors.text} opacity-80 mt-1 text-center`}>
          Đã kết thúc: {new Date(endDate || finishedTime || new Date()).toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh"
          })}
        </div>
      )}
    </div>
  );
}

// Export utility function for calculating state without component
export const calculateAuctionStateUtil = (
  startDate: string | Date,
  endDate?: string | Date,
  finishedTime?: string | Date
): AuctionState => {
  const now = new Date().getTime();
  const start = new Date(startDate).getTime();
  // Use endDate if available, fallback to finishedTime for backward compatibility
  const end = new Date(endDate || finishedTime || new Date()).getTime();

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

  if (isNaN(start) || isNaN(end)) {
    return {
      state: "ended",
      displayText: "Thời gian không hợp lệ",
      timeRemaining: "00:00:00",
      progress: 100,
    };
  }

  if (now < start) {
    const timeDiff = start - now;
    return {
      state: "upcoming",
      displayText: "Sắp bắt đầu",
      timeRemaining: formatTimeRemaining(timeDiff),
      progress: 0,
    };
  } else if (now >= start && now < end) {
    const timeDiff = end - now;
    const totalDuration = end - start;
    const elapsed = now - start;
    const progress = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 100;

    return {
      state: "happening",
      displayText: "Đang diễn ra",
      timeRemaining: formatTimeRemaining(timeDiff),
      progress,
    };
  } else {
    return {
      state: "ended",
      displayText: "Đã kết thúc",
      timeRemaining: "00:00:00",
      progress: 100,
    };
  }
};