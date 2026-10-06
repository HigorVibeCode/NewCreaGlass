import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getStatusPipeline } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsStatusPipelineScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { productions, isLoading } = useAnalyticsData();

  const pipeline = useMemo(() => getStatusPipeline(productions), [productions]);
  const maxCount = useMemo(() => Math.max(...pipeline.map(p => p.count), 1), [pipeline]);

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
            {t('analytics.reports.statusPipeline.title')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('analytics.reports.statusPipeline.subtitle')}
        </Text>

        {pipeline.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          <View style={styles.barsContainer}>
            {pipeline.map((item) => (
              <View key={item.status} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: colors.text }]} numberOfLines={1}>
                  {t(`production.status.${item.status}`, { defaultValue: item.status.replace(/_/g, ' ') })}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: item.color,
                        width: `${(item.count / maxCount) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barCount, { color: colors.text }]}>{item.count}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.legendCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.legendTitle, { color: colors.text }]}>{t('analytics.legend')}</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('analytics.legendBlocked')}</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('analytics.legendProcess')}</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#eab308' }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('analytics.legendWaiting')}</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('analytics.legendReady')}</Text>
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
  subtitle: { fontSize: theme.typography.fontSize.sm, marginBottom: theme.spacing.sm },
  emptyText: { textAlign: 'center', paddingVertical: theme.spacing.xl },
  barsContainer: { gap: theme.spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  barLabel: { width: 120, fontSize: theme.typography.fontSize.xs, textTransform: 'capitalize' },
  barTrack: { flex: 1, height: 24, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6, minWidth: 4 },
  barCount: { width: 32, fontSize: theme.typography.fontSize.sm, fontWeight: '700', textAlign: 'right' },
  legendCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.xs, ...theme.shadows.sm },
  legendTitle: { fontSize: theme.typography.fontSize.sm, fontWeight: '600', marginBottom: theme.spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: theme.typography.fontSize.xs },
});
