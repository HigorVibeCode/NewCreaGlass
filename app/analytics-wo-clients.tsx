import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getWorkOrderTopClients } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

const BAR_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];

export default function AnalyticsWoClientsScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { workOrders, isLoading } = useAnalyticsData();

  const clients = useMemo(() => getWorkOrderTopClients(workOrders), [workOrders]);
  const maxCount = useMemo(() => Math.max(...clients.map(c => c.count), 1), [clients]);

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('analytics.reports.woClients.title')}</Text>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {clients.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          clients.map((client, idx) => (
            <View key={client.name} style={[styles.clientCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.clientHeader}>
                <View style={[styles.rankBadge, { backgroundColor: idx < 3 ? '#3b82f6' : colors.backgroundSecondary }]}>
                  <Text style={[styles.rankText, { color: idx < 3 ? '#fff' : colors.textSecondary }]}>#{idx + 1}</Text>
                </View>
                <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>{client.name}</Text>
                <Text style={[styles.clientCount, { color: '#3b82f6' }]}>{client.count}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { backgroundColor: BAR_COLORS[idx] || '#3b82f6', width: `${(client.count / maxCount) * 100}%` }]} />
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
  clientCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.sm, ...theme.shadows.sm },
  clientHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontSize: 12, fontWeight: '700' },
  clientName: { flex: 1, fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  clientCount: { fontSize: theme.typography.fontSize.lg, fontWeight: '700' },
  barTrack: { height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
});
