import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getInventoryLowStock } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsInvLowStockScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const goBack = useGoBack('/analytics');
  const { inventoryItems, isLoading } = useAnalyticsData();

  const lowStock = useMemo(() => getInventoryLowStock(inventoryItems), [inventoryItems]);

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('analytics.reports.invLowStock.title')}</Text>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.alertCard, { backgroundColor: lowStock.length > 0 ? '#fef2f2' : '#f0fdf4' }]}>
          <Ionicons name={lowStock.length > 0 ? 'warning' : 'checkmark-circle'} size={24} color={lowStock.length > 0 ? '#ef4444' : '#10b981'} />
          <Text style={[styles.alertText, { color: lowStock.length > 0 ? '#ef4444' : '#10b981' }]}>
            {lowStock.length > 0
              ? `${lowStock.length} ${t('analytics.itemsBelowThreshold')}`
              : t('analytics.allStockOk')}
          </Text>
        </View>
        {lowStock.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('analytics.noLowStock')}</Text>
        ) : (
          lowStock.map(item => {
            const ratio = item.lowStockThreshold > 0 ? item.stock / item.lowStockThreshold : 1;
            const barColor = ratio <= 0.25 ? '#ef4444' : ratio <= 0.5 ? '#f59e0b' : '#eab308';
            return (
              <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  <View style={[styles.stockBadge, { backgroundColor: `${barColor}18` }]}>
                    <Text style={[styles.stockText, { color: barColor }]}>{item.stock} / {item.lowStockThreshold}</Text>
                  </View>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { backgroundColor: barColor, width: `${Math.min(ratio * 100, 100)}%` }]} />
                </View>
                <Text style={[styles.itemUnit, { color: colors.textTertiary }]}>{item.unit}</Text>
              </View>
            );
          })
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
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.borderRadius.md },
  alertText: { fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  itemCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.xs, ...theme.shadows.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  itemName: { flex: 1, fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  stockText: { fontSize: 12, fontWeight: '700' },
  barTrack: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, minWidth: 3 },
  itemUnit: { fontSize: theme.typography.fontSize.xs },
});
