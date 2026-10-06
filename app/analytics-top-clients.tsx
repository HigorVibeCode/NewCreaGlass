import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getTopClients } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

const BAR_COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

export default function AnalyticsTopClientsScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { productions, isLoading } = useAnalyticsData();

  const clients = useMemo(() => getTopClients(productions, 10), [productions]);
  const maxOrders = useMemo(() => Math.max(...clients.map(c => c.orders), 1), [clients]);

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
            {t('analytics.reports.topClients.title')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {clients.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          clients.map((client, idx) => (
            <View key={client.name} style={[styles.clientCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.clientHeader}>
                <View style={[styles.rankBadge, { backgroundColor: idx < 3 ? '#6366f1' : colors.backgroundSecondary }]}>
                  <Text style={[styles.rankText, { color: idx < 3 ? '#fff' : colors.textSecondary }]}>
                    #{idx + 1}
                  </Text>
                </View>
                <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>{client.name}</Text>
                <Text style={[styles.clientOrders, { color: colors.primary }]}>{client.orders}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[styles.barFill, { backgroundColor: BAR_COLORS[idx] || '#6366f1', width: `${(client.orders / maxOrders) * 100}%` }]}
                />
              </View>
              <View style={styles.clientMeta}>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {client.m2.toFixed(1)} m²
                </Text>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {client.pieces} {t('analytics.pieces')}
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', paddingVertical: theme.spacing.xl },
  clientCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.sm, ...theme.shadows.sm },
  clientHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontSize: 12, fontWeight: '700' },
  clientName: { flex: 1, fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  clientOrders: { fontSize: theme.typography.fontSize.lg, fontWeight: '700' },
  barTrack: { height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  clientMeta: { flexDirection: 'row', gap: theme.spacing.md },
  metaText: { fontSize: theme.typography.fontSize.xs },
});
