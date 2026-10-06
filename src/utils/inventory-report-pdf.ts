import { InventoryItem } from '../types';

// Inventory count report: A4 portrait, glass (sheets + m²) separated from other items
interface ReportOptions {
  supplier: string;
  reportId: string;
  date: string;
  time: string;
  items: InventoryItem[];
  isGlassItem: (item: InventoryItem) => boolean;
  logoDataUrl?: string;
  t: (key: string, options?: any) => string;
}

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmt = (value: number, decimals = 2): string =>
  value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtInt = (value: number): string =>
  Number.isInteger(value) ? value.toLocaleString() : fmt(value, 2);

const isAreaUnit = (unit: string | undefined) => /^m(2|²)$/i.test((unit || '').trim());

// m² of a single sheet; derived from the dimensions when not stored
const sheetArea = (item: InventoryItem): number | null => {
  if (item.totalM2) return item.totalM2;
  if (item.width && item.height) return (item.width * item.height) / 1_000_000;
  return null;
};

const isLow = (item: InventoryItem) => item.lowStockThreshold > 0 && (item.stock || 0) <= item.lowStockThreshold;

export function generateInventoryReportHTML({
  supplier,
  reportId,
  date,
  time,
  items,
  isGlassItem,
  logoDataUrl,
  t,
}: ReportOptions): string {
  const tr = (key: string, options?: any) => t(`inventory.report.${key}`, options);
  const byName = (a: InventoryItem, b: InventoryItem) => a.name.localeCompare(b.name);
  const glass = items.filter(isGlassItem).sort(byName);
  const others = items.filter((item) => !isGlassItem(item)).sort(byName);

  let totalSheets = 0;
  let totalArea = 0;

  const glassRows = glass
    .map((item, index) => {
      const stock = item.stock || 0;
      const area = sheetArea(item);
      // Some glass may be stocked directly in m²
      const sheets = isAreaUnit(item.unit) ? null : stock;
      const total = isAreaUnit(item.unit) ? stock : area !== null ? area * stock : null;
      if (sheets !== null) totalSheets += sheets;
      if (total !== null) totalArea += total;

      // Millimetres read better without thousands separators (3210 × 2250)
      const dims = item.width && item.height ? `${item.width} × ${item.height}` : '—';
      const thickness = item.thickness ? `${item.thickness} mm` : '';

      return `
        <tr>
          <td class="num muted">${index + 1}</td>
          <td>
            <div class="name">${esc(item.name)}${isLow(item) ? ` <span class="tag">${esc(tr('low'))}</span>` : ''}</div>
            ${item.referenceNumber ? `<div class="sub">${esc(item.referenceNumber)}</div>` : ''}
          </td>
          <td>
            <div>${dims}</div>
            ${thickness ? `<div class="sub">${thickness}</div>` : ''}
          </td>
          <td class="num">${area !== null ? fmt(area) : '—'}</td>
          <td class="num strong">${sheets !== null ? fmtInt(sheets) : '—'}</td>
          <td class="num strong">${total !== null ? fmt(total) : '—'}</td>
          <td class="muted">${esc(item.location || '—')}</td>
        </tr>`;
    })
    .join('');

  const otherRows = others
    .map(
      (item, index) => `
        <tr>
          <td class="num muted">${index + 1}</td>
          <td>
            <div class="name">${esc(item.name)}${isLow(item) ? ` <span class="tag">${esc(tr('low'))}</span>` : ''}</div>
            ${item.referenceNumber ? `<div class="sub">${esc(item.referenceNumber)}</div>` : ''}
          </td>
          <td class="num strong">${fmtInt(item.stock || 0)}</td>
          <td>${esc(item.unit || '—')}</td>
          <td class="muted">${esc(item.location || '—')}</td>
        </tr>`
    )
    .join('');

  const glassSection = glass.length
    ? `
      <h2>${esc(tr('glassSection'))} <span class="count">${glass.length}</span></h2>
      <table>
        <colgroup>
          <col style="width:5%" /><col style="width:29%" /><col style="width:17%" />
          <col style="width:11%" /><col style="width:11%" /><col style="width:12%" /><col style="width:15%" />
        </colgroup>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>${esc(tr('glass'))}</th>
            <th>${esc(tr('dimensions'))}<div class="unit">${esc(tr('dimensionsUnit'))}</div></th>
            <th class="num">${esc(tr('areaPerSheet'))}<div class="unit">m²</div></th>
            <th class="num hl">${esc(tr('sheets'))}<div class="unit">${esc(tr('sheetsUnit'))}</div></th>
            <th class="num hl">${esc(tr('totalArea'))}<div class="unit">m²</div></th>
            <th>${esc(tr('location'))}</th>
          </tr>
        </thead>
        <tbody>${glassRows}</tbody>
        <tfoot>
          <tr>
            <td></td>
            <td colspan="3">${esc(tr('total'))}</td>
            <td class="num">${fmtInt(totalSheets)}</td>
            <td class="num">${fmt(totalArea)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>`
    : '';

  const otherSection = others.length
    ? `
      <h2>${esc(tr('otherSection'))} <span class="count">${others.length}</span></h2>
      <table>
        <colgroup>
          <col style="width:5%" /><col style="width:47%" /><col style="width:14%" />
          <col style="width:14%" /><col style="width:20%" />
        </colgroup>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>${esc(tr('item'))}</th>
            <th class="num hl">${esc(tr('quantity'))}</th>
            <th>${esc(tr('unit'))}</th>
            <th>${esc(tr('location'))}</th>
          </tr>
        </thead>
        <tbody>${otherRows}</tbody>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(tr('title'))} - ${esc(supplier)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2937; font-size: 10.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #111827; }
  .logo { max-height: 46px; max-width: 160px; object-fit: contain; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 19px; color: #111827; letter-spacing: -0.2px; }
  .title .supplier { margin-top: 3px; font-size: 13px; font-weight: 600; color: #374151; }
  .title .meta { margin-top: 4px; color: #6b7280; font-size: 10px; }
  .summary { display: flex; gap: 8px; margin: 14px 0 6px; }
  .tile { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
  .tile .label { color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; }
  .tile .value { font-size: 17px; font-weight: 700; color: #111827; margin-top: 2px; }
  .tile .value small { font-size: 10px; font-weight: 600; color: #6b7280; }
  .tile.hl { background: #f3f6ff; border-color: #c7d2fe; }
  h2 { font-size: 12.5px; margin: 18px 0 6px; color: #111827; }
  h2 .count { display: inline-block; background: #f3f4f6; color: #4b5563; border-radius: 9px; padding: 1px 7px; font-size: 10px; margin-left: 4px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  tr { page-break-inside: avoid; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; color: #4b5563; background: #f9fafb; padding: 6px 6px; border-bottom: 1px solid #d1d5db; vertical-align: bottom; }
  th .unit { text-transform: none; letter-spacing: 0; color: #9ca3af; font-weight: 400; font-size: 8.5px; }
  th.hl { background: #eef2ff; color: #3730a3; }
  td { padding: 6px 6px; border-bottom: 1px solid #f0f1f3; vertical-align: top; word-break: break-word; }
  tbody tr:nth-child(even) td { background: #fcfcfd; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .strong { font-weight: 700; color: #111827; }
  .muted { color: #6b7280; }
  .name { font-weight: 600; color: #111827; }
  .sub { color: #9ca3af; font-size: 9px; margin-top: 1px; }
  .tag { display: inline-block; font-size: 8px; font-weight: 700; color: #b91c1c; background: #fee2e2; border-radius: 3px; padding: 0 4px; vertical-align: middle; }
  tfoot td { font-weight: 700; color: #111827; border-top: 2px solid #111827; border-bottom: none; background: #fff; }
  .signatures { display: flex; gap: 24px; margin-top: 34px; page-break-inside: avoid; }
  .sig { flex: 1; }
  .sig .line { border-bottom: 1px solid #9ca3af; height: 28px; }
  .sig .label { color: #6b7280; font-size: 9px; margin-top: 4px; }
  .footer { margin-top: 18px; color: #9ca3af; font-size: 8.5px; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div>${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Crea Glass" />` : '<strong>Crea Glass</strong>'}</div>
    <div class="title">
      <h1>${esc(tr('title'))}</h1>
      <div class="supplier">${esc(tr('supplier'))}: ${esc(supplier)}</div>
      <div class="meta">${esc(date)} · ${esc(time)} · ${esc(reportId)}</div>
    </div>
  </div>

  <div class="summary">
    <div class="tile"><div class="label">${esc(tr('items'))}</div><div class="value">${items.length}</div></div>
    ${glass.length ? `<div class="tile hl"><div class="label">${esc(tr('sheets'))}</div><div class="value">${fmtInt(totalSheets)} <small>${esc(tr('sheetsUnit'))}</small></div></div>` : ''}
    ${glass.length ? `<div class="tile hl"><div class="label">${esc(tr('totalArea'))}</div><div class="value">${fmt(totalArea)} <small>m²</small></div></div>` : ''}
    ${others.length ? `<div class="tile"><div class="label">${esc(tr('otherSection'))}</div><div class="value">${others.length}</div></div>` : ''}
  </div>

  ${glassSection}
  ${otherSection}

  <div class="signatures">
    <div class="sig"><div class="line"></div><div class="label">${esc(tr('countedBy'))}</div></div>
    <div class="sig"><div class="line"></div><div class="label">${esc(tr('checkedBy'))}</div></div>
    <div class="sig"><div class="line"></div><div class="label">${esc(tr('signatureDate'))}</div></div>
  </div>

  <div class="footer">${esc(tr('generatedBy'))} · ${esc(reportId)}</div>
</body>
</html>`;
}
