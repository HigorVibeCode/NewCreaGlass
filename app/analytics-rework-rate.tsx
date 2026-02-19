import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChartKit, ChartPlaceholder, ChartError } from '../src/components/shared/LazyChart';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getReworkRate } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsReworkRateScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const goBack = useGoBack('/analytics');
  const { chartKit, loading: chartLoading } = useChartKit();
  const { productions, isLoading } = useAnalyticsData();
  const ProgressChart = chartKit?.ProgressChart;
  const LineChart = chartKit?.LineChart;

  const rework = useMemo(() => getReworkRate(productions), [productions]);

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

  const gaugeValue = Math.min(rework.reworkPercent / 100, 1);

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('analytics.reports.reworkRate.title')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Gauge */}
        <View style={[styles.gaugeCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>
            {t('analytics.reworkCancelRate')}
          </Text>
          <View style={styles.gaugeCenter}>
            {chartLoading ? (
              <ChartPlaceholder />
            ) : !chartKit ? (
              <ChartError />
            ) : (
              <>
                <ProgressChart
                  data={{ data: [gaugeValue] }}
                  width={160}
                  height={160}
                  strokeWidth={14}
                  radius={60}
                  hideLegend
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: isDark ? '#1e293b' : '#ffffff',
                    backgroundGradientTo: isDark ? '#1e293b' : '#ffffff',
                    color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                    labelColor: () => 'transparent',
                  }}
                />
              </>
            )}
            <Text style={[styles.gaugePercent, { color: colors.text }]}>{rework.reworkPercent}%</Text>
          </View>
        </View>

        {/* Counters */}
        <View style={styles.countersRow}>
          <View style={[styles.counterCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="refresh" size={22} color="#f59e0b" />
            <Text style={[styles.counterValue, { color: colors.text }]}>{rework.rework}</Text>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>{t('analytics.rework')}</Text>
          </View>
          <View style={[styles.counterCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="close-circle" size={22} color="#ef4444" />
            <Text style={[styles.counterValue, { color: colors.text }]}>{rework.cancelled}</Text>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>{t('analytics.cancelled')}</Text>
          </View>
          <View style={[styles.counterCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="document-text" size={22} color="#6366f1" />
            <Text style={[styles.counterValue, { color: colors.text }]}>{rework.total}</Text>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>{t('analytics.total')}</Text>
          </View>
        </View>

        {/* Monthly trend */}
        {rework.monthlyTrend.length > 1 && (
          <View style={[styles.chartCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>
              {t('analytics.charts.monthlyTrend')}
            </Text>
            {chartLoading ? (
              <ChartPlaceholder />
            ) : !chartKit ? (
              <ChartError />
            ) : (
              <LineChart
                data={{
                  labels: rework.monthlyTrend.map(m => m.month),
                  datasets: [{ data: rework.monthlyTrend.map(m => m.rate || 0) }],
                }}
                width={chartWidth}
                height={180}
                fromZero
                yAxisSuffix="%"
                yAxisLabel=""
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: isDark ? '#1e293b' : '#ffffff',
                  backgroundGradientTo: isDark ? '#1e293b' : '#ffffff',
                  decimalPlaces: 0,
                  color: () => '#ef4444',
                  labelColor: () => isDark ? '#94a3b8' : '#6b7280',
                  propsForBackgroundLines: { stroke: isDark ? '#334155' : '#e5e7eb' },
                  propsForDots: { r: '5', fill: '#ef4444' },
                }}
                style={styles.chart}
                bezier
              />
            )}
          </View>
        )}
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
  gaugeCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.lg, alignItems: 'center', ...theme.shadows.sm },
  gaugeLabel: { fontSize: theme.typography.fontSize.sm, fontWeight: '600', marginBottom: theme.spacing.sm },
  gaugeCenter: { alignItems: 'center', justifyContent: 'center' },
  gaugePercent: { position: 'absolute', fontSize: 32, fontWeight: '700' },
  countersRow: { flexDirection: 'row', gap: theme.spacing.sm },
  counterCard: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  counterValue: { fontSize: theme.typography.fontSize.xl, fontWeight: '700' },
  counterLabel: { fontSize: theme.typography.fontSize.xs, textAlign: 'center' },
  chartCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  chartTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '600', marginBottom: theme.spacing.sm },
  chart: { borderRadius: 8 },
});
