import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChartKit, ChartPlaceholder, ChartError } from '../src/components/shared/LazyChart';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getWorkOrderAvgServiceTime, getWorkOrderChecklistCompliance } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsWoServiceTimeScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const goBack = useGoBack('/analytics');
  const { chartKit, loading: chartLoading } = useChartKit();
  const { workOrders, isLoading } = useAnalyticsData();
  const ProgressChart = chartKit?.ProgressChart;

  const serviceTime = useMemo(() => getWorkOrderAvgServiceTime(workOrders), [workOrders]);
  const checklist = useMemo(() => getWorkOrderChecklistCompliance(workOrders), [workOrders]);

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('analytics.reports.woServiceTime.title')}</Text>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="timer" size={28} color="#3b82f6" />
          <Text style={[styles.metricValue, { color: colors.text }]}>{serviceTime.avgHours}h</Text>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{t('analytics.avgServiceTime')}</Text>
          <Text style={[styles.metricSub, { color: colors.textTertiary }]}>
            {serviceTime.count} {t('analytics.completedOrders')}
          </Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analytics.checklistCompliance')}</Text>
          <View style={styles.gaugeCenter}>
            {chartLoading ? (
              <ChartPlaceholder />
            ) : !chartKit ? (
              <ChartError />
            ) : (
              <ProgressChart
                data={{ data: [checklist.percent / 100] }}
                width={160} height={160} strokeWidth={14} radius={60} hideLegend
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: isDark ? '#1e293b' : '#ffffff',
                  backgroundGradientTo: isDark ? '#1e293b' : '#ffffff',
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                  labelColor: () => 'transparent',
                }}
              />
            )}
            <Text style={[styles.gaugePercent, { color: colors.text }]}>{checklist.percent}%</Text>
          </View>
          <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
            {checklist.checkedItems} / {checklist.totalItems} {t('analytics.itemsCompleted')}
          </Text>
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
  metricCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.lg, alignItems: 'center', gap: theme.spacing.sm, ...theme.shadows.sm },
  sectionTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  metricValue: { fontSize: 40, fontWeight: '700' },
  metricLabel: { fontSize: theme.typography.fontSize.sm, fontWeight: '500' },
  metricSub: { fontSize: theme.typography.fontSize.xs },
  gaugeCenter: { alignItems: 'center', justifyContent: 'center' },
  gaugePercent: { position: 'absolute', fontSize: 32, fontWeight: '700' },
});
