import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getClientsOverview } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsClientsOverviewScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { clients, productions, workOrders, isLoading } = useAnalyticsData();

  const overview = useMemo(
    () => getClientsOverview(clients, productions, workOrders),
    [clients, productions, workOrders]
  );

  const activityPercent = overview.total > 0 ? Math.round((overview.withActivity / overview.total) * 100) : 0;
  const contactPercent = overview.total > 0 ? Math.round((overview.withContact / overview.total) * 100) : 0;
  const addressPercent = overview.total > 0 ? Math.round((overview.withAddress / overview.total) * 100) : 0;

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
            {t('analytics.reports.clientsOverview.title')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{overview.total}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{t('analytics.clientsMetrics.total')}</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{overview.withActivity}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{t('analytics.clientsMetrics.withActivity')}</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{overview.withoutActivity}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{t('analytics.clientsMetrics.withoutActivity')}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('analytics.clientsMetrics.activityCoverage')}</Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.progressFill, { width: `${activityPercent}%`, backgroundColor: '#3b82f6' }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>{activityPercent}%</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('analytics.clientsMetrics.dataQuality')}</Text>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{t('clients.contact')}</Text>
            <Text style={[styles.rowValue, { color: colors.text }]}>{overview.withContact} ({contactPercent}%)</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{t('clients.address')}</Text>
            <Text style={[styles.rowValue, { color: colors.text }]}>{overview.withAddress} ({addressPercent}%)</Text>
          </View>
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
  contentContainer: { padding: theme.spacing.lg, gap: theme.spacing.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  metricsGrid: { flexDirection: 'row', gap: theme.spacing.sm },
  metricCard: { flex: 1, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  metricValue: { fontSize: theme.typography.fontSize.xl, fontWeight: '700' },
  metricLabel: { fontSize: theme.typography.fontSize.xs, marginTop: 4 },
  card: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.sm, ...theme.shadows.sm },
  cardTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  progressTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  progressText: { fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: theme.typography.fontSize.sm },
  rowValue: { fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
});
