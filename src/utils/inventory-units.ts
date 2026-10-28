import { InventoryItem } from '../types';

// Glass is stocked in sheets: `stock` is the number of sheets and `totalM2` is the area of
// ONE sheet. Glass items were created with unit "m²", which describes the sheet size, not
// the stock, so the unit field must not be used to decide what `stock` counts.

const isAreaUnit = (unit: string | undefined) => /^m(2|²)$/i.test((unit || '').trim());

/** m² of a single sheet (stored, or derived from the dimensions); null when not a sheet item */
export const getSheetArea = (item: Pick<InventoryItem, 'totalM2' | 'width' | 'height'>): number | null => {
  if (item.totalM2) return item.totalM2;
  if (item.width && item.height) return (item.width * item.height) / 1_000_000;
  return null;
};

/** True when `stock` counts sheets (the item has a sheet size) */
export const isSheetStocked = (item: Pick<InventoryItem, 'totalM2' | 'width' | 'height'>): boolean =>
  getSheetArea(item) !== null;

/** Total area in stock: sheets × sheet area; stock itself only for items really stocked in m² */
export const getStockAreaM2 = (item: InventoryItem): number | null => {
  const area = getSheetArea(item);
  if (area !== null) return area * (item.stock || 0);
  if (isAreaUnit(item.unit)) return item.stock || 0;
  return null;
};

/** Unit to show next to `stock` ("chapas" for glass sheets, otherwise the item's unit) */
export const getStockUnitLabel = (item: InventoryItem, t: (key: string) => string): string =>
  isSheetStocked(item) ? t('inventory.report.sheetsUnit') : item.unit || '';
