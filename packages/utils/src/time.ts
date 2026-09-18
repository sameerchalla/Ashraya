/**
 * Ashraya Utils — IST Time & Shift Window Mathematics
 * Spec 3.architecture.md §2 & 1.prd.md F2-5
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

export interface ShiftWindow {
  startTime: string; // "06:30:00"
  endTime: string;   // "13:00:00"
  crossesMidnight: boolean;
  startDateTime: Date;
  endDateTime: Date;
}

/**
 * Returns current Date adjusted in Indian Standard Time (UTC+5:30)
 */
export function getNowIST(): Date {
  return new Date();
}

/**
 * Formats a Date object to YYYY-MM-DD in IST
 */
export function formatISTDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formats time in IST (e.g. "06:30 AM")
 */
export function formatISTTime(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Parses time string (HH:MM:SS or HH:MM) into minutes from midnight
 */
export function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Calculates start and end timestamps for a shift on a specific shift date,
 * correctly handling cross-midnight shifts (e.g. Night Shift 23:00 to 06:30 next day).
 */
export function calculateShiftWindow(
  shiftDateStr: string, // YYYY-MM-DD
  startTimeStr: string, // HH:MM:SS
  endTimeStr: string    // HH:MM:SS
): ShiftWindow {
  const startMins = timeToMinutes(startTimeStr);
  const endMins = timeToMinutes(endTimeStr);
  const crossesMidnight = endMins <= startMins;

  // Base ISO for start date
  const startDateTime = new Date(`${shiftDateStr}T${startTimeStr.slice(0, 5)}:00+05:30`);

  let endDateTime: Date;
  if (!crossesMidnight) {
    endDateTime = new Date(`${shiftDateStr}T${endTimeStr.slice(0, 5)}:00+05:30`);
  } else {
    // Add 1 calendar day for end time
    const [y, m, d] = shiftDateStr.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
    const nextDateStr = nextDate.toISOString().slice(0, 10);
    endDateTime = new Date(`${nextDateStr}T${endTimeStr.slice(0, 5)}:00+05:30`);
  }

  return {
    startTime: startTimeStr,
    endTime: endTimeStr,
    crossesMidnight,
    startDateTime,
    endDateTime,
  };
}

/**
 * Checks if current time is within a shift window (including pre-entry grace)
 */
export function isWithinShiftWindow(
  window: ShiftWindow,
  now: Date = new Date(),
  preEntryMinutes = 15,
  lateLockoutHours = 4
): { isAllowed: boolean; reason?: string } {
  const preEntryStart = new Date(window.startDateTime.getTime() - preEntryMinutes * 60 * 1000);
  const lateLockout = new Date(window.startDateTime.getTime() + lateLockoutHours * 60 * 60 * 1000);

  if (now < preEntryStart) {
    return {
      isAllowed: false,
      reason: `Shift starts at ${window.startTime.slice(0, 5)}. Entry allowed ${preEntryMinutes} min before.`,
    };
  }

  if (now > window.endDateTime) {
    return {
      isAllowed: false,
      reason: `Shift ended at ${window.endTime.slice(0, 5)}.`,
    };
  }

  if (now > lateLockout) {
    return {
      isAllowed: false,
      reason: `Late entry lockout passed (over ${lateLockoutHours} hours into shift).`,
    };
  }

  return { isAllowed: true };
}

/**
 * Calculates days remaining until target date
 */
export function getDaysRemaining(validTillDateStr: string): number {
  const now = new Date();
  const todayStr = formatISTDate(now);
  const today = new Date(`${todayStr}T00:00:00+05:30`).getTime();
  const target = new Date(`${validTillDateStr}T00:00:00+05:30`).getTime();
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Returns current hours and minutes in IST
 */
export function getISTHoursAndMinutes(date: Date = new Date()): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return { hours, minutes };
}
