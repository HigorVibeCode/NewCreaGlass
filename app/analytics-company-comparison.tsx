import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChartKit, ChartPlaceholder, ChartError } from '../src/components/shared/LazyChart';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getCompanyComparison, filterByPeriod } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

const PERIODS = [
  { key: '3', label: '3M', months: 3 },
  { key: '6', label: '6M', months: 6 },
  { key: '12', label: '1Y', months: 12 },
  { key: 'all', label: 'All', months: 0 },
];

export default function AnalyticsCompanyComparisonScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const goBack = useGoBack('/analytics');
  const { chartKit, loading: chartLoading } = useChartKit();
  const { productions, isLoading } = useAnalyticsData();
  const [period, setPeriod] = useState('all');
  const BarChart = chartKit?.BarChart;

  const filtered = useMemo(() => {
    const p = PERIODS.find(p => p.key === period);
    return p && p.months > 0 ? filterByPeriod(productions, p.months) : productions;
  }, [productions, period]);

  const comparison = useMemo(() => getCompanyComparison(filtered), [filtered]);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 64, 500);

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  const chartData = {
    labels: ['3S', 'Crea Glass'],
    datasets: [{ data: [comparison['3S']?.orders || 0, comparison['Crea Glass']?.orders || 0] }],
  };

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('analytics.reports.companyComparison.title')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodBtn, { backgroundColor: period === p.key ? colors.primary : colors.backgroundSecondary }]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodText, { color: period === p.key ? '#fff' : colors.textSecondary }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.chartCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>{t('analytics.charts.ordersByCompany')}</Text>
          {chartLoading ? (
            <ChartPlaceholder />
          ) : !chartKit ? (
            <ChartError />
          ) : (
            <BarChart
              data={chartData}
              width={chartWidth}
              height={200}
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
                barPercentage: 0.6,
                propsForBackgroundLines: { stroke: isDark ? '#334155' : '#e5e7eb' },
              }}
              style={styles.chart}
              showBarTops={false}
            />
          )}
        </View>

        {/* Detail cards */}
        {Object.entries(comparison).map(([company, data]) => (
          <View key={company} style={[styles.companyCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.companyHeader}>
              <Ionicons name="business" size={20} color={company === '3S' ? '#f59e0b' : '#6366f1'} />
              <Text style={[styles.companyName, { color: colors.text }]}>{company}</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>{data.orders}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('analytics.metrics.totalOrders')}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>{data.m2.toFixed(1)}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>m²</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>{data.pieces}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('analytics.pieces')}</Text>
              </View>
            </View>
          </View>
        ))}
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
  chartCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  chartTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '600', marginBottom: theme.spacing.sm },
  chart: { borderRadius: 8 },
  companyCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.md, ...theme.shadows.sm },
  companyHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  companyName: { fontSize: theme.typography.fontSize.lg, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: theme.typography.fontSize.xl, fontWeight: '700' },
  statLabel: { fontSize: theme.typography.fontSize.xs },
});
