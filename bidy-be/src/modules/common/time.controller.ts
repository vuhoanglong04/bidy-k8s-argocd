import { Request, Response } from 'express';
import VNTimeUtils from '../../common/util/vnTimezone.js';

/**
 * Get current server time in VN timezone
 * Used for client-server time synchronization
 */
export const getCurrentTime = (_req: Request, res: Response) => {
  try {
    const vnTime = VNTimeUtils.getCurrentVNTime();

    res.status(200).json({
      success: true,
      vnTime: vnTime.toISOString(),
      vnTimeFormatted: vnTime.format('YYYY-MM-DD HH:mm:ss'),
      timezone: 'Asia/Ho_Chi_Minh',
      offset: VNTimeUtils.getVNTimezoneOffset(),
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Error getting current time:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get server time',
      error: error.message,
    });
  }
};

export default {
  getCurrentTime,
};