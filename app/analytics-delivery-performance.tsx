import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChartKit, ChartPlaceholder, ChartError } from '../src/components/shared/LazyChart';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getDeliveryPerformance } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsDeliveryPerformanceScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const goBack = useGoBack('/analytics');
  const { chartKit, loading: chartLoading } = useChartKit();
  const { productions, isLoading } = useAnalyticsData();
  const ProgressChart = chartKit?.ProgressChart;

  const perf = useMemo(() => getDeliveryPerformance(productions), [productions]);

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('analytics.reports.deliveryPerformance.title')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Gauge */}
        <View style={[styles.gaugeCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>{t('analytics.onTimeRate')}</Text>
          <View style={styles.gaugeCenter}>
            {chartLoading ? (
              <ChartPlaceholder />
            ) : !chartKit ? (
              <ChartError />
            ) : (
              <ProgressChart
                data={{ data: [perf.onTimePercent / 100] }}
                width={160}
                height={160}
                strokeWidth={14}
                radius={60}
                hideLegend
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: isDark ? '#1e293b' : '#ffffff',
                  backgroundGradientTo: isDark ? '#1e293b' : '#ffffff',
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                  labelColor: () => 'transparent',
                }}
              />
            )}
            <Text style={[styles.gaugePercent, { color: colors.text }]}>{perf.onTimePercent}%</Text>
          </View>
        </View>

        {/* Counters */}
        <View style={styles.countersRow}>
          <View style={[styles.counterCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <Text style={[styles.counterValue, { color: colors.text }]}>{perf.onTime}</Text>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>{t('analytics.onTime')}</Text>
          </View>
          <View style={[styles.counterCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="alert-circle" size={24} color="#ef4444" />
            <Text style={[styles.counterValue, { color: colors.text }]}>{perf.late}</Text>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>{t('analytics.late')}</Text>
          </View>
          <View style={[styles.counterCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="help-circle" size={24} color="#9ca3af" />
            <Text style={[styles.counterValue, { color: colors.text }]}>{perf.noDate}</Text>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>{t('analytics.noDate')}</Text>
          </View>
        </View>

        {/* Late orders list */}
        {perf.lateOrders.length > 0 && (
          <View style={[styles.lateCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.lateTitle, { color: colors.text }]}>
              {t('analytics.lateOrders')} ({perf.lateOrders.length})
            </Text>
            {perf.lateOrders.slice(0, 15).map((order) => (
              <View key={order.id} style={[styles.lateRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lateClient, { color: colors.text }]}>{order.clientName}</Text>
                  <Text style={[styles.lateOrder, { color: colors.textSecondary }]}>#{order.orderNumber}</Text>
                </View>
                <View style={styles.lateBadge}>
                  <Text style={styles.lateBadgeText}>-{order.daysLate}d</Text>
                </View>
              </View>
            ))}
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
  lateCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  lateTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '600', marginBottom: theme.spacing.sm },
  lateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, borderBottomWidth: 1 },
  lateClient: { fontSize: theme.typography.fontSize.sm, fontWeight: '500' },
  lateOrder: { fontSize: theme.typography.fontSize.xs },
  lateBadge: { backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  lateBadgeText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
});
