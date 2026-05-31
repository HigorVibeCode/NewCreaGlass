import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getInventoryByGroup, getPieColor } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsInvByGroupScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { inventoryItems, inventoryGroups, isLoading } = useAnalyticsData();

  const groups = useMemo(() => getInventoryByGroup(inventoryItems, inventoryGroups), [inventoryItems, inventoryGroups]);
  const maxStock = useMemo(() => Math.max(...groups.map(g => g.totalStock), 1), [groups]);

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('analytics.reports.invByGroup.title')}</Text>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {groups.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          groups.map((group, idx) => (
            <View key={group.name} style={[styles.groupCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.groupHeader}>
                <View style={[styles.colorDot, { backgroundColor: getPieColor(idx) }]} />
                <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>{group.name}</Text>
                <Text style={[styles.itemCount, { color: colors.textSecondary }]}>{group.itemCount} {t('analytics.items')}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { backgroundColor: getPieColor(idx), width: `${(group.totalStock / maxStock) * 100}%` }]} />
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{t('analytics.stock')}: {group.totalStock}</Text>
                {group.totalM2 > 0 && <Text style={[styles.metaText, { color: colors.textSecondary }]}>{group.totalM2.toFixed(1)} m²</Text>}
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
  groupCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.sm, ...theme.shadows.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  groupName: { flex: 1, fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  itemCount: { fontSize: theme.typography.fontSize.xs },
  barTrack: { height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  metaRow: { flexDirection: 'row', gap: theme.spacing.md },
  metaText: { fontSize: theme.typography.fontSize.xs },
});
