import { TimeEntry } from '../types';
import { formatDate as formatDateCentral, formatTime as formatTimeCentral } from './date-format';

export interface DayRow {
  date: string;
  dateLabel: string;
  entrada: string;
  saida: string;
  cafe: string;
  almoco: string;
  entradaSource: string;
  saidaSource: string;
  totalDay: string;
  local: string;
  incomplete: boolean;
  totalMinutes: number;
  adjusted?: boolean;
  /** Justificativa(s) do(s) ajuste(s) do dia (quando houver). */
  adjustDescription?: string;
}

/** Horário efetivo para relatório: ajustado quando existir, senão original. */
export function getEffectiveRecordedAt(entry: TimeEntry): string {
  if (!entry?.recordedAt) return '';
  const useAdjusted =
    entry.isAdjusted === true &&
    entry.adjustedRecordedAt &&
    typeof entry.adjustedRecordedAt === 'string';
  return useAdjusted ? entry.adjustedRecordedAt : entry.recordedAt;
}

const INCOMPLETE = 'INCOMPLETE';
const SWISS_TIMEZONE = 'Europe/Zurich';

function toSwissDateKey(date: Date): string {
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

function toDateKey(iso: string): string {
  const d = new Date(iso);
  return toSwissDateKey(d);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SWISS_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === 'hour')?.value;
  const mm = parts.find((p) => p.type === 'minute')?.value;
  const ss = parts.find((p) => p.type === 'second')?.value;
  if (!hh || !mm || !ss) return '—';
  return `${hh}:${mm}:${ss}`;
}

function formatDateLabel(iso: string): string {
  return formatDateCentral(iso);
}

function getMarkingSource(entry?: TimeEntry): string {
  if (!entry) return '—';
  const location = (entry.locationAddress || '').trim().toLowerCase();
  if (location.includes('autom') || location.includes('auto')) {
    return 'Automatic';
  }
  return 'Manual';
}

/** Formata duração em minutos como HH:MM (horas e minutos inteiros). */
function minutesToHoursLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '00:00';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Agrupa registros por usuário e por dia; usa horário ajustado quando existir.
 * Usa entry_type (clock_in / clock_out) quando disponível; caso contrário faz
 * fallback para a lógica anterior baseada em posição par/ímpar.
 */
export function buildDayRows(entries: TimeEntry[]): DayRow[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const byUserAndDay = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    if (!e?.recordedAt) continue;
    const effectiveAt = getEffectiveRecordedAt(e);
    if (!effectiveAt) continue;
    const key = `${e.userId}|${toDateKey(effectiveAt)}`;
    if (!byUserAndDay.has(key)) byUserAndDay.set(key, []);
    byUserAndDay.get(key)!.push(e);
  }

  const rows: DayRow[] = [];
  for (const [, dayEntries] of byUserAndDay) {
    dayEntries.sort(
      (a, b) =>
        new Date(getEffectiveRecordedAt(a)).getTime() - new Date(getEffectiveRecordedAt(b)).getTime()
    );
    const first = dayEntries[0];
    const effectiveFirst = getEffectiveRecordedAt(first);
    const dateKey = toDateKey(effectiveFirst);
    const dateLabel = formatDateLabel(effectiveFirst);
    const local = first.locationAddress?.trim() || '—';
    const anyAdjusted = dayEntries.some((e) => e.isAdjusted);
    const justificativas = dayEntries
      .filter((e) => e.isAdjusted && e.adjustDescription?.trim())
      .map((e) => e.adjustDescription!.trim())
      .filter((s, i, arr) => arr.indexOf(s) === i);
    const adjustDescription = justificativas.length ? justificativas.join('; ') : undefined;

    // Tentar usar entry_type para determinar entrada/saída
    const hasEntryTypes = dayEntries.some((e) => e.entryType === 'clock_in' || e.entryType === 'clock_out');

    if (hasEntryTypes) {
      const clockIn = dayEntries.find((e) => e.entryType === 'clock_in');
      const clockOut = dayEntries.find((e) => e.entryType === 'clock_out');
      const coffeeStart = dayEntries.find((e) => e.entryType === 'coffee_start');
      const lunchStart = dayEntries.find((e) => e.entryType === 'lunch_start');
      const entradaTime = clockIn ? formatTime(getEffectiveRecordedAt(clockIn)) : INCOMPLETE;
      const saidaTime = clockOut ? formatTime(getEffectiveRecordedAt(clockOut)) : INCOMPLETE;
      const coffeeLabel = coffeeStart
        ? `${formatTime(getEffectiveRecordedAt(coffeeStart))} - ${formatTime(
            new Date(new Date(getEffectiveRecordedAt(coffeeStart)).getTime() + 15 * 60 * 1000).toISOString()
          )}`
        : '—';
      const lunchLabel = lunchStart
        ? `${formatTime(getEffectiveRecordedAt(lunchStart))} - ${formatTime(
            new Date(new Date(getEffectiveRecordedAt(lunchStart)).getTime() + 45 * 60 * 1000).toISOString()
          )}`
        : '—';
      const entradaSource = getMarkingSource(clockIn);
      const saidaSource = getMarkingSource(clockOut);
      const incomplete = !clockIn || !clockOut;

      // Dedução fixa: 15 min se café ativado, 45 min se almoço ativado
      let pauseMinutes = 0;
      if (coffeeStart) pauseMinutes += 15;
      if (lunchStart) pauseMinutes += 45;

      let totalMinutes = 0;
      if (clockIn && clockOut) {
        const ent = new Date(getEffectiveRecordedAt(clockIn)).getTime();
        const sai = new Date(getEffectiveRecordedAt(clockOut)).getTime();
        if (Number.isFinite(ent) && Number.isFinite(sai) && sai > ent) {
          totalMinutes = Math.max(0, (sai - ent) / 60000 - pauseMinutes);
        }
      }
      rows.push({
        date: dateKey,
        dateLabel,
        entrada: entradaTime,
        saida: saidaTime,
        cafe: coffeeLabel,
        almoco: lunchLabel,
        entradaSource,
        saidaSource,
        totalDay: incomplete ? INCOMPLETE : minutesToHoursLabel(totalMinutes),
        local,
        incomplete,
        totalMinutes: incomplete ? 0 : totalMinutes,
        adjusted: anyAdjusted,
        adjustDescription,
      });
    } else {
      // Fallback: lógica legada baseada em posição par/ímpar
      const entrada = formatTime(effectiveFirst);
      if (dayEntries.length % 2 !== 0) {
        rows.push({
          date: dateKey,
          dateLabel,
          entrada,
          saida: INCOMPLETE,
          cafe: '—',
          almoco: '—',
          entradaSource: getMarkingSource(first),
          saidaSource: '—',
          totalDay: INCOMPLETE,
          local,
          incomplete: true,
          totalMinutes: 0,
          adjusted: anyAdjusted,
          adjustDescription,
        });
        continue;
      }

      let totalMinutes = 0;
      let invalid = false;
      for (let i = 0; i < dayEntries.length; i += 2) {
        const ent = new Date(getEffectiveRecordedAt(dayEntries[i])).getTime();
        const sai = new Date(getEffectiveRecordedAt(dayEntries[i + 1])).getTime();
        if (!Number.isFinite(ent) || !Number.isFinite(sai) || sai <= ent) {
          invalid = true;
          break;
        }
        totalMinutes += (sai - ent) / 60000;
      }
      const safeTotal = Number.isFinite(totalMinutes) ? totalMinutes : 0;

      const lastEffective = getEffectiveRecordedAt(dayEntries[dayEntries.length - 1]);
      const lastTime = formatTime(lastEffective);
      rows.push({
        date: dateKey,
        dateLabel,
        entrada,
        saida: invalid ? INCOMPLETE : lastTime,
        cafe: '—',
        almoco: '—',
        entradaSource: getMarkingSource(first),
        saidaSource: invalid ? '—' : getMarkingSource(dayEntries[dayEntries.length - 1]),
        totalDay: invalid ? INCOMPLETE : minutesToHoursLabel(safeTotal),
        local,
        incomplete: invalid,
        totalMinutes: invalid ? 0 : safeTotal,
        adjusted: anyAdjusted,
        adjustDescription,
      });
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

/**
 * Soma apenas totais diários completos (não INCOMPLETE). Retorna minutos e label.
 */
export function totalHoursInPeriod(dayRows: DayRow[]): { totalMinutes: number; label: string } {
  const totalMinutes = (dayRows || [])
    .filter((r) => !r.incomplete && Number.isFinite(r.totalMinutes))
    .reduce((s, r) => s + r.totalMinutes, 0);
  return {
    totalMinutes: Number.isFinite(totalMinutes) ? totalMinutes : 0,
    label: minutesToHoursLabel(totalMinutes),
  };
}

const ROWS_PER_PAGE = 28;

/**
 * Gera HTML do relatório de ponto para impressão/PDF.
 * @param logoBase64 - Opcional: data URL da logo (data:image/png;base64,...) para exibir no topo.
 */
export function buildPointReportHtml(options: {
  periodFrom: string;
  periodTo: string;
  emittedAt: string;
  identification: string;
  dayRows: DayRow[];
  totalLabel: string;
  logoBase64?: string;
}): string {
  const { periodFrom, periodTo, emittedAt, identification, dayRows, totalLabel, logoBase64 } = options;
  const rows = Array.isArray(dayRows) ? dayRows : [];
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const totalLabelSafe =
    totalLabel != null && String(totalLabel).trim() !== '' ? String(totalLabel) : '00:00';
  const logoImg =
    logoBase64 && logoBase64.startsWith('data:image')
      ? `<div class="logo-container"><img src="${logoBase64.replace(/"/g, '&quot;')}" alt="Logo" class="report-logo" /></div>`
      : '';

  const tableRows = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.dateLabel)}${r.adjusted ? ' (ADJUSTED)' : ''}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.entrada)}${r.entrada !== INCOMPLETE ? ` - ${r.entradaSource === 'Automatic' ? 'AUT' : 'MAN'}` : ''}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.saida)}${r.saida !== INCOMPLETE ? ` - ${r.saidaSource === 'Automatic' ? 'AUT' : 'MAN'}` : ''}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.cafe)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.almoco)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.totalDay)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;">${escapeHtml(r.local)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;">${escapeHtml(r.adjustDescription ?? '-')}</td>
    </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Time Clock Report</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12px; color: #222; margin: 20px; }
    .logo-container { text-align: center; margin-bottom: 12px; }
    .report-logo { max-height: 56px; max-width: 200px; object-fit: contain; }
    .header { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #333; }
    .header h1 { margin: 0 0 8px 0; font-size: 18px; }
    .header .meta { color: #555; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; table-layout: fixed; }
    th { background: #f5f5f5; padding: 8px; text-align: left; border: 1px solid #ddd; font-size: 11px; }
    td { word-break: break-word; }
    .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #555; }
    .totalizador { font-weight: bold; font-size: 14px; margin-top: 12px; padding: 8px 0; page-break-inside: avoid; }
  </style>
</head>
<body>
  ${logoImg}
  <div class="header">
    <h1>Time Clock Report</h1>
    <div class="meta">Period: ${periodFrom} to ${periodTo}</div>
    <div class="meta">Issued at: ${emittedAt}</div>
    <div class="meta">User: ${escapeHtml(identification)}</div>
    <div class="meta">Break policy: Coffee 15 min, Lunch 45 min</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Clock In</th>
        <th>Clock Out</th>
        <th>Coffee Break</th>
        <th>Lunch Break</th>
        <th>Day Total</th>
        <th>Location</th>
        <th>Reason</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <div class="totalizador">TOTAL HOURS IN PERIOD: ${totalLabelSafe}</div>
  <div class="footer">Page 1 of ${totalPages}</div>
</body>
</html>`;
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
