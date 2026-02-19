import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getEventsCalendar, getEventsMonthly } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsEventsCalendarScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { events, isLoading } = useAnalyticsData();

  const upcoming = useMemo(() => getEventsCalendar(events), [events]);
  const monthly = useMemo(() => getEventsMonthly(events), [events]);

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
            {t('analytics.reports.eventsCalendar.title')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="calendar" size={22} color="#6366f1" />
            <Text style={[styles.summaryValue, { color: colors.text }]}>{events.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('analytics.total')}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="time" size={22} color="#f59e0b" />
            <Text style={[styles.summaryValue, { color: colors.text }]}>{upcoming.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('analytics.upcoming')}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="stats-chart" size={22} color="#10b981" />
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {monthly.data.length > 0 ? Math.round(monthly.data.reduce((s, d) => s + d, 0) / monthly.data.length) : 0}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('analytics.avgPerMonth')}</Text>
          </View>
        </View>

        {/* Monthly bar view */}
        {monthly.labels.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>{t('analytics.charts.eventsPerMonth')}</Text>
            {monthly.labels.map((label, idx) => {
              const maxVal = Math.max(...monthly.data, 1);
              return (
                <View key={label} style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: colors.textSecondary }]}>{label}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { backgroundColor: '#6366f1', width: `${(monthly.data[idx] / maxVal) * 100}%` }]} />
                  </View>
                  <Text style={[styles.barCount, { color: colors.text }]}>{monthly.data[idx]}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Upcoming events list */}
        {upcoming.length > 0 && (
          <View style={[styles.listCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>{t('analytics.upcomingEvents')}</Text>
            {upcoming.map((ev: any) => (
              <View key={ev.id} style={[styles.eventRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.dateBadge, { backgroundColor: '#ede9fe' }]}>
                  <Text style={styles.dateDay}>{ev.startDate ? new Date(ev.startDate).getDate() : '?'}</Text>
                  <Text style={styles.dateMonth}>{ev.startDate ? new Date(ev.startDate).toLocaleString('default', { month: 'short' }) : ''}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>{ev.title}</Text>
                  <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>
                    {ev.location ? `${ev.location} · ` : ''}{ev.startTime || ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {events.length === 0 && (
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
  summaryRow: { flexDirection: 'row', gap: theme.spacing.sm },
  summaryCard: { flex: 1, alignItems: 'center', padding: theme.spacing.md, borderRadius: theme.borderRadius.md, gap: theme.spacing.xs, ...theme.shadows.sm },
  summaryValue: { fontSize: theme.typography.fontSize.xl, fontWeight: '700' },
  summaryLabel: { fontSize: theme.typography.fontSize.xs, textAlign: 'center' },
  chartCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.sm, ...theme.shadows.sm },
  chartTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  barLabel: { width: 30, fontSize: theme.typography.fontSize.xs, textAlign: 'right' },
  barTrack: { flex: 1, height: 18, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, minWidth: 3 },
  barCount: { width: 24, fontSize: theme.typography.fontSize.xs, fontWeight: '600', textAlign: 'right' },
  listCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm, borderBottomWidth: 1 },
  dateBadge: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 16, fontWeight: '700', color: '#6366f1' },
  dateMonth: { fontSize: 10, color: '#6366f1', textTransform: 'uppercase' },
  eventTitle: { fontSize: theme.typography.fontSize.sm, fontWeight: '500' },
  eventMeta: { fontSize: theme.typography.fontSize.xs },
});
