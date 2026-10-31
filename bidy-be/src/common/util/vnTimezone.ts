import moment from 'moment-timezone';

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Vietnam timezone helpers for the auction timing system.
 * Every date the scheduler and websocket layers reason about is normalised to
 * Vietnam time (UTC+7) here so comparisons never depend on the host timezone.
 */
export class VNTimeUtils {
  /** Current time in Vietnam timezone. */
  static getCurrentVNTime(): moment.Moment {
    return moment().tz(VN_TIMEZONE);
  }

  /** Any date reinterpreted in Vietnam timezone. */
  static convertToVNTime(date: Date | string | moment.Moment): moment.Moment {
    return moment(date).tz(VN_TIMEZONE);
  }

  /** Milliseconds until `endDate`; negative once it has passed. */
  static calculateTimeRemaining(endDate: Date | string): number {
    return this.convertToVNTime(endDate).diff(this.getCurrentVNTime(), 'milliseconds');
  }

  /** Current Vietnam time plus a duration, as a plain Date. */
  static addToCurrentVNTime(amount: number, unit: moment.unitOfTime.DurationConstructor): Date {
    return this.getCurrentVNTime().add(amount, unit).toDate();
  }

  /** Vietnam's UTC offset, e.g. `+07:00`. */
  static getVNTimezoneOffset(): string {
    return this.getCurrentVNTime().format('Z');
  }

  /** `HH:mm:ss`, or `X ngày HH:mm:ss` once a full day remains. */
  static formatTimeRemaining(milliseconds: number): string {
    if (milliseconds <= 0) return '00:00:00';

    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const clock = [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');

    return days > 0 ? `${days} ngày ${clock}` : clock;
  }

  /** End date for an auction that runs `durationDays` from `startDate`. */
  static createEndDateFromDuration(startDate: Date | string, durationDays: number): Date {
    return this.convertToVNTime(startDate).add(durationDays, 'days').toDate();
  }
}

export default VNTimeUtils;
