import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChartKit, ChartPlaceholder, ChartError } from '../src/components/shared/LazyChart';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getEventsMonthly } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsEventsFrequencyScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const goBack = useGoBack('/analytics');
  const { chartKit, loading: chartLoading } = useChartKit();
  const { events, isLoading } = useAnalyticsData();
  const LineChart = chartKit?.LineChart;

  const monthly = useMemo(() => getEventsMonthly(events), [events]);
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 64, 600);

  if (isLoading) {
    return (<ScreenWrapper><View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View></ScreenWrapper>);
  }

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('analytics.reports.eventsFrequency.title')}</Text>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.totalCard, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="calendar" size={22} color="#6366f1" />
          <Text style={[styles.totalText, { color: colors.text }]}>{events.length} {t('analytics.totalEvents')}</Text>
        </View>
        {monthly.labels.length > 1 ? (
          <View style={[styles.chartCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>{t('analytics.charts.eventsPerMonth')}</Text>
            {chartLoading ? (
              <ChartPlaceholder />
            ) : !chartKit ? (
              <ChartError />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <LineChart
                  data={{ labels: monthly.labels, datasets: [{ data: monthly.data.length > 0 ? monthly.data : [0] }] }}
                  width={Math.max(chartWidth, monthly.labels.length * 50)}
                  height={220} fromZero yAxisLabel="" yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: isDark ? '#1e293b' : '#ffffff',
                    backgroundGradientTo: isDark ? '#1e293b' : '#ffffff',
                    decimalPlaces: 0,
                    color: () => '#6366f1',
                    labelColor: () => isDark ? '#94a3b8' : '#6b7280',
                    propsForBackgroundLines: { stroke: isDark ? '#334155' : '#e5e7eb' },
                    propsForDots: { r: '5', fill: '#6366f1' },
                  }}
                  style={styles.chart} bezier />
              </ScrollView>
            )}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
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
  emptyText: { textAlign: 'center', paddingVertical: theme.spacing.xl },
  totalCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, ...theme.shadows.sm },
  totalText: { fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  chartCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  chartTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '600', marginBottom: theme.spacing.sm },
  chart: { borderRadius: 8 },
});
