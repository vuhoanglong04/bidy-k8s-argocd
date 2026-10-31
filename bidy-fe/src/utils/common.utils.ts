
export const getValidText = (text?: string | undefined) => {
  if (!text) return "";
  if (typeof text !== "string") return "";
  return text.trim();
};

export const getValidNumber = (num?: number | string | undefined) => {
  if (num === undefined || num === null) return 0;
  const numValue = typeof num === "string" ? parseFloat(num) : num;
  return isNaN(numValue) ? 0 : numValue;
};

export const secureRandom = () => {
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1); // Convert to 0-1 range
  }
  // Fallback for environments without crypto API
  return Math.random();
};

export const formatVietnameseRevenue = (revenue: number | string | undefined) => {
  const numRevenue = getValidNumber(revenue);
  if (numRevenue >= 1000000000) {
    return `${(numRevenue / 1000000000).toFixed(1)}B VNĐ`;
  } else if (numRevenue >= 1000000) {
    return `${(numRevenue / 1000000).toFixed(1)}M VNĐ`;
  } else if (numRevenue >= 1000) {
    return `${(numRevenue / 1000).toFixed(1)}K VNĐ`;
  }
  return `${numRevenue.toLocaleString()} VNĐ`;
};

export const formatVietnameseProductCount = (count: number | string | undefined) => {
  const numCount = getValidNumber(count);
  if (!numCount) return "0";
  if (numCount >= 1000000000) {
    return `${(numCount / 1000000000).toFixed(1)}B`;
  } else if (numCount >= 1000000) {
    return `${(numCount / 1000000).toFixed(1)}M`;
  } else if (numCount >= 1000) {
    return `${(numCount / 1000).toFixed(1)}K`;
  }
  return numCount.toLocaleString();
};

export const formatCurrency = (amount?: number | undefined) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(getValidNumber(amount));
};

export const getImageURL = (url?: string) => {
  if (!url) {
    return null; // Let the component handle default avatar
  }
  if (url?.startsWith("blob:")) {
    return url;
  }

  if (url?.startsWith("http") || url?.startsWith("/")) {
    return url;
  }

  // S3 key trần không còn ghép được: endpoint /images/:key đã bị xoá.
  return null;
};

/**
 * Parse an toàn về `Date`, trả `null` nếu không dùng được.
 *
 * Payload chat/support từ BE không đảm bảo có mốc thời gian (chat vừa tạo chưa
 * có tin nhắn nào) và openapi.d.ts không mô tả schema cho nhóm endpoint đó, nên
 * mọi chỗ format ngày của chat phải đi qua đây — `date-fns` ném "Invalid time
 * value" chứ không trả chuỗi rỗng.
 */
export const toValidDate = (value?: Date | string | number | null): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateTime = (dateParam: Date | string) => {
  const date = typeof dateParam === "string" ? new Date(dateParam) : dateParam;
  
  if (!date || isNaN(date.getTime())) {
    return "Invalid date";
  }

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  return new Intl.DateTimeFormat("vi-VN", options).format(date);
};

export function formatTimeDifference(date: Date | string): string {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const diffMs = targetDate.getTime() - now.getTime();
  
  if (diffMs < 0) {
    return "Đã kết thúc";
  }
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    return `${diffDays} ngày ${Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))} giờ`;
  } else if (diffHours > 0) {
    return `${diffHours} giờ ${Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))} phút`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} phút`;
  } else {
    return "Dưới 1 phút";
  }
}

/** Chuyển đổi chuỗi ISO sang định dạng YYYY-MM-DDTHH:mm cho input[type="datetime-local"]. */
export function toInputDateTime(isoString?: string | null): string {
  const d = toValidDate(isoString);
  if (!d) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Kiểm tra thời gian kết thúc có ở trong quá khứ không. */
export function isScheduleExpired(endDate?: string | null): boolean {
  const d = toValidDate(endDate);
  if (!d) return false;
  return d.getTime() <= Date.now();
}