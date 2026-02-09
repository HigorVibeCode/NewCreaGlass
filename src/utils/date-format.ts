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
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
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

  const datePart = `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;

  if (time) {
    return `${datePart}, ${time}`;
  }

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${datePart}, ${hh}:${mm}`;
}

/**
 * Format a date as "7 Feb 2026, 14:30:05" (with seconds — useful for timestamps / logs).
 */
export function formatTimestamp(value: string | Date | undefined | null): string {
  const d = toDate(value);
  if (!d) return '—';

  const datePart = `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${datePart}, ${hh}:${mm}:${ss}`;
}

/**
 * Format only the time portion as "14:30".
 */
export function formatTime(value: string | Date | undefined | null): string {
  const d = toDate(value);
  if (!d) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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
  return WEEKDAYS[d.getDay()];
}
