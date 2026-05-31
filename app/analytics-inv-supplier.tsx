import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChartKit, ChartPlaceholder, ChartError } from '../src/components/shared/LazyChart';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAnalyticsData, getInventoryBySupplier, getPieColor } from '../src/hooks/use-analytics-data';
import { theme } from '../src/theme';

export default function AnalyticsInvSupplierScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const goBack = useGoBack('/analytics');
  const { chartKit, loading: chartLoading } = useChartKit();
  const { inventoryItems, isLoading } = useAnalyticsData();
  const PieChart = chartKit?.PieChart;

  const suppliers = useMemo(() => getInventoryBySupplier(inventoryItems), [inventoryItems]);
  const pieData = useMemo(() => suppliers.map((s, idx) => ({
    name: s.supplier,
    population: s.count,
    color: getPieColor(idx),
    legendFontColor: isDark ? '#94a3b8' : '#6b7280',
    legendFontSize: 12,
  })), [suppliers, isDark]);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 48, 700);

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('analytics.reports.invSupplier.title')}</Text>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {suppliers.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('common.noData')}</Text>
        ) : (
          <>
            <View style={[styles.chartCard, { backgroundColor: colors.cardBackground }]}>
              {chartLoading ? (
                <ChartPlaceholder />
              ) : !chartKit ? (
                <ChartError />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <PieChart data={pieData} width={Math.max(chartWidth, 350)} height={220}
                    chartConfig={{ color: () => '#6366f1', labelColor: () => isDark ? '#94a3b8' : '#6b7280' }}
                    accessor="population" backgroundColor="transparent" paddingLeft="15" absolute />
                </ScrollView>
              )}
            </View>
            <View style={styles.legendList}>
              {suppliers.map((s, idx) => (
                <View key={s.supplier} style={[styles.legendCard, { backgroundColor: colors.cardBackground }]}>
                  <View style={[styles.legendDot, { backgroundColor: getPieColor(idx) }]} />
                  <Text style={[styles.legendName, { color: colors.text }]}>{s.supplier}</Text>
                  <View style={styles.legendValues}>
                    <Text style={[styles.legendCount, { color: colors.text }]}>{s.count} {t('analytics.items')}</Text>
                    {s.m2 > 0 && <Text style={[styles.legendM2, { color: colors.textSecondary }]}>{s.m2.toFixed(1)} m²</Text>}
                  </View>
                </View>
              ))}
            </View>
          </>
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
  chartCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.md, ...theme.shadows.sm },
  legendList: { gap: theme.spacing.xs },
  legendCard: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.sm, borderRadius: theme.borderRadius.sm, gap: theme.spacing.sm, ...theme.shadows.sm },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendName: { flex: 1, fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  legendValues: { alignItems: 'flex-end' },
  legendCount: { fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  legendM2: { fontSize: theme.typography.fontSize.xs },
});
