import React, { useState, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/hooks/use-i18n';
import { ScreenWrapper } from '../../src/components/shared/ScreenWrapper';
import { DatePicker } from '../../src/components/shared/DatePicker';
import { PermissionGuard } from '../../src/components/shared/PermissionGuard';
import { repos } from '../../src/services/container';
import { Production, ProductionStatus } from '../../src/types';
import { theme } from '../../src/theme';
import { useThemeColors } from '../../src/hooks/use-theme-colors';
import {
  PRODUCTION_STATUSES,
  PRODUCTION_VIEWS,
  DEFAULT_FILTERS,
  ProductionView,
  ProductionFilters,
  DateField,
  PeriodPreset,
  SortOption,
  applyFilters,
  matchesView,
  sortProductions,
  countActiveFilters,
  daysUntilDue,
  formatDateKey,
  isFinished,
} from '../../src/utils/production-filters';

const PERIODS: PeriodPreset[] = ['any', 'today', 'thisWeek', 'thisMonth', 'custom'];
const DATE_FIELDS: DateField[] = ['dueDate', 'createdAt'];
const SORTS: SortOption[] = ['dueDate', 'newest', 'client'];

export default function ProductionScreen() {
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
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const loadProductions = useCallback(async () => {
    try {
      const allProductions = await repos.productionRepo.getAllProductions();
      setProductions(allProductions);
    } catch (error) {
      console.error('Error loading productions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProductions();
    }, [loadProductions])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadProductions();
  };

  // Search + filters apply to every view; chip counts reflect them
  const filtered = useMemo(
    () => applyFilters(productions, search, filters),
    [productions, search, filters]
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

  const activeFilterCount = countActiveFilters(filters);
  const hasAnyFilter = activeFilterCount > 0 || search.trim().length > 0;

  const openFilters = () => {
    setDraftFilters(filters);
    setFilterModalVisible(true);
  };

  const applyDraftFilters = () => {
    setFilters(draftFilters);
    setFilterModalVisible(false);
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

  const getStatusColor = (status: ProductionStatus): string => {
    switch (status) {
      case 'not_authorized':
        return colors.error;
      case 'authorized':
        return colors.success; // Green (most important phase)
      case 'cutting':
        return colors.info;
      case 'polishing':
        return '#06b6d4'; // Cyan
      case 'waiting_for_tempering':
        return colors.warning;
      case 'on_oven':
        return '#f59e0b'; // Amber
      case 'tempered':
        return '#8b5cf6'; // Purple
      case 'on_cabin':
        return colors.info;
      case 'laminating':
        return '#06b6d4'; // Cyan
      case 'laminated':
        return '#3b82f6'; // Blue
      case 'waiting_for_packing':
        return colors.warning;
      case 'packed':
        return '#06b6d4'; // Cyan
      case 'ready_for_dispatch':
        return '#f59e0b'; // Amber
      case 'delivered':
        return colors.success;
      case 'completed':
        return colors.success;
      default:
        return colors.textSecondary;
    }
  };

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

  const getItemsSummary = (production: Production): string => {
    if (!production.items || production.items.length === 0) return '';
    const pieces = production.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const area = production.items.reduce((sum, item) => sum + (Number(item.areaM2) || 0), 0);
    return `${t('production.dashboard.pieces', { count: pieces })} · ${area.toFixed(2)} m²`;
  };

  const renderChip = (label: string, selected: boolean, onPress: () => void, key: string, accent?: string) => (
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
            onPress={openFilters}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? colors.primary : colors.text} />
            {activeFilterCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.textInverse }]}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => router.push('/production-orders-history')}
            activeOpacity={0.7}
          >
            <Ionicons name="checkbox-outline" size={20} color={colors.text} />
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

        {hasAnyFilter && (
          <View style={styles.resultsRow}>
            <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
              {t('production.dashboard.results', { count: visibleProductions.length })}
            </Text>
            <TouchableOpacity onPress={clearAllFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.clearLink, { color: colors.primary }]}>
                {t('production.dashboard.clearFilters')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
              return (
                <TouchableOpacity
                  key={production.id}
                  style={[styles.orderCard, { backgroundColor: colors.cardBackground }]}
                  activeOpacity={0.7}
                  onPress={() => router.push({
                    pathname: '/production-detail',
                    params: { productionId: production.id },
                  })}
                >
                  <View style={[styles.cardIndicator, { backgroundColor: statusColor }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardRow}>
                      <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>
                        {production.clientName}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
                          {t(`production.status.${production.status}`)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.orderMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      #{production.orderNumber}
                      {production.orderType ? ` · ${production.orderType}` : ''}
                    </Text>
                    <View style={styles.cardRow}>
                      <View style={styles.dueRow}>
                        <Ionicons name={due.icon} size={14} color={due.color} />
                        <Text style={[styles.dueText, { color: due.color }]}>{due.label}</Text>
                      </View>
                      {itemsSummary ? (
                        <Text style={[styles.itemsText, { color: colors.textSecondary }]}>{itemsSummary}</Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.sheetContainer}>
          <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
            <View style={[styles.sheetBackdrop, { backgroundColor: colors.overlay }]} />
          </TouchableWithoutFeedback>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('production.dashboard.filters')}</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('production.dashboard.sortBy')}
              </Text>
              <View style={styles.chipWrap}>
                {SORTS.map((s) =>
                  renderChip(
                    t(`production.dashboard.sorts.${s}`),
                    draftFilters.sort === s,
                    () => setDraftFilters((prev) => ({ ...prev, sort: s })),
                    s
                  )
                )}
              </View>

              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('production.dashboard.period')}
              </Text>
              <View style={styles.segment}>
                {DATE_FIELDS.map((field) => {
                  const selected = draftFilters.dateField === field;
                  return (
                    <TouchableOpacity
                      key={field}
                      style={[
                        styles.segmentItem,
                        { borderColor: colors.border },
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
              <View style={styles.chipWrap}>
                {PERIODS.map((p) =>
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

              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('production.dashboard.status')}
              </Text>
              <View style={styles.chipWrap}>
                {PRODUCTION_STATUSES.map((status) =>
                  renderChip(
                    t(`production.status.${status}`),
                    draftFilters.statuses.includes(status),
                    () => toggleDraftStatus(status),
                    status,
                    getStatusColor(status)
                  )
                )}
              </View>
            </ScrollView>

            <View style={[styles.sheetFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.footerButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setDraftFilters(DEFAULT_FILTERS)}
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
  viewTabs: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
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
  clientName: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    maxWidth: '50%',
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
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
    fontSize: theme.typography.fontSize.xs,
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
