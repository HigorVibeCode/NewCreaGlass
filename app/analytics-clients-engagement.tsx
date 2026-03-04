import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getClientEngagement } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

const PERIOD_OPTIONS = [
  { key: '30', days: 30, labelKey: 'analytics.clientsMetrics.period30' },
  { key: '60', days: 60, labelKey: 'analytics.clientsMetrics.period60' },
  { key: '90', days: 90, labelKey: 'analytics.clientsMetrics.period90' },
  { key: 'all', days: 0, labelKey: 'analytics.clientsMetrics.periodAll' },
];

export default function AnalyticsClientsEngagementScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { clients, productions, workOrders, isLoading } = useAnalyticsData();
  const [periodKey, setPeriodKey] = useState('90');

  const filteredData = useMemo(() => {
    const selected = PERIOD_OPTIONS.find((p) => p.key === periodKey);
    if (!selected || selected.days <= 0) {
      return { productions, workOrders };
    }
    const cutoff = Date.now() - selected.days * 24 * 60 * 60 * 1000;
    const filteredProductions = productions.filter((p) => {
      const ts = new Date(p.createdAt).getTime();
      return !isNaN(ts) && ts >= cutoff;
    });
    const filteredWorkOrders = workOrders.filter((wo) => {
      const ref = wo.createdAt || wo.updatedAt || wo.scheduledDate;
      const ts = new Date(ref || 0).getTime();
      return !isNaN(ts) && ts >= cutoff;
    });
    return { productions: filteredProductions, workOrders: filteredWorkOrders };
  }, [productions, workOrders, periodKey]);

  const ranking = useMemo(
    () => getClientEngagement(clients, filteredData.productions, filteredData.workOrders, 12),
    [clients, filteredData]
  );
  const maxTotal = useMemo(() => Math.max(...ranking.map((r) => r.total), 1), [ranking]);

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
            {t('analytics.reports.clientsEngagement.title')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.periodBtn,
                { backgroundColor: periodKey === option.key ? colors.primary : colors.backgroundSecondary },
              ]}
              onPress={() => setPeriodKey(option.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodText, { color: periodKey === option.key ? '#fff' : colors.textSecondary }]}>
                {t(option.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {ranking.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          ranking.map((item, idx) => (
            <View key={item.id} style={[styles.clientCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.clientHeader}>
                <Text style={[styles.rank, { color: colors.textSecondary }]}>#{idx + 1}</Text>
                <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.total, { color: colors.primary }]}>{item.total}</Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={[styles.barFill, { width: `${(item.total / maxTotal) * 100}%`, backgroundColor: '#3b82f6' }]} />
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {t('analytics.clientsMetrics.productionOrders')}: {item.productionCount}
                </Text>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {t('analytics.clientsMetrics.workOrders')}: {item.workOrderCount}
                </Text>
              </View>
            </View>
          ))
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
  contentContainer: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  periodRow: { flexDirection: 'row', gap: theme.spacing.xs, marginBottom: theme.spacing.xs },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  periodText: { fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', paddingVertical: theme.spacing.xl },
  clientCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.sm, ...theme.shadows.sm },
  clientHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  rank: { fontSize: theme.typography.fontSize.xs, width: 24 },
  clientName: { flex: 1, fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  total: { fontSize: theme.typography.fontSize.lg, fontWeight: '700' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  metaText: { fontSize: theme.typography.fontSize.xs },
});
