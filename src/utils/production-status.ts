import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ProductionStatus } from '../types';

// Visual meaning of a phase: the icon tells the kind, the label tells the phase
export type StatusKind = 'blocked' | 'waiting' | 'working' | 'instruction' | 'done' | 'final' | 'cancelled';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Order here is the order shown in the status dropdown and filters
export const PRODUCTION_STATUS_KINDS: Record<ProductionStatus, StatusKind> = {
  not_authorized: 'blocked',
  authorized: 'done',
  cutting: 'working',
  polishing: 'working',
  awaiting_film: 'waiting',
  awaiting_workart: 'waiting',
  burn_paper: 'instruction',
  waiting_for_sandblasting: 'waiting',
  sandblasting: 'working',
  awaiting_oil_application: 'waiting',
  awaiting_oil_drying: 'waiting',
  waiting_for_tempering: 'waiting',
  on_oven: 'working',
  tempered: 'done',
  on_cabin: 'working',
  laminating: 'working',
  laminated: 'done',
  awaiting_inspection: 'waiting',
  inspected: 'done',
  pack_glass_box: 'instruction',
  pack_pallet: 'instruction',
  pack_paper: 'instruction',
  waiting_for_packing: 'waiting',
  packed: 'done',
  ready_for_dispatch: 'done',
  delivered: 'final',
  completed: 'final',
  cancelled: 'cancelled',
};

export const PRODUCTION_STATUSES = Object.keys(PRODUCTION_STATUS_KINDS) as ProductionStatus[];

export const STATUS_KIND_ICONS: Record<StatusKind, IconName> = {
  blocked: 'lock-closed',
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

export const getStatusKind = (status: string): StatusKind =>
  PRODUCTION_STATUS_KINDS[status as ProductionStatus] || 'waiting';

// Color only reinforces the kind; one color per kind
export const getStatusAppearance = (status: string, colors: KindColors): { icon: IconName; color: string } => {
  const kind = getStatusKind(status);
  const kindColors: Record<StatusKind, string> = {
    blocked: colors.error,
    waiting: colors.warning,
    working: colors.info,
    instruction: colors.primary,
    done: colors.success,
    final: colors.textSecondary,
    cancelled: colors.textTertiary,
  };
  return { icon: STATUS_KIND_ICONS[kind], color: kindColors[kind] };
};

export const getStatusLabel = (t: (key: string, options?: any) => string, status: string): string => {
  // Fallback keeps unknown database statuses readable
  const fallback = status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return t(`production.status.${status}`, { defaultValue: fallback });
};
