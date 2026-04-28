/**
 * Centralised date formatting for the Crea Glass app.
 *
 * All dates are displayed in the Swiss-multicultural format:
 *   day (number)  month (3-letter abbreviation)  year (number)
 *   Example: 7 Feb 2026
 *
 * When time is included:
 *   7 Feb 2026, 14:30
 */

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const SWISS_TIMEZONE = 'Europe/Zurich';

function getSwissDateParts(d: Date): { day: number; month: number; year: number } | null {
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SWISS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  return { day, month, year };
}

function getSwissTimeParts(d: Date): { hour: string; minute: string; second: string } | null {
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SWISS_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const second = parts.find((p) => p.type === 'second')?.value;
  if (!hour || !minute || !second) return null;
  return { hour, minute, second };
}

/**
 * Parse a value into a Date object.
 * Accepts Date, ISO string, or "YYYY-MM-DD" strings.
 * Returns null if the value cannot be parsed.
 */
function toDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  // "YYYY-MM-DD" without time – append T00:00:00 so it is not interpreted as UTC midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date as "7 Feb 2026".
 */
export function formatDate(value: string | Date | undefined | null): string {
  const d = toDate(value);
  if (!d) return '—';
  const parts = getSwissDateParts(d);
  if (!parts) return '—';
  return `${parts.day} ${MONTH_ABBR[parts.month - 1]} ${parts.year}`;
}

/**
 * Format a date + time as "7 Feb 2026, 14:30".
 * If an optional separate time string is provided (e.g. "14:30"), it is used instead
 * of the time component of the date.
 */
export function formatDateTime(
  value: string | Date | undefined | null,
  time?: string,
): string {
  const d = toDate(value);
  if (!d) return '—';

  const dateParts = getSwissDateParts(d);
  if (!dateParts) return '—';
  const datePart = `${dateParts.day} ${MONTH_ABBR[dateParts.month - 1]} ${dateParts.year}`;

  if (time) {
    return `${datePart}, ${time}`;
  }

  const timeParts = getSwissTimeParts(d);
  if (!timeParts) return datePart;
  return `${datePart}, ${timeParts.hour}:${timeParts.minute}`;
}

/**
 * Format a date as "7 Feb 2026, 14:30:05" (with seconds — useful for timestamps / logs).
 */
export function formatTimestamp(value: string | Date | undefined | null): string {
  const d = toDate(value);
  if (!d) return '—';

  const dateParts = getSwissDateParts(d);
  const timeParts = getSwissTimeParts(d);
  if (!dateParts || !timeParts) return '—';
  const datePart = `${dateParts.day} ${MONTH_ABBR[dateParts.month - 1]} ${dateParts.year}`;
  return `${datePart}, ${timeParts.hour}:${timeParts.minute}:${timeParts.second}`;
}

/**
 * Format only the time portion as "14:30".
 */
export function formatTime(value: string | Date | undefined | null): string {
  const d = toDate(value);
  if (!d) return '—';
  const parts = getSwissTimeParts(d);
  if (!parts) return '—';
  return `${parts.hour}:${parts.minute}`;
}

/**
 * Format a date for the PDF report header: "7 Feb 2026".
 */
export function formatDateLabel(value: string | Date | undefined | null): string {
  return formatDate(value);
}

/**
 * Get a short weekday name (Mon, Tue, Wed, …).
 */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function formatWeekday(value: string | Date | undefined | null): string {
  const d = toDate(value);
  if (!d) return '—';
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: SWISS_TIMEZONE,
    weekday: 'short',
  }).format(d);
  return WEEKDAYS.includes(weekday) ? weekday : weekday.slice(0, 3);
}
