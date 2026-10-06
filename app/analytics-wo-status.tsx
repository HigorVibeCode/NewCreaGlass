import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getWorkOrderStatusPipeline } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsWoStatusScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { workOrders, isLoading } = useAnalyticsData();

  const pipeline = useMemo(() => getWorkOrderStatusPipeline(workOrders), [workOrders]);
  const maxCount = useMemo(() => Math.max(...pipeline.map(p => p.count), 1), [pipeline]);
  const total = workOrders.length;

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('analytics.reports.woStatus.title')}</Text>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.totalCard, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="construct" size={22} color="#3b82f6" />
          <Text style={[styles.totalText, { color: colors.text }]}>{total} {t('analytics.totalWO')}</Text>
        </View>
        {pipeline.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          <View style={styles.barsContainer}>
            {pipeline.map(item => (
              <View key={item.status} style={[styles.statusCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.statusHeader}>
                  <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.statusLabel, { color: colors.text }]}>{item.status.replace(/_/g, ' ')}</Text>
                  <Text style={[styles.statusCount, { color: item.color }]}>{item.count}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { backgroundColor: item.color, width: `${(item.count / maxCount) * 100}%` }]} />
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
  contentContainer: { padding: theme.spacing.lg, gap: theme.spacing.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', paddingVertical: theme.spacing.xl },
  totalCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, ...theme.shadows.sm },
  totalText: { fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  barsContainer: { gap: theme.spacing.sm },
  statusCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.sm, ...theme.shadows.sm },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusLabel: { flex: 1, fontSize: theme.typography.fontSize.sm, fontWeight: '500', textTransform: 'capitalize' },
  statusCount: { fontSize: theme.typography.fontSize.lg, fontWeight: '700' },
  barTrack: { height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
});
