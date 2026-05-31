import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getInactiveClients } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

const PERIOD_OPTIONS = [
  { key: '30', days: 30, labelKey: 'analytics.clientsMetrics.period30' },
  { key: '60', days: 60, labelKey: 'analytics.clientsMetrics.period60' },
  { key: '90', days: 90, labelKey: 'analytics.clientsMetrics.period90' },
  { key: 'all', days: 0, labelKey: 'analytics.clientsMetrics.periodAll' },
];

function formatDateLabel(value: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString();
}

export default function AnalyticsClientsInactiveScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { clients, productions, workOrders, isLoading } = useAnalyticsData();
  const [periodKey, setPeriodKey] = useState('30');

  const selectedPeriod = PERIOD_OPTIONS.find((p) => p.key === periodKey);
  const inactivityDays = selectedPeriod?.days ?? 30;
  const inactive = useMemo(
    () => getInactiveClients(clients, productions, workOrders, inactivityDays),
    [clients, productions, workOrders, inactivityDays]
  );

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
            {t('analytics.reports.clientsInactive.title')}
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

        <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {periodKey === 'all'
              ? t('analytics.clientsMetrics.inactiveHintAll')
              : t('analytics.clientsMetrics.inactiveHint', { days: inactivityDays })}
          </Text>
        </View>

        {inactive.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          inactive.map((client) => (
            <View key={client.id} style={[styles.clientCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.clientHeader}>
                <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>{client.name}</Text>
                <Text style={[styles.days, { color: '#f59e0b' }]}>
                  {client.daysWithoutActivity == null
                    ? t('analytics.clientsMetrics.never')
                    : `${client.daysWithoutActivity}d`}
                </Text>
              </View>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {t('analytics.clientsMetrics.lastActivity')}: {formatDateLabel(client.lastActivityIso)}
              </Text>
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
  periodRow: { flexDirection: 'row', gap: theme.spacing.xs },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  periodText: { fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  infoText: { fontSize: theme.typography.fontSize.xs },
  emptyText: { textAlign: 'center', paddingVertical: theme.spacing.xl },
  clientCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.xs, ...theme.shadows.sm },
  clientHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  clientName: { flex: 1, fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  days: { fontSize: theme.typography.fontSize.sm, fontWeight: '700' },
  metaText: { fontSize: theme.typography.fontSize.xs },
});
