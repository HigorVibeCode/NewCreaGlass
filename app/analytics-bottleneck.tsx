import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getBottleneckData } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsBottleneckScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const goBack = useGoBack('/analytics');
  const { statusHistories, isLoading } = useAnalyticsData();

  const bottleneck = useMemo(() => getBottleneckData(statusHistories), [statusHistories]);
  const maxHours = useMemo(() => Math.max(...bottleneck.entries.map(e => e.avgHours), 1), [bottleneck]);

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
            {t('analytics.reports.bottleneck.title')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('analytics.reports.bottleneck.subtitle')}
        </Text>

        {bottleneck.entries.length > 0 && (
          <View style={[styles.avgCard, { backgroundColor: colors.cardBackground }]}>
            <Ionicons name="speedometer" size={20} color={colors.primary} />
            <Text style={[styles.avgText, { color: colors.text }]}>
              {t('analytics.avgTime')}: {bottleneck.overallAvg.toFixed(1)}h
            </Text>
          </View>
        )}

        {bottleneck.entries.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          <View style={styles.barsContainer}>
            {bottleneck.entries.map((entry) => {
              const isAboveAvg = entry.avgHours > bottleneck.overallAvg;
              const barColor = isAboveAvg ? '#ef4444' : '#10b981';
              return (
                <View key={entry.status} style={[styles.entryCard, { backgroundColor: colors.cardBackground }]}>
                  <View style={styles.entryHeader}>
                    <Text style={[styles.entryLabel, { color: colors.text }]} numberOfLines={1}>
                      {t(`production.status.${entry.status}`, { defaultValue: entry.status.replace(/_/g, ' ') })}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {isAboveAvg && <Ionicons name="alert-circle" size={14} color="#ef4444" />}
                      <Text style={[styles.entryHours, { color: barColor }]}>
                        {entry.avgHours}h
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}>
                    <View
                      style={[styles.barFill, { backgroundColor: barColor, width: `${(entry.avgHours / maxHours) * 100}%` }]}
                    />
                  </View>
                  <Text style={[styles.entryCount, { color: colors.textTertiary }]}>
                    {entry.count} {t('analytics.transitions')}
                  </Text>
                </View>
              );
            })}
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
  contentContainer: { padding: theme.spacing.lg, gap: theme.spacing.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  subtitle: { fontSize: theme.typography.fontSize.sm },
  emptyText: { textAlign: 'center', paddingVertical: theme.spacing.xl },
  avgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  avgText: { fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  barsContainer: { gap: theme.spacing.sm },
  entryCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.xs, ...theme.shadows.sm },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryLabel: { flex: 1, fontSize: theme.typography.fontSize.sm, fontWeight: '500', textTransform: 'capitalize' },
  entryHours: { fontSize: theme.typography.fontSize.md, fontWeight: '700' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  entryCount: { fontSize: theme.typography.fontSize.xs },
});
