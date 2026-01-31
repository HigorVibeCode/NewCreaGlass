import { TimeEntry } from '../types';

export interface DayRow {
  date: string;
  dateLabel: string;
  entrada: string;
  saida: string;
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

const INCOMPLETO = 'INCOMPLETO';

function toDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
 * Para cada dia forma pares Entrada/Saída e calcula total do dia.
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
    const entrada = formatTime(effectiveFirst);
    const anyAdjusted = dayEntries.some((e) => e.isAdjusted);
    const justificativas = dayEntries
      .filter((e) => e.isAdjusted && e.adjustDescription?.trim())
      .map((e) => e.adjustDescription!.trim())
      .filter((s, i, arr) => arr.indexOf(s) === i);
    const adjustDescription = justificativas.length ? justificativas.join('; ') : undefined;

    if (dayEntries.length % 2 !== 0) {
      rows.push({
        date: dateKey,
        dateLabel,
        entrada,
        saida: INCOMPLETO,
        totalDay: INCOMPLETO,
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
      saida: invalid ? INCOMPLETO : lastTime,
      totalDay: invalid ? INCOMPLETO : minutesToHoursLabel(safeTotal),
      local,
      incomplete: invalid,
      totalMinutes: invalid ? 0 : safeTotal,
      adjusted: anyAdjusted,
      adjustDescription,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

/**
 * Soma apenas totais diários completos (não INCOMPLETO). Retorna minutos e label.
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
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.dateLabel)}${r.adjusted ? ' (AJUSTADO)' : ''}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.entrada)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.saida)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.totalDay)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;">${escapeHtml(r.local)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;">${escapeHtml(r.adjustDescription ?? '—')}</td>
    </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Relatório de Ponto</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12px; color: #222; margin: 20px; }
    .logo-container { text-align: center; margin-bottom: 12px; }
    .report-logo { max-height: 56px; max-width: 200px; object-fit: contain; }
    .header { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #333; }
    .header h1 { margin: 0 0 8px 0; font-size: 18px; }
    .header .meta { color: #555; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f5f5f5; padding: 8px; text-align: left; border: 1px solid #ddd; font-size: 11px; }
    .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #555; }
    .totalizador { font-weight: bold; font-size: 14px; margin-top: 12px; padding: 8px 0; page-break-inside: avoid; }
  </style>
</head>
<body>
  ${logoImg}
  <div class="header">
    <h1>Relatório de Ponto</h1>
    <div class="meta">Período: ${periodFrom} a ${periodTo}</div>
    <div class="meta">Emitido em: ${emittedAt}</div>
    <div class="meta">Identificação: ${escapeHtml(identification)}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Entrada</th>
        <th>Saída</th>
        <th>Total do dia</th>
        <th>Local</th>
        <th>Justificativa</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <div class="totalizador">TOTAL DE HORAS NO PERÍODO: ${totalLabelSafe}</div>
  <div class="footer">Página 1 de ${totalPages}</div>
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
