/**
 * Ashraya Utils — Indian Locale Formatting & Parsers
 * Spec 2.design.md §2.3, §9
 */

/**
 * Formats a number with Indian grouping (e.g. 1,48,200)
 */
export function formatIndianNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Formats minutes into duration string like "4 h 12 m"
 */
export function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);

  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} m`;
  }
  if (hours > 0) {
    return `${hours} h`;
  }
  return `${minutes} m`;
}

/**
 * Formats Date string to standard format: "18 Oct 2026"
 */
export function formatDisplayDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Parses seat code (e.g. "A-12" or "F-04")
 */
export function parseSeatCode(code: string): { rowLetter: string; seatNum: number; isValid: boolean } {
  const match = code.trim().toUpperCase().match(/^([A-Z])-?(\d{1,3})$/);
  if (!match) {
    return { rowLetter: '', seatNum: 0, isValid: false };
  }
  return {
    rowLetter: match[1],
    seatNum: parseInt(match[2], 10),
    isValid: true,
  };
}

/**
 * Formats row and seat number into standard Ashraya seat code (e.g. row 1, col 12 -> "A-12")
 */
export function buildSeatCode(rowNumber: number, colNumber: number): string {
  const rowLetter = String.fromCharCode(64 + rowNumber);
  const seatNum = colNumber.toString().padStart(2, '0');
  return `${rowLetter}-${seatNum}`;
}
