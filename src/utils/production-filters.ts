import { Production, ProductionCompany, ProductionStatus } from '../types';

export { PRODUCTION_STATUSES } from './production-status';

const FINISHED_STATUSES: ProductionStatus[] = ['delivered', 'completed', 'cancelled'];
const SHIPPING_STATUSES: ProductionStatus[] = [
  'pack_glass_box',
  'pack_pallet',
  'pack_paper',
  'waiting_for_packing',
  'packed',
  'packed_glass_box',
  'packed_pallet',
  'packed_paper',
  'ready_for_dispatch',
];

export type ProductionView = 'active' | 'overdue' | 'dueSoon' | 'shipping' | 'finished' | 'all';
export const PRODUCTION_VIEWS: ProductionView[] = ['active', 'overdue', 'dueSoon', 'shipping', 'finished', 'all'];

export type DateField = 'dueDate' | 'createdAt';
export type PeriodPreset = 'last7' | 'last30' | 'last90' | 'thisWeek' | 'thisMonth' | 'custom' | 'any';
export const PERIOD_PRESETS: PeriodPreset[] = ['last7', 'last30', 'last90', 'thisWeek', 'thisMonth', 'custom', 'any'];
export const SORT_OPTIONS: SortOption[] = ['newest', 'dueDate', 'client'];
export type SortOption = 'dueDate' | 'newest' | 'client';

export interface ProductionFilters {
  statuses: ProductionStatus[]; // empty = any status
  company: ProductionCompany | 'all';
  glassId: string; // 'all' = any glass
  dateField: DateField;
  period: PeriodPreset;
  customFrom: string; // YYYY-MM-DD
  customTo: string; // YYYY-MM-DD
  sort: SortOption;
}

// Always-on default: orders created in the last 30 days, newest first
export const DEFAULT_FILTERS: ProductionFilters = {
  statuses: [],
  company: 'all',
  glassId: 'all',
  dateField: 'createdAt',
  period: 'last30',
  customFrom: '',
  customTo: '',
  sort: 'newest',
};

const DUE_SOON_DAYS = 7;

export const isFinished = (status: ProductionStatus) => FINISHED_STATUSES.includes(status);

const pad = (n: number) => String(n).padStart(2, '0');

// Local calendar day as YYYY-MM-DD (comparable as string)
export const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Plain dates ("2026-10-06") are kept as-is so they don't shift with the timezone
export const parseDateKey = (value: string): string | null => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : toDateKey(date);
};

const keyToDate = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Whole days from today until the due date (negative = overdue)
export const daysUntilDue = (production: Production, today = new Date()): number | null => {
  const dueKey = parseDateKey(production.dueDate);
  if (!dueKey) return null;
  const todayStart = keyToDate(toDateKey(today));
  return Math.round((keyToDate(dueKey).getTime() - todayStart.getTime()) / 86400000);
};

export const formatDateKey = (value: string): string => {
  const key = parseDateKey(value);
  return key ? keyToDate(key).toLocaleDateString() : '';
};

const getPeriodRange = (filters: ProductionFilters, today: Date): [string | null, string | null] => {
  const todayStart = keyToDate(toDateKey(today));
  switch (filters.period) {
    case 'last7':
    case 'last30':
    case 'last90': {
      const days = filters.period === 'last7' ? 7 : filters.period === 'last30' ? 30 : 90;
      return [toDateKey(addDays(todayStart, -(days - 1))), toDateKey(todayStart)];
    }
    case 'thisWeek': {
      // Week starts on Monday
      const monday = addDays(todayStart, -((todayStart.getDay() + 6) % 7));
      return [toDateKey(monday), toDateKey(addDays(monday, 6))];
    }
    case 'thisMonth': {
      const first = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
      const last = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0);
      return [toDateKey(first), toDateKey(last)];
    }
    case 'custom':
      return [filters.customFrom || null, filters.customTo || null];
    default:
      return [null, null];
  }
};

export const matchesView = (production: Production, view: ProductionView, today = new Date()): boolean => {
  const finished = isFinished(production.status);
  switch (view) {
    case 'active':
      return !finished;
    case 'overdue': {
      const days = daysUntilDue(production, today);
      return !finished && days !== null && days < 0;
    }
    case 'dueSoon': {
      const days = daysUntilDue(production, today);
      return !finished && days !== null && days >= 0 && days < DUE_SOON_DAYS;
    }
    case 'shipping':
      return SHIPPING_STATUSES.includes(production.status);
    case 'finished':
      return finished;
    default:
      return true;
  }
};

// Search + filter sheet (everything except the view chips)
export const applyFilters = (
  productions: Production[],
  search: string,
  filters: ProductionFilters,
  getGlassName: (glassId: string) => string | undefined = () => undefined,
  today = new Date()
): Production[] => {
  const term = search.trim().toLowerCase();
  const [from, to] = getPeriodRange(filters, today);

  return productions.filter((p) => {
    if (term) {
      const glassNames = (p.items || []).map((item) => getGlassName(item.glassId) || '').join(' ');
      const haystack = `${p.clientName} ${p.orderNumber} ${p.orderType} ${glassNames}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(p.status)) return false;
    if (filters.company !== 'all' && p.company !== filters.company) return false;
    if (filters.glassId !== 'all' && !(p.items || []).some((item) => item.glassId === filters.glassId)) return false;
    if (from || to) {
      const key = parseDateKey(filters.dateField === 'dueDate' ? p.dueDate : p.createdAt);
      if (!key) return false;
      if (from && key < from) return false;
      if (to && key > to) return false;
    }
    return true;
  });
};

export const sortProductions = (productions: Production[], sort: SortOption): Production[] => {
  const sorted = [...productions];
  switch (sort) {
    case 'dueDate':
      // Without due date go last
      return sorted.sort((a, b) =>
        (parseDateKey(a.dueDate) || '9999').localeCompare(parseDateKey(b.dueDate) || '9999')
      );
    case 'client':
      return sorted.sort((a, b) => a.clientName.localeCompare(b.clientName));
    default:
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
};

// Filters inside the filter sheet (status, company, glass)
export const countSheetFilters = (filters: ProductionFilters): number =>
  (filters.statuses.length > 0 ? 1 : 0) + (filters.company !== 'all' ? 1 : 0) + (filters.glassId !== 'all' ? 1 : 0);

export const isDefaultFilters = (filters: ProductionFilters): boolean =>
  countSheetFilters(filters) === 0 &&
  filters.dateField === DEFAULT_FILTERS.dateField &&
  filters.period === DEFAULT_FILTERS.period &&
  filters.sort === DEFAULT_FILTERS.sort;
