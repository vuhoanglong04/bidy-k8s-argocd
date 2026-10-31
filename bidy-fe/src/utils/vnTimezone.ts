/**
 * Vietnam Timezone Utilities for Frontend
 * Ensures consistent VN timezone display across the application
 */

/**
 * Formats a date to Vietnam timezone string
 * This function ALWAYS shows time in Vietnam timezone regardless of browser/system timezone
 */
export const formatVNTime = (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
  const dateObj = new Date(date);
  
  // Force Vietnam timezone formatting
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };

  const finalOptions = { ...defaultOptions, ...options };
  
  // Force Vietnam timezone display
  return dateObj.toLocaleString("en-GB", finalOptions);
};

/**
 * Formats a date to Vietnam timezone with short format (without weekday)
 */
export const formatVNTimeShort = (date: Date | string | number): string => {
  return formatVNTime(date, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Formats a date to Vietnam timezone with user-friendly format
 */
export const formatVNTimeUserFriendly = (date: Date | string | number): string => {
  return formatVNTime(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

/**
 * Get current Vietnam time
 */
export const getCurrentVNTime = (): Date => {
  // Just return current time - if system is in VN timezone, it's already correct
  // If not, we rely on toLocaleString with timezone specification
  return new Date();
};

/**
 * Check if current time is in Vietnam timezone
 */
export const isVNTimezone = (): boolean => {
  const offset = new Date().getTimezoneOffset();
  return offset === -420; // GMT+7 = -420 minutes
};

/**
 * Convert any date to Vietnam timezone Date object
 */
export const toVNTimezone = (date: Date | string | number): Date => {
  // Just return the date - formatting will handle timezone display
  return new Date(date);
};

/**
 * Legacy VNTimeUtils object for backward compatibility
 */
export const VNTimeUtils = {
  formatVNTime,
  formatVNTimeShort,
  formatVNTimeUserFriendly,
  getCurrentVNTime,
  isVNTimezone,
  toVNTimezone,
  
  // Legacy methods that might be expected
  getCurrentVNTimeString: () => formatVNTime(new Date()),
  createVNDate: (dateInput: string | Date) => new Date(dateInput),
  createEndDateFromDuration: (startDate: Date, durationDays: number) => {
    return new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  },
  determineAuctionStatus: (startDate: Date | string, endDate: Date | string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (now < start) return "upcoming";
    if (now >= start && now < end) return "happening";
    return "ended";
  },
  
  // Convert to VN time with format method (like moment.js pattern)
  convertToVNTime: (date: Date | string | number) => {
    // Use the timezone-aware formatting directly instead of converting Date object
    const originalDate = new Date(date);
    
    return {
      format: (formatStr: string) => {
        // Get VN timezone values directly from toLocaleString
        const vnDateParts = originalDate.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }); // YYYY-MM-DD
        const vnTimeParts = originalDate.toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }); // HH:MM:SS
        
        const [year, month, day] = vnDateParts.split('-');
        const [hours, minutes, seconds] = vnTimeParts.split(':');
        
        return formatStr
          .replace('DD', day)
          .replace('MM', month)
          .replace('YYYY', year)
          .replace('HH', hours)
          .replace('mm', minutes)
          .replace('ss', seconds);
      }
    };
  }
};