import { ComponentProps } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ProductionStatus } from '../types';
import type { PackagingIconName } from '../components/shared/PackagingIcon';
import type { ProcessIconName } from '../components/shared/ProcessIcon';

// Visual meaning of a phase: the icon shows the activity, the color shows the kind
// (waiting / working / instruction / done...), waiting phases add a small clock
export type StatusKind = 'blocked' | 'problem' | 'waiting' | 'working' | 'instruction' | 'done' | 'final' | 'cancelled';

type IconName = ComponentProps<typeof Ionicons>['name'];
type MdiName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type PhaseGlyph =
  | { type: 'mdi'; name: MdiName }
  | { type: 'packaging'; name: PackagingIconName }
  | { type: 'process'; name: ProcessIconName };

// Selectable phases, in workflow order (status dropdown and filters)
const SELECTABLE_STATUS_KINDS: [ProductionStatus, StatusKind][] = [
  ['not_authorized', 'blocked'],
  ['authorized', 'done'],
  ['waiting_to_cnc_wjet', 'waiting'],
  ['on_cutting_process', 'working'],
  ['on_polishing_process', 'working'],
  ['waiting_to_drill', 'waiting'],
  ['awaiting_film', 'waiting'],
  ['awaiting_workart', 'waiting'],
  ['burn_paper', 'instruction'],
  ['waiting_for_sandblasting', 'waiting'],
  ['sandblasting', 'working'],
  ['awaiting_oil_application', 'waiting'],
  ['awaiting_oil_drying', 'waiting'],
  ['waiting_to_paint_cabin', 'waiting'],
  ['on_paint_cabin', 'working'],
  ['waiting_for_schmelz', 'waiting'],
  ['on_schmelz_oven', 'working'],
  ['on_banding_oven', 'working'],
  ['waiting_for_tempering', 'waiting'],
  ['tempering_in_progress', 'working'],
  ['on_laminating_machine', 'working'],
  ['awaiting_inspection', 'waiting'],
  ['inspected', 'done'],
  ['waiting_for_packing', 'waiting'],
  // pack_glass_box / packed_glass_box keep their stored value but mean "cardboard box"
  ['pack_glass_box', 'instruction'],
  ['pack_glass_rack', 'instruction'],
  ['pack_pallet', 'instruction'],
  ['pack_paper', 'instruction'],
  ['packed', 'done'],
  ['packed_glass_box', 'done'],
  ['packed_glass_rack', 'done'],
  ['packed_pallet', 'done'],
  ['packed_paper', 'done'],
  ['ready_for_dispatch', 'done'],
  ['delivered', 'final'],
  ['completed', 'final'],
  ['rework_needed', 'problem'],
  ['cancelled', 'cancelled'],
];

// Old statuses still present in existing orders; shown but not selectable
const LEGACY_STATUS_KINDS: [ProductionStatus, StatusKind][] = [
  ['cutting', 'working'],
  ['polishing', 'working'],
  ['on_cabin', 'working'],
  ['laminating', 'working'],
  ['on_oven', 'working'],
  ['tempered', 'done'],
  ['laminated', 'done'],
];

export const PRODUCTION_STATUSES: ProductionStatus[] = SELECTABLE_STATUS_KINDS.map(([status]) => status);

const STATUS_KINDS = new Map<string, StatusKind>([...SELECTABLE_STATUS_KINDS, ...LEGACY_STATUS_KINDS]);

export const STATUS_KIND_ICONS: Record<StatusKind, IconName> = {
  blocked: 'lock-closed',
  problem: 'alert-circle',
  waiting: 'time-outline',
  working: 'hammer',
  instruction: 'arrow-forward-circle',
  done: 'checkmark-circle',
  final: 'flag',
  cancelled: 'close-circle',
};

interface KindColors {
  error: string;
  warning: string;
  info: string;
  primary: string;
  success: string;
  textSecondary: string;
  textTertiary: string;
}

const mdi = (name: MdiName): PhaseGlyph => ({ type: 'mdi', name });
const packaging = (name: PackagingIconName): PhaseGlyph => ({ type: 'packaging', name });
const processGlyph = (name: ProcessIconName): PhaseGlyph => ({ type: 'process', name });

// One icon per activity; waiting phases reuse the icon of the process they wait for
const PHASE_GLYPHS: Partial<Record<ProductionStatus, PhaseGlyph>> = {
  not_authorized: mdi('lock-outline'),
  authorized: mdi('check-decagram-outline'),
  waiting_to_cnc_wjet: processGlyph('waterjet'),
  on_cutting_process: mdi('saw-blade'),
  on_polishing_process: processGlyph('polish'),
  waiting_to_drill: processGlyph('drill'),
  awaiting_film: mdi('sticker-outline'),
  awaiting_workart: mdi('pencil-ruler'),
  burn_paper: mdi('fire'),
  waiting_for_sandblasting: processGlyph('sandblast'),
  sandblasting: processGlyph('sandblast'),
  awaiting_oil_application: mdi('oil'),
  awaiting_oil_drying: mdi('fan'),
  waiting_to_paint_cabin: mdi('format-paint'),
  on_paint_cabin: mdi('format-paint'),
  waiting_for_schmelz: mdi('toaster-oven'),
  on_schmelz_oven: mdi('toaster-oven'),
  on_banding_oven: mdi('stove'),
  waiting_for_tempering: mdi('thermometer-high'),
  tempering_in_progress: mdi('thermometer-high'),
  on_laminating_machine: mdi('layers-triple-outline'),
  awaiting_inspection: mdi('clipboard-search-outline'),
  inspected: mdi('clipboard-check-outline'),
  waiting_for_packing: mdi('package-variant'),
  pack_glass_box: packaging('cardboard-box'),
  pack_glass_rack: packaging('glass-rack'),
  pack_pallet: packaging('pallet'),
  pack_paper: packaging('paper-roll'),
  packed: mdi('package-variant-closed-check'),
  packed_glass_box: packaging('cardboard-box'),
  packed_glass_rack: packaging('glass-rack'),
  packed_pallet: packaging('pallet'),
  packed_paper: packaging('paper-roll'),
  ready_for_dispatch: mdi('truck-fast-outline'),
  delivered: mdi('truck-check-outline'),
  completed: mdi('flag-checkered'),
  rework_needed: mdi('restore-alert'),
  cancelled: mdi('cancel'),
  // legacy statuses
  cutting: mdi('saw-blade'),
  polishing: processGlyph('polish'),
  on_cabin: mdi('format-paint'),
  laminating: mdi('layers-triple-outline'),
  laminated: mdi('layers-triple-outline'),
  on_oven: mdi('toaster-oven'),
  tempered: mdi('thermometer-high'),
};

export const getStatusKind = (status: string): StatusKind => STATUS_KINDS.get(status) || 'waiting';

export const isWaitingStatus = (status: string): boolean => getStatusKind(status) === 'waiting';

// Color only reinforces the kind; one color per kind
export const getStatusAppearance = (
  status: string,
  colors: KindColors
): { icon: IconName; glyph?: PhaseGlyph; waiting: boolean; color: string } => {
  const kind = getStatusKind(status);
  const kindColors: Record<StatusKind, string> = {
    blocked: colors.error,
    problem: colors.error,
    waiting: colors.warning,
    working: colors.info,
    instruction: colors.primary,
    done: colors.success,
    final: colors.textSecondary,
    cancelled: colors.textTertiary,
  };
  return {
    icon: STATUS_KIND_ICONS[kind],
    glyph: PHASE_GLYPHS[status as ProductionStatus],
    waiting: kind === 'waiting',
    color: kindColors[kind],
  };
};

// Old statuses fall back to the label of the phase that replaced them
const LEGACY_LABEL_KEYS: Record<string, string> = {
  on_cabin: 'on_paint_cabin',
  laminating: 'on_laminating_machine',
  on_oven: 'on_schmelz_oven',
};

export const getStatusLabel = (t: (key: string, options?: any) => string, status: string): string => {
  const fallback = status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  const key = LEGACY_LABEL_KEYS[status] || status;
  return t(`production.status.${key}`, { defaultValue: fallback });
};
