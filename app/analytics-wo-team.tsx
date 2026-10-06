import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getWorkOrderTeamPerformance } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

const BAR_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'];

export default function AnalyticsWoTeamScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { workOrders, isLoading } = useAnalyticsData();

  const team = useMemo(() => getWorkOrderTeamPerformance(workOrders), [workOrders]);
  const maxCount = useMemo(() => Math.max(...team.map(t => t.count), 1), [team]);

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('analytics.reports.woTeam.title')}</Text>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {team.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          team.map((member, idx) => (
            <View key={member.name} style={[styles.memberCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.memberHeader}>
                <View style={[styles.rankBadge, { backgroundColor: idx < 3 ? '#10b981' : colors.backgroundSecondary }]}>
                  <Text style={[styles.rankText, { color: idx < 3 ? '#fff' : colors.textSecondary }]}>#{idx + 1}</Text>
                </View>
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{member.name}</Text>
                <Text style={[styles.memberCount, { color: '#10b981' }]}>{member.count}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { backgroundColor: BAR_COLORS[idx] || '#10b981', width: `${(member.count / maxCount) * 100}%` }]} />
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', paddingVertical: theme.spacing.xl },
  memberCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.sm, ...theme.shadows.sm },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontSize: 12, fontWeight: '700' },
  memberName: { flex: 1, fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  memberCount: { fontSize: theme.typography.fontSize.lg, fontWeight: '700' },
  barTrack: { height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
});
