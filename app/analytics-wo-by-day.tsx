import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { formatDate as formatDateUtil, formatTimestamp as formatTimestampUtil } from '../src/utils/date-format';
import { getWorkOrdersByDay, useAnalyticsData } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export default function AnalyticsWoByDayScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { workOrders, isLoading } = useAnalyticsData();

  const groupedDays = useMemo(() => getWorkOrdersByDay(workOrders), [workOrders]);

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
            {t('analytics.reports.woByDay.title')}
          </Text>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {groupedDays.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          groupedDays.map((day) => (
            <View key={day.date} style={[styles.dayCard, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.dayTitle, { color: colors.text }]}>{formatDateUtil(day.date)}</Text>
              <Text style={[styles.dayMeta, { color: colors.textSecondary }]}>
                {t('analytics.woByDay.started')}: {day.startedCount} | {t('analytics.woByDay.finished')}: {day.finishedCount}
              </Text>

              <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.colName, styles.headerCell, { color: colors.textSecondary }]}>{t('analytics.woByDay.workOrder')}</Text>
                <Text style={[styles.colTime, styles.headerCell, { color: colors.textSecondary }]}>{t('analytics.woByDay.start')}</Text>
                <Text style={[styles.colTime, styles.headerCell, { color: colors.textSecondary }]}>{t('analytics.woByDay.end')}</Text>
                <Text style={[styles.colDuration, styles.headerCell, { color: colors.textSecondary }]}>{t('analytics.woByDay.hours')}</Text>
              </View>

              {day.items.map((item) => (
                <View key={item.id} style={[styles.tableRow, { borderBottomColor: colors.borderLight }]}>
                  <Text style={[styles.colName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.colTime, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.startTime ? formatTimestampUtil(item.startTime).split(', ')[1] || '-' : '-'}
                  </Text>
                  <Text style={[styles.colTime, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.endTime ? formatTimestampUtil(item.endTime).split(', ')[1] || '-' : '-'}
                  </Text>
                  <Text style={[styles.colDuration, { color: colors.text }]}>{formatDuration(item.durationSeconds)}</Text>
                </View>
              ))}

              <View style={styles.dayTotals}>
                <Text style={[styles.totalText, { color: colors.text }]}>
                  {t('analytics.woByDay.dayTotal')}: {formatDuration(day.dayTotalDurationSeconds)}
                </Text>
                <Text style={[styles.totalText, { color: colors.text }]}>
                  {t('analytics.woByDay.completed')}: {day.completedCount}
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
  contentContainer: { padding: theme.spacing.lg, gap: theme.spacing.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', paddingVertical: theme.spacing.xl },
  dayCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  dayTitle: { fontSize: theme.typography.fontSize.md, fontWeight: theme.typography.fontWeight.bold },
  dayMeta: { fontSize: theme.typography.fontSize.xs, marginTop: 2, marginBottom: theme.spacing.sm },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: theme.spacing.xs, marginBottom: theme.spacing.xs },
  headerCell: { fontSize: theme.typography.fontSize.xs, fontWeight: theme.typography.fontWeight.semibold },
  tableRow: { flexDirection: 'row', paddingVertical: theme.spacing.xs, borderBottomWidth: 1 },
  colName: { flex: 2, fontSize: theme.typography.fontSize.xs, paddingRight: theme.spacing.xs },
  colTime: { flex: 1, fontSize: theme.typography.fontSize.xs },
  colDuration: { width: 56, textAlign: 'right', fontSize: theme.typography.fontSize.xs, fontWeight: theme.typography.fontWeight.medium },
  dayTotals: { marginTop: theme.spacing.sm, gap: 2 },
  totalText: { fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold },
});
