import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChartKit, ChartPlaceholder, ChartError } from '../src/components/shared/LazyChart';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getEventsByType, getPieColor } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsEventsByTypeScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const goBack = useGoBack('/analytics');
  const { chartKit, loading: chartLoading } = useChartKit();
  const { events, isLoading } = useAnalyticsData();
  const PieChart = chartKit?.PieChart;

  const byType = useMemo(() => getEventsByType(events), [events]);
  const pieData = useMemo(() => byType.slice(0, 8).map((item, idx) => ({
    name: item.type.replace(/_/g, ' '),
    population: item.count,
    color: getPieColor(idx),
    legendFontColor: isDark ? '#94a3b8' : '#6b7280',
    legendFontSize: 11,
  })), [byType, isDark]);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 48, 700);

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('analytics.reports.eventsByType.title')}</Text>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {byType.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          <>
            <View style={[styles.chartCard, { backgroundColor: colors.cardBackground }]}>
              {chartLoading ? (
                <ChartPlaceholder />
              ) : !chartKit ? (
                <ChartError />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <PieChart data={pieData} width={Math.max(chartWidth, 350)} height={220}
                    chartConfig={{ color: () => '#6366f1', labelColor: () => isDark ? '#94a3b8' : '#6b7280' }}
                    accessor="population" backgroundColor="transparent" paddingLeft="15" absolute />
                </ScrollView>
              )}
            </View>
            <View style={styles.legendList}>
              {byType.map((item, idx) => (
                <View key={item.type} style={[styles.legendCard, { backgroundColor: colors.cardBackground }]}>
                  <View style={[styles.legendDot, { backgroundColor: getPieColor(idx) }]} />
                  <Text style={[styles.legendType, { color: colors.text }]}>{item.type.replace(/_/g, ' ')}</Text>
                  <Text style={[styles.legendCount, { color: colors.text }]}>{item.count}</Text>
                  <Text style={[styles.legendPercent, { color: colors.textSecondary }]}>{item.percent}%</Text>
                </View>
              ))}
            </View>
          </>
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
  chartCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  legendList: { gap: theme.spacing.xs },
  legendCard: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.sm, borderRadius: theme.borderRadius.sm, gap: theme.spacing.sm, ...theme.shadows.sm },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendType: { flex: 1, fontSize: theme.typography.fontSize.sm, fontWeight: '500', textTransform: 'capitalize' },
  legendCount: { fontSize: theme.typography.fontSize.md, fontWeight: '700' },
  legendPercent: { fontSize: theme.typography.fontSize.xs, width: 36, textAlign: 'right' },
});
