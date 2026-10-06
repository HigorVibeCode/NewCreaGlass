import { Production, ProductionStatus } from '../types';

// Ordered as the production workflow, used for status filter chips
export const PRODUCTION_STATUSES: ProductionStatus[] = [
  'not_authorized',
  'authorized',
  'cutting',
  'polishing',
  'waiting_for_tempering',
  'on_oven',
  'tempered',
  'on_cabin',
  'laminating',
  'laminated',
  'waiting_for_packing',
  'packed',
  'ready_for_dispatch',
  'delivered',
  'completed',
];

const FINISHED_STATUSES: ProductionStatus[] = ['delivered', 'completed'];
const SHIPPING_STATUSES: ProductionStatus[] = ['waiting_for_packing', 'packed', 'ready_for_dispatch'];

export type ProductionView = 'active' | 'overdue' | 'dueSoon' | 'shipping' | 'finished' | 'all';
export const PRODUCTION_VIEWS: ProductionView[] = ['active', 'overdue', 'dueSoon', 'shipping', 'finished', 'all'];

export type DateField = 'dueDate' | 'createdAt';
export type PeriodPreset = 'any' | 'today' | 'thisWeek' | 'thisMonth' | 'custom';
export type SortOption = 'dueDate' | 'newest' | 'client';

export interface ProductionFilters {
  statuses: ProductionStatus[]; // empty = any status
  dateField: DateField;
  period: PeriodPreset;
  customFrom: string; // YYYY-MM-DD
  customTo: string; // YYYY-MM-DD
  sort: SortOption;
}

export const DEFAULT_FILTERS: ProductionFilters = {
  statuses: [],
  dateField: 'dueDate',
  period: 'any',
  customFrom: '',
  customTo: '',
  sort: 'dueDate',
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
    case 'today':
      return [toDateKey(todayStart), toDateKey(todayStart)];
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
  today = new Date()
): Production[] => {
  const term = search.trim().toLowerCase();
  const [from, to] = getPeriodRange(filters, today);

  return productions.filter((p) => {
    if (term) {
      const haystack = `${p.clientName} ${p.orderNumber} ${p.orderType}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(p.status)) return false;
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

export const countActiveFilters = (filters: ProductionFilters): number =>
  (filters.statuses.length > 0 ? 1 : 0) + (filters.period !== 'any' ? 1 : 0);
