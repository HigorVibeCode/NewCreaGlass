import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/hooks/use-i18n';
import { ScreenWrapper } from '../../src/components/shared/ScreenWrapper';
import { DatePicker } from '../../src/components/shared/DatePicker';
import { Dropdown, DropdownOption } from '../../src/components/shared/Dropdown';
import { PermissionGuard } from '../../src/components/shared/PermissionGuard';
import { ProductionStatusBadge } from '../../src/components/shared/ProductionStatusBadge';
import { StatusIcon } from '../../src/components/shared/StatusIcon';
import { getStatusAppearance, getStatusLabel as getStatusLabelFor, isWaitingStatus } from '../../src/utils/production-status';
import { repos } from '../../src/services/container';
import { supabase } from '../../src/services/supabase';
import { Production, ProductionCompany, ProductionStatus, InventoryItem } from '../../src/types';
import { theme } from '../../src/theme';
import { useThemeColors } from '../../src/hooks/use-theme-colors';
import { pushWithParams } from '../../src/utils/navigation';
import { formatDate } from '../../src/utils/date-format';
import {
  PRODUCTION_STATUSES,
  PRODUCTION_VIEWS,
  PERIOD_PRESETS,
  SORT_OPTIONS,
  DEFAULT_FILTERS,
  ProductionView,
  ProductionFilters,
  DateField,
  applyFilters,
  matchesView,
  sortProductions,
  isDefaultFilters,
  countSheetFilters,
  daysUntilDue,
  formatDateKey,
  isFinished,
} from '../../src/utils/production-filters';

// Alert levels for waiting status cards
// 0 = no alert, 1 = >8h slow pulse, 2 = >24h pulse+darker, 3 = >48h pulse+alert
type WaitingAlertLevel = 0 | 1 | 2 | 3;


/** Compute alert level based on hours waiting */
function getAlertLevel(hours: number): WaitingAlertLevel {
  if (hours > 48) return 3;
  if (hours > 24) return 2;
  if (hours > 8) return 1;
  return 0;
}

/** Pulse speed per alert level (ms per half-cycle) */
function getPulseDuration(level: WaitingAlertLevel): number {
  switch (level) {
    case 1: return 1800; // slow
    case 2: return 1200; // medium
    case 3: return 800;  // fast
    default: return 1800;
  }
}

/** Color for pulse — always the same vivid yellow */
function getPulseColor(_level: WaitingAlertLevel): string {
  return '#eab308'; // yellow-500 vivid for all levels
}

/** Animated wrapper that adds a pulse glow effect for waiting cards */
function WaitingPulseCard({ children, alertLevel }: { children: React.ReactNode; alertLevel: WaitingAlertLevel }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (alertLevel > 0) {
      const duration = getPulseDuration(alertLevel);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [alertLevel]);

  if (alertLevel === 0) {
    return <>{children}</>;
  }

  const color = getPulseColor(alertLevel);

  const borderColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [`${color}00`, `${color}90`],
  });

  const shadowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, alertLevel >= 2 ? 0.5 : 0.3],
  });

  return (
    <Animated.View
      style={{
        borderRadius: theme.borderRadius.md,
        borderWidth: alertLevel >= 2 ? 2 : 1.5,
        borderColor,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity,
        shadowRadius: alertLevel >= 3 ? 12 : 8,
        elevation: alertLevel >= 2 ? 6 : 4,
      }}
    >
      {children}
    </Animated.View>
  );
}

const DATE_FIELDS: DateField[] = ['createdAt', 'dueDate'];
const COMPANIES: ProductionCompany[] = ['3S', 'Crea Glass'];

type FilterSheet = 'period' | 'sort' | 'status';

const MAX_GLASS_LINES = 3;

export default function ProductionScreen() {
  'use no memo';
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const [productions, setProductions] = useState<Production[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [view, setView] = useState<ProductionView>('active');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ProductionFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ProductionFilters>(DEFAULT_FILTERS);
  const [activeSheet, setActiveSheet] = useState<FilterSheet | null>(null);
  const [glassItems, setGlassItems] = useState<Map<string, InventoryItem>>(new Map());
  const [waitingHoursMap, setWaitingHoursMap] = useState<Map<string, number>>(new Map());
  const isFocused = useIsFocused();

  const loadProductions = useCallback(async () => {
    try {
      const fetchedProductions = await repos.productionRepo.getAllProductions();
      setProductions(fetchedProductions);

      const glassIds = new Set<string>();
      fetchedProductions.forEach((prod) => {
        prod.items.forEach((item) => {
          if (item.glassId) glassIds.add(item.glassId);
        });
      });

      const waitingProds = fetchedProductions.filter((p) => isWaitingStatus(p.status));
      const waitingIds = waitingProds.map((p) => p.id);

      const [fetchedGlass, historyResult] = await Promise.all([
        glassIds.size > 0
          ? repos.inventoryRepo.getItemsByIds(Array.from(glassIds))
          : Promise.resolve([] as InventoryItem[]),
        waitingIds.length > 0
          ? supabase
              .from('production_status_history')
              .select('production_id, changed_at')
              .in('production_id', waitingIds)
              .order('changed_at', { ascending: false })
          : Promise.resolve({ data: null }),
      ]);

      const glassMap = new Map<string, InventoryItem>();
      fetchedGlass.forEach((item) => glassMap.set(item.id, item));
      setGlassItems(glassMap);

      // Hours since the order entered its current waiting phase
      const latestChangeMap = new Map<string, string>();
      for (const entry of historyResult.data || []) {
        if (!latestChangeMap.has(entry.production_id)) {
          latestChangeMap.set(entry.production_id, entry.changed_at);
        }
      }
      const now = Date.now();
      const hoursMap = new Map<string, number>();
      for (const prod of waitingProds) {
        const timestamp = latestChangeMap.get(prod.id) || prod.createdAt;
        if (timestamp) {
          hoursMap.set(prod.id, (now - new Date(timestamp).getTime()) / (1000 * 60 * 60));
        }
      }
      setWaitingHoursMap(hoursMap);
    } catch (error) {
      console.error('Error loading productions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      // Always enter the screen with default filters (last 30 days, active orders)
      setFilters(DEFAULT_FILTERS);
      setView('active');
      setSearch('');
      loadProductions();
    }
  }, [isFocused, loadProductions]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadProductions();
  };

  // Search + filters apply to every view; chip counts reflect them
  const filtered = useMemo(
    () => applyFilters(productions, search, filters, (glassId) => glassItems.get(glassId)?.name),
    [productions, search, filters, glassItems]
  );

  const viewCounts = useMemo(() => {
    const counts = {} as Record<ProductionView, number>;
    PRODUCTION_VIEWS.forEach((v) => {
      counts[v] = filtered.filter((p) => matchesView(p, v)).length;
    });
    return counts;
  }, [filtered]);

  const visibleProductions = useMemo(
    () => sortProductions(filtered.filter((p) => matchesView(p, view)), filters.sort),
    [filtered, view, filters.sort]
  );

  const sheetFilterCount = countSheetFilters(filters);

  const glassOptions: DropdownOption[] = useMemo(() => {
    const usedGlassIds = new Set<string>();
    productions.forEach((production) => {
      production.items.forEach((item) => {
        if (item.glassId) usedGlassIds.add(item.glassId);
      });
    });
    const options = Array.from(usedGlassIds)
      .map((glassId) => {
        const glass = glassItems.get(glassId);
        return glass ? { label: glass.name, value: glass.id } : null;
      })
      .filter((option): option is DropdownOption => option !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ label: t('production.dashboard.allGlass'), value: 'all' }, ...options];
  }, [productions, glassItems, t]);
  const hasAnyFilter = !isDefaultFilters(filters) || search.trim().length > 0;

  const openSheet = (sheet: FilterSheet) => {
    setDraftFilters(filters);
    setActiveSheet(sheet);
  };

  const closeSheet = () => setActiveSheet(null);

  const applyDraftFilters = () => {
    setFilters(draftFilters);
    setActiveSheet(null);
  };

  // Clear only the section being edited
  const clearDraftSection = () => {
    setDraftFilters((prev) =>
      activeSheet === 'status'
        ? { ...prev, statuses: [], company: 'all', glassId: 'all' }
        : {
            ...prev,
            dateField: DEFAULT_FILTERS.dateField,
            period: DEFAULT_FILTERS.period,
            customFrom: '',
            customTo: '',
          }
    );
  };

  const getPeriodLabel = (): string => {
    if (filters.period === 'custom') {
      const from = filters.customFrom ? formatDateKey(filters.customFrom) : '…';
      const to = filters.customTo ? formatDateKey(filters.customTo) : '…';
      return `${from} – ${to}`;
    }
    return t(`production.dashboard.periodsShort.${filters.period}`);
  };

  const clearAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearch('');
  };

  const toggleDraftStatus = (status: ProductionStatus) => {
    setDraftFilters((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status],
    }));
  };

  const getStatusLabel = (status: string) => getStatusLabelFor(t, status);
  const getStatusColor = (status: string) => getStatusAppearance(status, colors).color;

  const getDueInfo = (production: Production): { label: string; color: string; icon: 'alert-circle' | 'time-outline' | 'calendar-outline' } => {
    const dateLabel = formatDateKey(production.dueDate);
    const days = daysUntilDue(production);
    if (isFinished(production.status) || days === null || days > 2) {
      return { label: dateLabel, color: colors.textSecondary, icon: 'calendar-outline' };
    }
    if (days < 0) {
      return { label: t('production.dashboard.overdueBy', { count: -days }), color: colors.error, icon: 'alert-circle' };
    }
    if (days === 0) {
      return { label: t('production.dashboard.dueToday'), color: colors.warning, icon: 'time-outline' };
    }
    if (days === 1) {
      return { label: t('production.dashboard.dueTomorrow'), color: colors.warning, icon: 'time-outline' };
    }
    return { label: dateLabel, color: colors.warning, icon: 'time-outline' };
  };

  // Compact date for the card corner: "1 Oct", or "1 Oct 25" outside the current year
  const formatCardDate = (value: string): string => {
    const full = formatDate(value);
    const year = String(new Date().getFullYear());
    return full.endsWith(` ${year}`) ? full.slice(0, -(year.length + 1)) : full.replace(/ (\d{2})(\d{2})$/, ' $2');
  };

  const getItemsSummary = (production: Production): string => {
    if (!production.items || production.items.length === 0) return '';
    const pieces = production.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const area = production.items.reduce((sum, item) => sum + (Number(item.areaM2) || 0), 0);
    return `${t('production.dashboard.pieces', { count: pieces })} · ${area.toFixed(2)} m²`;
  };

  // Same glass + type merged into one line with summed quantity
  const getGlassLines = (production: Production) => {
    const lines = new Map<string, { quantity: number; name: string; type: string }>();
    (production.items || []).forEach((item) => {
      const key = `${item.glassId}|${item.glassType}`;
      const line = lines.get(key);
      if (line) {
        line.quantity += Number(item.quantity) || 0;
      } else {
        lines.set(key, {
          quantity: Number(item.quantity) || 0,
          name: glassItems.get(item.glassId)?.name || '',
          type: item.glassType
            ? t(`production.glassTypes.${item.glassType}`, { defaultValue: item.glassType })
            : '',
        });
      }
    });
    return Array.from(lines.values());
  };

  const renderChip = (
    label: string,
    selected: boolean,
    onPress: () => void,
    key: string,
    accent?: string,
    icon?: React.ReactNode
  ) => (
    <TouchableOpacity
      key={key}
      style={[
        styles.chip,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
        selected && { backgroundColor: (accent || colors.primary) + '20', borderColor: accent || colors.primary },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon}
      <Text
        style={[
          styles.chipText,
          { color: colors.text },
          selected && { color: accent || colors.primary, fontWeight: theme.typography.fontWeight.semibold },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <View style={[styles.searchBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder={t('production.dashboard.searchPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              returnKeyType="search"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => openSheet('status')}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={20} color={sheetFilterCount > 0 ? colors.primary : colors.text} />
            {sheetFilterCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.textInverse }]}>{sheetFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => router.push('/clients')}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <PermissionGuard permission="production.create">
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/production-create')}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={22} color={colors.textInverse} />
            </TouchableOpacity>
          </PermissionGuard>
        </View>

        <View style={styles.quickBar}>
          <TouchableOpacity
            style={[styles.quickButton, styles.quickButtonWide, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={() => openSheet('period')}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={[styles.quickButtonText, { color: colors.text }]} numberOfLines={1}>
              {getPeriodLabel()}
              {filters.period !== 'any' && filters.dateField !== DEFAULT_FILTERS.dateField && (
                <Text style={{ color: colors.textSecondary }}>
                  {` · ${t(`production.dashboard.dateFields.${filters.dateField}`)}`}
                </Text>
              )}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={() => openSheet('sort')}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical" size={16} color={colors.primary} />
            <Text style={[styles.quickButtonText, { color: colors.text }]} numberOfLines={1}>
              {t(`production.dashboard.sortsShort.${filters.sort}`)}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.viewTabs}
        >
          {PRODUCTION_VIEWS.map((v) => {
            const selected = view === v;
            const accent = v === 'overdue' && viewCounts.overdue > 0 ? colors.error : colors.primary;
            return (
              <TouchableOpacity
                key={v}
                style={[
                  styles.viewTab,
                  { backgroundColor: colors.backgroundSecondary },
                  selected && { backgroundColor: accent },
                ]}
                onPress={() => setView(v)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.viewTabText,
                    { color: v === 'overdue' && viewCounts.overdue > 0 ? colors.error : colors.text },
                    selected && { color: colors.textInverse },
                  ]}
                >
                  {t(`production.dashboard.views.${v}`)}
                </Text>
                <View
                  style={[
                    styles.viewTabCount,
                    { backgroundColor: selected ? colors.textInverse + '30' : colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.viewTabCountText,
                      { color: selected ? colors.textInverse : colors.textSecondary },
                    ]}
                  >
                    {viewCounts[v]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.resultsRow}>
          <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
            {t('production.dashboard.results', { count: visibleProductions.length })}
          </Text>
          {hasAnyFilter && (
            <TouchableOpacity onPress={clearAllFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.clearLink, { color: colors.primary }]}>
                {t('production.dashboard.clearFilters')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : visibleProductions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="file-tray-outline" size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {hasAnyFilter ? t('production.dashboard.noResults') : t('production.noOrders')}
            </Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {visibleProductions.map((production) => {
              const statusColor = getStatusColor(production.status);
              const due = getDueInfo(production);
              const itemsSummary = getItemsSummary(production);
              const glassLines = getGlassLines(production);
              const waitingHours = isWaitingStatus(production.status) ? waitingHoursMap.get(production.id) || 0 : 0;
              const alertLevel: WaitingAlertLevel = waitingHours > 0 ? getAlertLevel(waitingHours) : 0;
              return (
                <WaitingPulseCard key={production.id} alertLevel={alertLevel}>
                <TouchableOpacity
                  style={[styles.orderCard, { backgroundColor: colors.cardBackground }]}
                  activeOpacity={0.7}
                  onPress={() => pushWithParams(router, '/production-detail', { productionId: production.id })}
                >
                  <View style={[styles.cardIndicator, { backgroundColor: statusColor }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>
                        {production.clientName}
                      </Text>
                      <View style={styles.cardDates}>
                        <Text style={[styles.cardDatesText, { color: colors.textTertiary }]}>
                          {formatCardDate(production.createdAt)}
                        </Text>
                        <Ionicons name="arrow-forward" size={10} color={colors.textTertiary} />
                        <Text style={[styles.cardDatesText, { color: colors.textSecondary }]}>
                          {formatCardDate(production.dueDate)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.orderMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      #{production.orderNumber}
                      {production.orderType ? ` · ${production.orderType}` : ''}
                    </Text>
                    <ProductionStatusBadge
                      status={production.status}
                      style={styles.statusBadge}
                      trailing={
                        waitingHours > 0 ? (
                          <Text style={[styles.waitingTime, { color: statusColor }]}>
                            {' · '}
                            {waitingHours >= 24
                              ? `${Math.floor(waitingHours / 24)}d ${Math.floor(waitingHours % 24)}h`
                              : `${Math.floor(waitingHours)}h`}
                          </Text>
                        ) : null
                      }
                    />
                    {glassLines.length > 0 && (
                      <View style={[styles.glassList, { borderColor: colors.borderLight }]}>
                        {glassLines.slice(0, MAX_GLASS_LINES).map((line, index) => (
                          <View key={index} style={styles.glassLine}>
                            <Text style={[styles.glassQty, { color: colors.text }]}>{line.quantity}×</Text>
                            <Text style={[styles.glassName, { color: colors.text }]} numberOfLines={1}>
                              {line.name || line.type || '-'}
                              {line.name && line.type ? (
                                <Text style={{ color: colors.textSecondary }}>{` · ${line.type}`}</Text>
                              ) : null}
                            </Text>
                          </View>
                        ))}
                        {glassLines.length > MAX_GLASS_LINES && (
                          <Text style={[styles.glassMore, { color: colors.textSecondary }]}>
                            {t('production.dashboard.moreGlass', { count: glassLines.length - MAX_GLASS_LINES })}
                          </Text>
                        )}
                      </View>
                    )}
                    <View style={styles.cardRow}>
                      <View style={styles.dueRow}>
                        <Ionicons name={due.icon} size={14} color={due.color} />
                        <Text style={[styles.dueText, { color: due.color }]}>{due.label}</Text>
                      </View>
                      {itemsSummary ? (
                        <Text style={[styles.itemsText, { color: colors.text }]}>{itemsSummary}</Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
                </WaitingPulseCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={activeSheet !== null}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <View style={styles.sheetContainer}>
          <TouchableWithoutFeedback onPress={closeSheet}>
            <View style={[styles.sheetBackdrop, { backgroundColor: colors.overlay }]} />
          </TouchableWithoutFeedback>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {activeSheet === 'period'
                  ? t('production.dashboard.period')
                  : activeSheet === 'sort'
                    ? t('production.dashboard.sortBy')
                    : t('production.dashboard.filters')}
              </Text>
              <TouchableOpacity onPress={closeSheet}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
              {activeSheet === 'sort' &&
                SORT_OPTIONS.map((s) => {
                  const selected = filters.sort === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.optionRow, { borderBottomColor: colors.borderLight }]}
                      onPress={() => {
                        // Sorting applies immediately, no confirm step
                        setFilters((prev) => ({ ...prev, sort: s }));
                        closeSheet();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.optionRowText,
                          { color: selected ? colors.primary : colors.text },
                          selected && { fontWeight: theme.typography.fontWeight.semibold },
                        ]}
                      >
                        {t(`production.dashboard.sorts.${s}`)}
                      </Text>
                      {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}

              {activeSheet === 'period' && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('production.dashboard.dateField')}
                  </Text>
                  <View style={styles.segment}>
                    {DATE_FIELDS.map((field, index) => {
                      const selected = draftFilters.dateField === field;
                      return (
                        <TouchableOpacity
                          key={field}
                          style={[
                            styles.segmentItem,
                            { borderColor: colors.border },
                            index === 0 ? styles.segmentFirst : styles.segmentLast,
                            selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          onPress={() => setDraftFilters((prev) => ({ ...prev, dateField: field }))}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.segmentText, { color: selected ? colors.textInverse : colors.text }]}>
                            {t(`production.dashboard.dateFields.${field}`)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('production.dashboard.period')}
                  </Text>
                  <View style={styles.chipWrap}>
                    {PERIOD_PRESETS.map((p) =>
                      renderChip(
                        t(`production.dashboard.periods.${p}`),
                        draftFilters.period === p,
                        () => setDraftFilters((prev) => ({ ...prev, period: p })),
                        p
                      )
                    )}
                  </View>
                  {draftFilters.period === 'custom' && (
                    <View style={styles.customRange}>
                      <View style={styles.customRangeItem}>
                        <DatePicker
                          label={t('production.dashboard.from')}
                          value={draftFilters.customFrom}
                          onSelect={(date) => setDraftFilters((prev) => ({ ...prev, customFrom: date }))}
                        />
                      </View>
                      <View style={styles.customRangeItem}>
                        <DatePicker
                          label={t('production.dashboard.to')}
                          value={draftFilters.customTo}
                          onSelect={(date) => setDraftFilters((prev) => ({ ...prev, customTo: date }))}
                        />
                      </View>
                    </View>
                  )}
                </>
              )}

              {activeSheet === 'status' && (
                <>
                <Dropdown
                  label={t('production.dashboard.glass')}
                  value={draftFilters.glassId}
                  options={glassOptions}
                  onSelect={(value) => setDraftFilters((prev) => ({ ...prev, glassId: value }))}
                />
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {t('production.dashboard.company')}
                </Text>
                <View style={styles.chipWrap}>
                  {renderChip(
                    t('production.allCompanies'),
                    draftFilters.company === 'all',
                    () => setDraftFilters((prev) => ({ ...prev, company: 'all' })),
                    'company-all'
                  )}
                  {COMPANIES.map((company) =>
                    renderChip(
                      company,
                      draftFilters.company === company,
                      () => setDraftFilters((prev) => ({ ...prev, company })),
                      `company-${company}`
                    )
                  )}
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {t('production.dashboard.status')}
                </Text>
                <View style={styles.chipWrap}>
                  {PRODUCTION_STATUSES.map((status) =>
                    renderChip(
                      getStatusLabel(status),
                      draftFilters.statuses.includes(status),
                      () => toggleDraftStatus(status),
                      status,
                      getStatusColor(status),
                      <StatusIcon status={status} size={14} />
                    )
                  )}
                </View>
                </>
              )}
            </ScrollView>

            {activeSheet !== 'sort' && (
              <View style={[styles.sheetFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.footerButton, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={clearDraftSection}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.footerButtonText, { color: colors.text }]}>
                    {t('production.dashboard.clear')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.footerButton, styles.footerButtonPrimary, { backgroundColor: colors.primary }]}
                  onPress={applyDraftFilters}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.footerButtonText, { color: colors.textInverse }]}>
                    {t('production.dashboard.apply')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    gap: theme.spacing.xs,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: theme.typography.fontSize.sm,
    paddingVertical: 0,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.bold,
  },
  quickBar: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    gap: 6,
    flexShrink: 1,
  },
  quickButtonWide: {
    flexGrow: 1,
  },
  quickButtonText: {
    flexShrink: 1,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  viewTabs: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  viewTab: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs,
  },
  viewTabText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  viewTabCount: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewTabCountText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.spacing.sm,
  },
  resultsText: {
    fontSize: theme.typography.fontSize.sm,
  },
  clearLink: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
  ordersList: {
    gap: theme.spacing.sm,
  },
  orderCard: {
    flexDirection: 'row',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  cardIndicator: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  cardDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  cardDatesText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  clientName: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  orderMeta: {
    fontSize: theme.typography.fontSize.sm,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  itemsText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  glassList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: theme.spacing.xs,
    marginVertical: 2,
    gap: 2,
  },
  glassLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  glassQty: {
    minWidth: 28,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  glassName: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
  },
  glassMore: {
    fontSize: theme.typography.fontSize.xs,
    marginLeft: 32,
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    ...theme.shadows.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: theme.spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: theme.typography.fontSize.sm,
  },
  segment: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
  },
  segmentFirst: {
    borderTopLeftRadius: theme.borderRadius.sm,
    borderBottomLeftRadius: theme.borderRadius.sm,
  },
  segmentLast: {
    borderTopRightRadius: theme.borderRadius.sm,
    borderBottomRightRadius: theme.borderRadius.sm,
    borderLeftWidth: 0,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    borderBottomWidth: 1,
  },
  optionRowText: {
    fontSize: theme.typography.fontSize.md,
  },
  waitingTime: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  segmentText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  customRange: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  customRangeItem: {
    flex: 1,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerButtonPrimary: {
    flex: 2,
  },
  footerButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
