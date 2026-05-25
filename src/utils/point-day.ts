import { TimeEntry, EntryType } from '../types';
import { getEffectiveRecordedAt } from './point-report-pdf';
import { formatTime as formatTimeSwiss } from './date-format';

export const SWISS_TIMEZONE = 'Europe/Zurich';
export const WORK_DAY_MS = 8 * 60 * 60 * 1000 + 30 * 60 * 1000; // 8h30
export const COFFEE_PAUSE_MS = 15 * 60 * 1000;
export const LUNCH_PAUSE_MS = 45 * 60 * 1000;
export const AUTO_LOCATION = 'Automático';

export type DayStatus = 'automatic' | 'adjusted' | 'pending' | 'none';

export interface DayAdjustTimes {
  clockIn: string;
  clockOut: string;
  coffeeStart: string;
  coffeeEnd: string;
  lunchStart: string;
  lunchEnd: string;
}

export const DEFAULT_DAY_TIMES: DayAdjustTimes = {
  clockIn: '07:30',
  clockOut: '17:00',
  coffeeStart: '09:00',
  coffeeEnd: '09:15',
  lunchStart: '12:15',
  lunchEnd: '13:00',
};

export const DAY_ADJUST_ENTRY_TYPES: EntryType[] = [
  'clock_in',
  'clock_out',
  'coffee_start',
  'coffee_end',
  'lunch_start',
  'lunch_end',
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toSwissDateKeyFromDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SWISS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

export function toDateKey(iso: string): string {
  return toSwissDateKeyFromDate(new Date(iso));
}

export function isWeekend(dateKey: string): boolean {
  const d = new Date(`${dateKey}T12:00:00`);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

export function weekdayShort(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return WEEKDAY_SHORT[d.getDay()] || '';
}

/** Converte YYYY-MM-DD + HH:MM para ISO (mesma base de data do dia) */
export function buildIsoFromDateAndTime(dateKey: string, timeStr: string): string {
  const base = new Date(`${dateKey}T12:00:00`);
  const [h, min] = timeStr.split(':').map(Number);
  base.setHours(h ?? 0, min ?? 0, 0, 0);
  return base.toISOString();
}

function parseTimeToMs(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h ?? 0) * 3600000 + (m ?? 0) * 60000;
}

/** Jornada líquida em ms (entrada→saída menos pausas) */
export function computeNetWorkMs(times: DayAdjustTimes): number {
  return (
    parseTimeToMs(times.clockOut) -
    parseTimeToMs(times.clockIn) -
    (parseTimeToMs(times.coffeeEnd) - parseTimeToMs(times.coffeeStart)) -
    (parseTimeToMs(times.lunchEnd) - parseTimeToMs(times.lunchStart))
  );
}

function isValidHm(time: string): boolean {
  return /^\d{2}:\d{2}$/.test(time);
}

export type DayAdjustValidationError =
  | 'invalidTime'
  | 'clockOutBeforeIn'
  | 'coffeeInvalid'
  | 'lunchInvalid'
  | 'workDurationZero';

/** Valida ordem dos horários; permite jornada > 8h30 (hora extra) */
export function validateDayAdjustTimes(times: DayAdjustTimes): {
  valid: boolean;
  error?: DayAdjustValidationError;
} {
  const fields = Object.values(times);
  if (!fields.every(isValidHm)) {
    return { valid: false, error: 'invalidTime' };
  }

  if (parseTimeToMs(times.clockOut) <= parseTimeToMs(times.clockIn)) {
    return { valid: false, error: 'clockOutBeforeIn' };
  }
  if (parseTimeToMs(times.coffeeEnd) <= parseTimeToMs(times.coffeeStart)) {
    return { valid: false, error: 'coffeeInvalid' };
  }
  if (parseTimeToMs(times.lunchEnd) <= parseTimeToMs(times.lunchStart)) {
    return { valid: false, error: 'lunchInvalid' };
  }

  if (computeNetWorkMs(times) <= 0) {
    return { valid: false, error: 'workDurationZero' };
  }

  return { valid: true };
}

/** @deprecated use validateDayAdjustTimes — mantido por compatibilidade */
export function validateWorkDuration(times: DayAdjustTimes): boolean {
  return validateDayAdjustTimes(times).valid;
}

/** Dia já passou pelo fluxo de ajuste em lote (1x por dia) */
export function hasCompletedDayAdjustment(entries: (TimeEntry | null)[]): boolean {
  return entries.some(
    (e) =>
      e?.isAdjusted === true &&
      typeof e.adjustDescription === 'string' &&
      e.adjustDescription.trim().length > 0
  );
}

/** @deprecated use hasCompletedDayAdjustment */
export function hasDayAdjustment(entries: (TimeEntry | null)[]): boolean {
  return hasCompletedDayAdjustment(entries);
}

export function entriesForDateKey(allEntries: TimeEntry[], userId: string, dateKey: string): TimeEntry[] {
  return allEntries.filter((e) => {
    if (e.userId !== userId) return false;
    const effKey = toDateKey(getEffectiveRecordedAt(e));
    const origKey = toDateKey(e.recordedAt);
    return effKey === dateKey || origKey === dateKey;
  });
}

export function getDayStatus(
  dateKey: string,
  clockIn: TimeEntry | null,
  entries: (TimeEntry | null)[],
  isAutomatic: boolean
): DayStatus {
  if (!clockIn) return 'pending';
  if (hasCompletedDayAdjustment(entries)) return 'adjusted';
  if (isAutomatic) return 'automatic';
  return 'none';
}

function toHmFromEntry(e: TimeEntry | null, fallback: string): string {
  if (!e) return fallback;
  const hm = formatTimeSwiss(getEffectiveRecordedAt(e));
  return hm !== '—' ? hm : fallback;
}

/** Fim de pausa inferido (início + duração) quando só existe coffee_start / lunch_start */
function inferredPauseEndHm(
  startEntry: TimeEntry | null,
  durationMs: number,
  fallbackEnd: string
): string {
  if (!startEntry) return fallbackEnd;
  const startIso = getEffectiveRecordedAt(startEntry);
  const endIso = new Date(new Date(startIso).getTime() + durationMs).toISOString();
  const hm = formatTimeSwiss(endIso);
  return hm !== '—' ? hm : fallbackEnd;
}

export function timesFromDayEntries(
  clockIn: TimeEntry | null,
  clockOut: TimeEntry | null,
  coffeeStart: TimeEntry | null,
  coffeeEnd: TimeEntry | null,
  lunchStart: TimeEntry | null,
  lunchEnd: TimeEntry | null
): DayAdjustTimes {
  const coffeeStartHm = toHmFromEntry(coffeeStart, DEFAULT_DAY_TIMES.coffeeStart);
  const lunchStartHm = toHmFromEntry(lunchStart, DEFAULT_DAY_TIMES.lunchStart);

  return {
    clockIn: toHmFromEntry(clockIn, DEFAULT_DAY_TIMES.clockIn),
    clockOut: toHmFromEntry(clockOut, DEFAULT_DAY_TIMES.clockOut),
    coffeeStart: coffeeStartHm,
    coffeeEnd: coffeeEnd
      ? toHmFromEntry(coffeeEnd, DEFAULT_DAY_TIMES.coffeeEnd)
      : inferredPauseEndHm(coffeeStart, COFFEE_PAUSE_MS, DEFAULT_DAY_TIMES.coffeeEnd),
    lunchStart: lunchStartHm,
    lunchEnd: lunchEnd
      ? toHmFromEntry(lunchEnd, DEFAULT_DAY_TIMES.lunchEnd)
      : inferredPauseEndHm(lunchStart, LUNCH_PAUSE_MS, DEFAULT_DAY_TIMES.lunchEnd),
  };
}

/** Dias úteis (seg–sex) entre início e fim (inclusive), em YYYY-MM-DD */
export function listWeekdaysBetween(startKey: string, endKey: string): string[] {
  const result: string[] = [];
  const cur = new Date(`${startKey}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);
  while (cur <= end) {
    const key = toSwissDateKeyFromDate(cur);
    if (!isWeekend(key)) result.push(key);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

export function lastDayOfMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthKey}-${String(last).padStart(2, '0')}`;
}

/** Chaves YYYY-MM-DD de dias úteis passados sem marcação nos meses visíveis */
export function pendingWeekdayKeys(dayGroups: { dateKey: string }[], todayKey: string): string[] {
  const existing = new Set(dayGroups.map((g) => g.dateKey));
  const months = new Set<string>([todayKey.slice(0, 7)]);
  dayGroups.forEach((g) => months.add(g.dateKey.slice(0, 7)));

  const keys: string[] = [];
  for (const monthKey of months) {
    const monthStart = `${monthKey}-01`;
    const monthEnd = lastDayOfMonth(monthKey);
    const rangeEnd =
      monthKey === todayKey.slice(0, 7)
        ? todayKey
        : monthEnd < todayKey
          ? monthEnd
          : todayKey;

    for (const dk of listWeekdaysBetween(monthStart, rangeEnd)) {
      if (!existing.has(dk)) keys.push(dk);
    }
  }
  return keys;
}
