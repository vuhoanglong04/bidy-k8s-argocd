import axiosClient from '@/lib/axios-client';

/**
 * `GET /api/v1/time/current` — lưu ý envelope dùng `success`, không phải
 * `status` như các endpoint khác.
 */
export interface ServerTimeResponse {
  success: boolean;
  /** ISO string giờ Việt Nam. */
  vnTime: string;
  vnTimeFormatted: string;
  timezone: string;
  offset: string;
  /** Epoch milliseconds — đây là giá trị dùng để tính offset. */
  timestamp: number;
}

export const fetchServerTime = async (): Promise<ServerTimeResponse> => {
  const { data } = await axiosClient.get<ServerTimeResponse>('/time/current');
  return data;
};
