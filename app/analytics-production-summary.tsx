import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChartKit, ChartPlaceholder, ChartError } from '../src/components/shared/LazyChart';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getTotals, getWeeklyOrders, filterByPeriod } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

const PERIODS = [
  { key: '1', label: '1M', months: 1 },
  { key: '3', label: '3M', months: 3 },
  { key: '6', label: '6M', months: 6 },
  { key: '12', label: '1Y', months: 12 },
  { key: 'all', label: 'All', months: 0 },
];

export default function AnalyticsProductionSummaryScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const goBack = useGoBack('/analytics');
  const { chartKit, loading: chartLoading } = useChartKit();
  const { productions, isLoading } = useAnalyticsData();
  const [period, setPeriod] = useState('3');
  const BarChart = chartKit?.BarChart;

  const filtered = useMemo(() => {
    const p = PERIODS.find(p => p.key === period);
    return p && p.months > 0 ? filterByPeriod(productions, p.months) : productions;
  }, [productions, period]);

  const totals = useMemo(() => getTotals(filtered), [filtered]);
  const weekly = useMemo(() => getWeeklyOrders(filtered), [filtered]);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 64, 700);

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  const metricCards = [
    { label: t('analytics.metrics.totalOrders'), value: totals.total, icon: 'document-text' as const, color: '#6366f1' },
    { label: t('analytics.metrics.totalM2'), value: `${totals.totalM2.toFixed(1)}`, icon: 'resize' as const, color: '#10b981' },
    { label: t('analytics.metrics.totalPieces'), value: totals.totalPieces, icon: 'cube' as const, color: '#f59e0b' },
    { label: t('analytics.metrics.inProgress'), value: totals.inProgress, icon: 'sync' as const, color: '#3b82f6' },
  ];

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('analytics.reports.productionSummary.title')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Period filter */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.periodBtn,
                { backgroundColor: period === p.key ? colors.primary : colors.backgroundSecondary },
              ]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodText, { color: period === p.key ? '#fff' : colors.textSecondary }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Metric cards */}
        <View style={styles.metricsGrid}>
          {metricCards.map((m, i) => (
            <View key={i} style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
              <View style={[styles.metricIcon, { backgroundColor: `${m.color}18` }]}>
                <Ionicons name={m.icon} size={20} color={m.color} />
              </View>
              <Text style={[styles.metricValue, { color: colors.text }]}>{m.value}</Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Weekly bar chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            {t('analytics.charts.ordersPerWeek')}
          </Text>
          {weekly.data.length > 0 ? (
            chartLoading ? (
              <ChartPlaceholder />
            ) : !chartKit ? (
              <ChartError />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <BarChart
                  data={{
                    labels: weekly.labels,
                    datasets: [{ data: weekly.data }],
                  }}
                  width={Math.max(chartWidth, weekly.labels.length * 50)}
                  height={220}
                  fromZero
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: isDark ? '#1e293b' : '#ffffff',
                    backgroundGradientTo: isDark ? '#1e293b' : '#ffffff',
                    decimalPlaces: 0,
                    color: () => '#6366f1',
                    labelColor: () => isDark ? '#94a3b8' : '#6b7280',
                    barPercentage: 0.5,
                    propsForBackgroundLines: { stroke: isDark ? '#334155' : '#e5e7eb' },
                  }}
                  style={styles.chart}
                  showBarTops={false}
                />
              </ScrollView>
            )
          ) : (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, borderBottomWidth: 1 },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 44 },
  backButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  periodRow: { flexDirection: 'row', gap: theme.spacing.sm },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  periodText: { fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  metricCard: {
    flex: 1,
    minWidth: 140,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  metricIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  metricValue: { fontSize: theme.typography.fontSize.xxl, fontWeight: '700' },
  metricLabel: { fontSize: theme.typography.fontSize.xs, textAlign: 'center' },
  chartCard: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  chartTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '600', marginBottom: theme.spacing.sm },
  chart: { borderRadius: 8 },
  emptyText: { textAlign: 'center', paddingVertical: theme.spacing.xl },
});
