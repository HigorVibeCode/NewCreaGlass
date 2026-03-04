import { useState, useEffect, useCallback } from 'react';
import { repos } from '../services/container';
import { Production, ProductionStatus, ProductionStatusHistory, GlassType, Event, InventoryGroup, InventoryItem, Client } from '../types';

export interface AnalyticsData {
  clients: Client[];
  productions: Production[];
  statusHistories: Map<string, ProductionStatusHistory[]>;
  events: Event[];
  workOrders: any[];
  inventoryGroups: InventoryGroup[];
  inventoryItems: InventoryItem[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

const FINISHED_STATUSES: ProductionStatus[] = [
  'cancelled', 'delivered', 'completed', 'packed', 'ready_for_dispatch',
];

const ACTIVE_PROCESS_STATUSES: ProductionStatus[] = [
  'on_cutting_process', 'on_polishing_process', 'on_paint_cabin',
  'on_laminating_machine', 'on_schmelz_oven', 'on_banding_oven', 'tempering_in_progress',
];

const WAITING_STATUSES: ProductionStatus[] = [
  'waiting_to_cnc_wjet', 'waiting_to_drill', 'waiting_to_paint_cabin',
  'waiting_for_schmelz', 'waiting_for_tempering', 'waiting_for_packing',
];

const STATUS_GROUP: Record<string, string> = {};
['not_authorized', 'cancelled', 'rework_needed'].forEach(s => { STATUS_GROUP[s] = 'red'; });
['authorized'].forEach(s => { STATUS_GROUP[s] = 'green_entry'; });
ACTIVE_PROCESS_STATUSES.forEach(s => { STATUS_GROUP[s] = 'orange'; });
WAITING_STATUSES.forEach(s => { STATUS_GROUP[s] = 'yellow'; });
['packed', 'ready_for_dispatch'].forEach(s => { STATUS_GROUP[s] = 'blue'; });
['delivered', 'completed'].forEach(s => { STATUS_GROUP[s] = 'green_exit'; });

const STATUS_GROUP_COLORS: Record<string, string> = {
  red: '#ef4444',
  green_entry: '#10b981',
  orange: '#f97316',
  yellow: '#eab308',
  blue: '#3b82f6',
  green_exit: '#22c55e',
};

export function useAnalyticsData(): AnalyticsData {
  const [clients, setClients] = useState<Client[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [statusHistories, setStatusHistories] = useState<Map<string, ProductionStatusHistory[]>>(new Map());
  const [events, setEvents] = useState<Event[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [allClients, allProds, allEvents, allWorkOrders, allGroups, allItems] = await Promise.all([
        repos.clientsRepo.getAllClients().catch(() => [] as Client[]),
        repos.productionRepo.getAllProductions(),
        repos.eventsRepo.getAllEvents().catch(() => [] as Event[]),
        repos.workOrdersRepo.getAllWorkOrders().catch(() => [] as any[]),
        repos.inventoryRepo.getAllGroups().catch(() => [] as InventoryGroup[]),
        repos.inventoryRepo.getAllItems().catch(() => [] as InventoryItem[]),
      ]);

      setClients(allClients);
      setProductions(allProds);
      setEvents(allEvents);
      setWorkOrders(allWorkOrders);
      setInventoryGroups(allGroups);
      setInventoryItems(allItems);

      const histMap = new Map<string, ProductionStatusHistory[]>();
      const BATCH = 10;
      for (let i = 0; i < allProds.length; i += BATCH) {
        const batch = allProds.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(p => repos.productionRepo.getStatusHistory(p.id).catch(() => [] as ProductionStatusHistory[]))
        );
        batch.forEach((p, idx) => { histMap.set(p.id, results[idx]); });
      }
      setStatusHistories(histMap);
    } catch (err: any) {
      console.error('[Analytics] Error loading data:', err);
      setError(err?.message || 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { clients, productions, statusHistories, events, workOrders, inventoryGroups, inventoryItems, isLoading, error, reload: load };
}

// --- Derived metrics helpers ---

export function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function filterByPeriod(productions: Production[], months: number): Production[] {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return productions.filter(p => new Date(p.createdAt) >= cutoff);
}

export function getTotals(productions: Production[]) {
  let totalM2 = 0;
  let totalPieces = 0;
  for (const p of productions) {
    for (const item of p.items) {
      totalM2 += item.areaM2 || 0;
      totalPieces += item.quantity || 0;
    }
  }
  const inProgress = productions.filter(p => !FINISHED_STATUSES.includes(p.status)).length;
  return { total: productions.length, totalM2, totalPieces, inProgress };
}

export function getWeeklyOrders(productions: Production[], weeks: number = 12) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  const filtered = productions.filter(p => new Date(p.createdAt) >= cutoff);

  const weekMap = new Map<string, number>();
  for (const p of filtered) {
    const key = getWeekKey(p.createdAt);
    weekMap.set(key, (weekMap.get(key) || 0) + 1);
  }

  const labels: string[] = [];
  const data: number[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const key = getWeekKey(d.toISOString());
    const shortLabel = `W${key.split('-W')[1]}`;
    labels.push(shortLabel);
    data.push(weekMap.get(key) || 0);
  }
  return { labels, data };
}

export function getStatusPipeline(productions: Production[]) {
  const active = productions.filter(p => !FINISHED_STATUSES.includes(p.status));
  const counts = new Map<ProductionStatus, number>();
  for (const p of active) {
    counts.set(p.status, (counts.get(p.status) || 0) + 1);
  }
  const entries = Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return entries.map(([status, count]) => ({
    status,
    count,
    color: STATUS_GROUP_COLORS[STATUS_GROUP[status] || 'orange'] || '#6b7280',
  }));
}

export function getDeliveryPerformance(productions: Production[]) {
  const now = new Date();
  let onTime = 0;
  let late = 0;
  let noDate = 0;
  const lateOrders: { id: string; clientName: string; orderNumber: string; daysLate: number }[] = [];

  for (const p of productions) {
    if (!p.dueDate) { noDate++; continue; }
    const due = new Date(p.dueDate);
    if (FINISHED_STATUSES.includes(p.status)) {
      onTime++;
    } else if (due < now) {
      late++;
      const daysLate = Math.ceil((now.getTime() - due.getTime()) / 86400000);
      lateOrders.push({ id: p.id, clientName: p.clientName, orderNumber: p.orderNumber, daysLate });
    } else {
      onTime++;
    }
  }
  lateOrders.sort((a, b) => b.daysLate - a.daysLate);
  const total = onTime + late;
  const onTimePercent = total > 0 ? Math.round((onTime / total) * 100) : 100;
  return { onTime, late, noDate, onTimePercent, lateOrders };
}

export function getTopClients(productions: Production[], limit: number = 10) {
  const clientMap = new Map<string, { orders: number; m2: number; pieces: number }>();
  for (const p of productions) {
    const name = p.clientName || 'Unknown';
    const existing = clientMap.get(name) || { orders: 0, m2: 0, pieces: 0 };
    existing.orders++;
    for (const item of p.items) {
      existing.m2 += item.areaM2 || 0;
      existing.pieces += item.quantity || 0;
    }
    clientMap.set(name, existing);
  }
  return Array.from(clientMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, limit);
}

export function getGlassTypeMix(productions: Production[]) {
  const typeMap = new Map<GlassType, { m2: number; count: number }>();
  for (const p of productions) {
    for (const item of p.items) {
      const existing = typeMap.get(item.glassType) || { m2: 0, count: 0 };
      existing.m2 += item.areaM2 || 0;
      existing.count += item.quantity || 0;
      typeMap.set(item.glassType, existing);
    }
  }
  const entries = Array.from(typeMap.entries())
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.m2 - a.m2);

  const totalM2 = entries.reduce((sum, e) => sum + e.m2, 0);
  return entries.map(e => ({
    ...e,
    percent: totalM2 > 0 ? Math.round((e.m2 / totalM2) * 100) : 0,
  }));
}

const PIE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
  '#84cc16', '#a855f7', '#e11d48', '#0ea5e9', '#d946ef', '#facc15',
];

export function getPieColor(index: number): string {
  return PIE_COLORS[index % PIE_COLORS.length];
}

export function getBottleneckData(statusHistories: Map<string, ProductionStatusHistory[]>) {
  const durationMap = new Map<string, number[]>();

  statusHistories.forEach((history) => {
    const sorted = [...history].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      const status = sorted[i].newStatus;
      const start = new Date(sorted[i].changedAt).getTime();
      const end = new Date(sorted[i + 1].changedAt).getTime();
      const hours = (end - start) / 3600000;
      if (hours > 0 && hours < 720) {
        const arr = durationMap.get(status) || [];
        arr.push(hours);
        durationMap.set(status, arr);
      }
    }
  });

  const entries = Array.from(durationMap.entries()).map(([status, durations]) => ({
    status,
    avgHours: Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10,
    count: durations.length,
  })).sort((a, b) => b.avgHours - a.avgHours);

  const overallAvg = entries.length > 0
    ? entries.reduce((s, e) => s + e.avgHours, 0) / entries.length
    : 0;

  return { entries, overallAvg };
}

export function getCompanyComparison(productions: Production[]) {
  const companies: Record<string, { orders: number; m2: number; pieces: number }> = {
    '3S': { orders: 0, m2: 0, pieces: 0 },
    'Crea Glass': { orders: 0, m2: 0, pieces: 0 },
  };
  for (const p of productions) {
    const key = p.company || 'Crea Glass';
    if (!companies[key]) companies[key] = { orders: 0, m2: 0, pieces: 0 };
    companies[key].orders++;
    for (const item of p.items) {
      companies[key].m2 += item.areaM2 || 0;
      companies[key].pieces += item.quantity || 0;
    }
  }
  return companies;
}

// --- Events analytics ---

export function getEventsByType(events: Event[]) {
  const typeMap = new Map<string, number>();
  for (const e of events) {
    const t = (e as any).type || 'other';
    typeMap.set(t, (typeMap.get(t) || 0) + 1);
  }
  const entries = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const total = entries.reduce((s, e) => s + e.count, 0);
  return entries.map(e => ({ ...e, percent: total > 0 ? Math.round((e.count / total) * 100) : 0 }));
}

export function getEventsMonthly(events: Event[]) {
  const monthMap = new Map<string, number>();
  for (const e of events) {
    const dateStr = (e as any).startDate || e.createdAt;
    if (!dateStr) continue;
    const key = getMonthKey(dateStr);
    monthMap.set(key, (monthMap.get(key) || 0) + 1);
  }
  const sorted = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  return {
    labels: sorted.map(([m]) => m.slice(5)),
    data: sorted.map(([, c]) => c),
  };
}

export function getEventsCalendar(events: Event[]) {
  const now = new Date();
  const upcoming = events.filter(e => {
    const d = (e as any).startDate;
    return d && new Date(d) >= now && (e as any).status !== 'completed';
  }).sort((a, b) => new Date((a as any).startDate).getTime() - new Date((b as any).startDate).getTime());
  return upcoming.slice(0, 20);
}

// --- Work Orders analytics ---

export function getWorkOrderStatusPipeline(workOrders: any[]) {
  const counts = new Map<string, number>();
  for (const wo of workOrders) {
    const s = wo.status || 'pending';
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  const STATUS_COLORS: Record<string, string> = {
    pending: '#f59e0b',
    in_progress: '#3b82f6',
    completed: '#10b981',
    cancelled: '#ef4444',
  };
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count, color: STATUS_COLORS[status] || '#6b7280' }))
    .sort((a, b) => b.count - a.count);
}

export function getWorkOrderTeamPerformance(workOrders: any[]) {
  const completed = workOrders.filter(wo => wo.status === 'completed');
  const responsibleMap = new Map<string, number>();
  for (const wo of completed) {
    const r = wo.responsible || 'Unknown';
    responsibleMap.set(r, (responsibleMap.get(r) || 0) + 1);
  }
  return Array.from(responsibleMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function getWorkOrderAvgServiceTime(workOrders: any[]) {
  const completed = workOrders.filter(wo => wo.status === 'completed' && wo.timeStatuses?.length > 0);
  const times: number[] = [];
  for (const wo of completed) {
    const statuses = wo.timeStatuses || [];
    const starts = statuses.filter((ts: any) => ts.startTime).map((ts: any) => new Date(ts.startTime).getTime());
    const ends = statuses.filter((ts: any) => ts.endTime).map((ts: any) => new Date(ts.endTime).getTime());
    if (starts.length > 0 && ends.length > 0) {
      const earliest = Math.min(...starts);
      const latest = Math.max(...ends);
      const hours = (latest - earliest) / 3600000;
      if (hours > 0 && hours < 72) times.push(hours);
    }
  }
  const avg = times.length > 0 ? times.reduce((s, t) => s + t, 0) / times.length : 0;
  return { avgHours: Math.round(avg * 10) / 10, count: times.length };
}

export function getWorkOrderChecklistCompliance(workOrders: any[]) {
  let totalItems = 0;
  let checkedItems = 0;
  for (const wo of workOrders) {
    const items = wo.checklistItems || [];
    totalItems += items.length;
    checkedItems += items.filter((ci: any) => ci.isCompleted || ci.checked).length;
  }
  const percent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
  return { totalItems, checkedItems, percent };
}

export function getWorkOrderTopClients(workOrders: any[], limit: number = 10) {
  const clientMap = new Map<string, number>();
  for (const wo of workOrders) {
    const name = wo.clientName || 'Unknown';
    clientMap.set(name, (clientMap.get(name) || 0) + 1);
  }
  return Array.from(clientMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getWorkOrdersByDay(workOrders: any[]) {
  const dayMap = new Map<
    string,
    {
      date: string;
      startedCount: number;
      finishedCount: number;
      dayTotalDurationSeconds: number;
      completedCount: number;
      items: {
        id: string;
        name: string;
        startTime?: string;
        endTime?: string;
        durationSeconds: number;
      }[];
    }
  >();

  for (const wo of workOrders) {
    const statuses = wo.timeStatuses || [];
    const startTimes = statuses
      .filter((ts: any) => ts.startTime)
      .map((ts: any) => new Date(ts.startTime).getTime())
      .filter((v: number) => !isNaN(v));
    const endTimes = statuses
      .filter((ts: any) => ts.endTime)
      .map((ts: any) => new Date(ts.endTime).getTime())
      .filter((v: number) => !isNaN(v));

    const startMs = startTimes.length > 0 ? Math.min(...startTimes) : null;
    const endMs = endTimes.length > 0 ? Math.max(...endTimes) : null;
    const dayRef = startMs ?? (wo.scheduledDate ? new Date(wo.scheduledDate).getTime() : null);
    if (!dayRef || isNaN(dayRef)) continue;

    const dayKey = new Date(dayRef).toISOString().slice(0, 10);
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, {
        date: dayKey,
        startedCount: 0,
        finishedCount: 0,
        dayTotalDurationSeconds: 0,
        completedCount: 0,
        items: [],
      });
    }

    const day = dayMap.get(dayKey)!;
    const durationSeconds =
      startMs && endMs && endMs > startMs ? Math.floor((endMs - startMs) / 1000) : 0;

    if (startMs) day.startedCount += 1;
    if (endMs) day.finishedCount += 1;
    if (wo.status === 'completed') day.completedCount += 1;
    day.dayTotalDurationSeconds += durationSeconds;

    day.items.push({
      id: wo.id,
      name: wo.clientName || wo.id,
      startTime: startMs ? new Date(startMs).toISOString() : undefined,
      endTime: endMs ? new Date(endMs).toISOString() : undefined,
      durationSeconds,
    });
  }

  return Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}

// --- Inventory analytics ---

export function getInventoryLowStock(items: InventoryItem[]) {
  return items
    .filter(item => item.stock <= item.lowStockThreshold && item.lowStockThreshold > 0)
    .sort((a, b) => (a.stock / (a.lowStockThreshold || 1)) - (b.stock / (b.lowStockThreshold || 1)));
}

export function getInventoryByGroup(items: InventoryItem[], groups: InventoryGroup[]) {
  const groupMap = new Map<string, string>();
  for (const g of groups) groupMap.set(g.id, g.name);

  const totals = new Map<string, { name: string; totalStock: number; totalM2: number; itemCount: number }>();
  for (const item of items) {
    const gName = groupMap.get(item.groupId) || 'Unknown';
    const existing = totals.get(item.groupId) || { name: gName, totalStock: 0, totalM2: 0, itemCount: 0 };
    existing.totalStock += item.stock || 0;
    existing.totalM2 += item.totalM2 || 0;
    existing.itemCount++;
    totals.set(item.groupId, existing);
  }
  return Array.from(totals.values()).sort((a, b) => b.totalStock - a.totalStock);
}

export function getInventoryBySupplier(items: InventoryItem[]) {
  const supplierMap = new Map<string, { count: number; m2: number }>();
  for (const item of items) {
    const s = item.supplier || 'Unknown';
    const existing = supplierMap.get(s) || { count: 0, m2: 0 };
    existing.count++;
    existing.m2 += item.totalM2 || 0;
    supplierMap.set(s, existing);
  }
  return Array.from(supplierMap.entries())
    .map(([supplier, data]) => ({ supplier, ...data }))
    .sort((a, b) => b.count - a.count);
}

export function getReworkRate(productions: Production[]) {
  const total = productions.length;
  const rework = productions.filter(p => p.status === 'rework_needed').length;
  const cancelled = productions.filter(p => p.status === 'cancelled').length;
  const reworkPercent = total > 0 ? Math.round(((rework + cancelled) / total) * 100) : 0;

  const monthly = new Map<string, { total: number; issues: number }>();
  for (const p of productions) {
    const key = getMonthKey(p.createdAt);
    const existing = monthly.get(key) || { total: 0, issues: 0 };
    existing.total++;
    if (p.status === 'rework_needed' || p.status === 'cancelled') existing.issues++;
    monthly.set(key, existing);
  }

  const sortedMonths = Array.from(monthly.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  return {
    total,
    rework,
    cancelled,
    reworkPercent,
    monthlyTrend: sortedMonths.map(([month, data]) => ({
      month: month.slice(5),
      rate: data.total > 0 ? Math.round((data.issues / data.total) * 100) : 0,
    })),
  };
}

// --- Clients analytics ---

function normalizeText(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function getClientIdentifier(entity: { clientId?: string; clientName?: string }): string {
  return entity.clientId || `name:${normalizeText(entity.clientName)}`;
}

function getClientLastActivityIso(
  client: Client,
  productions: Production[],
  workOrders: any[]
): string | null {
  let latest = 0;
  for (const p of productions) {
    const matchById = !!client.id && p.clientId === client.id;
    const matchByName = normalizeText(p.clientName) === normalizeText(client.name);
    if (matchById || matchByName) {
      const ts = new Date(p.createdAt).getTime();
      if (!isNaN(ts) && ts > latest) latest = ts;
    }
  }
  for (const wo of workOrders) {
    const matchById = !!client.id && wo.clientId === client.id;
    const matchByName = normalizeText(wo.clientName) === normalizeText(client.name);
    if (matchById || matchByName) {
      const ts = new Date(wo.createdAt || wo.updatedAt || wo.scheduledDate || 0).getTime();
      if (!isNaN(ts) && ts > latest) latest = ts;
    }
  }
  return latest > 0 ? new Date(latest).toISOString() : null;
}

export function getClientsOverview(clients: Client[], productions: Production[], workOrders: any[]) {
  const usedClients = new Set<string>();
  for (const p of productions) usedClients.add(getClientIdentifier({ clientId: p.clientId, clientName: p.clientName }));
  for (const wo of workOrders) usedClients.add(getClientIdentifier({ clientId: wo.clientId, clientName: wo.clientName }));

  const withActivity = clients.filter((c) => {
    const idKey = c.id;
    const nameKey = `name:${normalizeText(c.name)}`;
    return usedClients.has(idKey) || usedClients.has(nameKey);
  });

  const withoutActivity = clients.filter((c) => !withActivity.includes(c));
  const withContact = clients.filter((c) => !!c.contact?.trim()).length;
  const withAddress = clients.filter((c) => !!c.address?.trim()).length;

  return {
    total: clients.length,
    withActivity: withActivity.length,
    withoutActivity: withoutActivity.length,
    withContact,
    withAddress,
  };
}

export function getClientEngagement(clients: Client[], productions: Production[], workOrders: any[], limit: number = 10) {
  const map = new Map<string, { client: Client; productionCount: number; workOrderCount: number; lastActivityIso: string | null }>();

  for (const client of clients) {
    map.set(client.id, {
      client,
      productionCount: 0,
      workOrderCount: 0,
      lastActivityIso: null,
    });
  }

  for (const p of productions) {
    const client = clients.find((c) => (p.clientId && c.id === p.clientId) || normalizeText(c.name) === normalizeText(p.clientName));
    if (!client) continue;
    const entry = map.get(client.id);
    if (!entry) continue;
    entry.productionCount += 1;
    const ts = new Date(p.createdAt).toISOString();
    if (!entry.lastActivityIso || new Date(ts) > new Date(entry.lastActivityIso)) entry.lastActivityIso = ts;
  }

  for (const wo of workOrders) {
    const client = clients.find((c) => (wo.clientId && c.id === wo.clientId) || normalizeText(c.name) === normalizeText(wo.clientName));
    if (!client) continue;
    const entry = map.get(client.id);
    if (!entry) continue;
    entry.workOrderCount += 1;
    const dateRef = wo.createdAt || wo.updatedAt || wo.scheduledDate || new Date().toISOString();
    const ts = new Date(dateRef).toISOString();
    if (!entry.lastActivityIso || new Date(ts) > new Date(entry.lastActivityIso)) entry.lastActivityIso = ts;
  }

  return Array.from(map.values())
    .map((e) => ({
      id: e.client.id,
      name: e.client.name,
      productionCount: e.productionCount,
      workOrderCount: e.workOrderCount,
      total: e.productionCount + e.workOrderCount,
      lastActivityIso: e.lastActivityIso,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function getInactiveClients(clients: Client[], productions: Production[], workOrders: any[], inactivityDays: number = 30) {
  const now = Date.now();
  const cutoff = now - inactivityDays * 24 * 60 * 60 * 1000;
  const result: { id: string; name: string; lastActivityIso: string | null; daysWithoutActivity: number | null }[] = [];

  for (const client of clients) {
    const last = getClientLastActivityIso(client, productions, workOrders);
    if (!last) {
      result.push({ id: client.id, name: client.name, lastActivityIso: null, daysWithoutActivity: null });
      continue;
    }
    const lastMs = new Date(last).getTime();
    if (isNaN(lastMs)) continue;
    if (lastMs <= cutoff) {
      const days = Math.floor((now - lastMs) / 86400000);
      result.push({ id: client.id, name: client.name, lastActivityIso: last, daysWithoutActivity: days });
    }
  }

  return result.sort((a, b) => {
    const aDays = a.daysWithoutActivity ?? 999999;
    const bDays = b.daysWithoutActivity ?? 999999;
    return bDays - aDays;
  });
}
