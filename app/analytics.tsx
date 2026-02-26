import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useGoBack } from '../src/hooks/use-go-back';
import { theme } from '../src/theme';

interface ReportCard {
  id: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
}

interface Section {
  titleKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  reports: ReportCard[];
}

const SECTIONS: Section[] = [
  {
    titleKey: 'analytics.sections.production',
    icon: 'construct',
    accentColor: '#6366f1',
    reports: [
      { id: 'productionSummary', route: '/analytics-production-summary', icon: 'bar-chart', iconColor: '#6366f1', iconBgColor: '#e0e7ff' },
      { id: 'statusPipeline', route: '/analytics-status-pipeline', icon: 'git-branch', iconColor: '#f97316', iconBgColor: '#ffedd5' },
      { id: 'deliveryPerformance', route: '/analytics-delivery-performance', icon: 'timer', iconColor: '#10b981', iconBgColor: '#d1fae5' },
      { id: 'topClients', route: '/analytics-top-clients', icon: 'people', iconColor: '#3b82f6', iconBgColor: '#dbeafe' },
      { id: 'glassTypes', route: '/analytics-glass-types', icon: 'pie-chart', iconColor: '#8b5cf6', iconBgColor: '#ede9fe' },
      { id: 'bottleneck', route: '/analytics-bottleneck', icon: 'hourglass', iconColor: '#ef4444', iconBgColor: '#fee2e2' },
      { id: 'companyComparison', route: '/analytics-company-comparison', icon: 'business', iconColor: '#0ea5e9', iconBgColor: '#e0f2fe' },
      { id: 'reworkRate', route: '/analytics-rework-rate', icon: 'warning', iconColor: '#f59e0b', iconBgColor: '#fef3c7' },
    ],
  },
  {
    titleKey: 'analytics.sections.events',
    icon: 'calendar',
    accentColor: '#8b5cf6',
    reports: [
      { id: 'eventsCalendar', route: '/analytics-events-calendar', icon: 'calendar-outline', iconColor: '#6366f1', iconBgColor: '#e0e7ff' },
      { id: 'eventsByType', route: '/analytics-events-by-type', icon: 'pie-chart-outline', iconColor: '#8b5cf6', iconBgColor: '#ede9fe' },
      { id: 'eventsFrequency', route: '/analytics-events-frequency', icon: 'trending-up', iconColor: '#06b6d4', iconBgColor: '#cffafe' },
    ],
  },
  {
    titleKey: 'analytics.sections.workOrders',
    icon: 'build',
    accentColor: '#3b82f6',
    reports: [
      { id: 'woStatus', route: '/analytics-wo-status', icon: 'git-branch-outline', iconColor: '#3b82f6', iconBgColor: '#dbeafe' },
      { id: 'woTeam', route: '/analytics-wo-team', icon: 'people-outline', iconColor: '#10b981', iconBgColor: '#d1fae5' },
      { id: 'woServiceTime', route: '/analytics-wo-service-time', icon: 'stopwatch-outline', iconColor: '#f59e0b', iconBgColor: '#fef3c7' },
      { id: 'woClients', route: '/analytics-wo-clients', icon: 'person-outline', iconColor: '#0ea5e9', iconBgColor: '#e0f2fe' },
      { id: 'woByDay', route: '/analytics-wo-by-day', icon: 'calendar-number-outline', iconColor: '#8b5cf6', iconBgColor: '#ede9fe' },
    ],
  },
  {
    titleKey: 'analytics.sections.inventory',
    icon: 'cube',
    accentColor: '#10b981',
    reports: [
      { id: 'invLowStock', route: '/analytics-inv-low-stock', icon: 'alert-circle-outline', iconColor: '#ef4444', iconBgColor: '#fee2e2' },
      { id: 'invByGroup', route: '/analytics-inv-by-group', icon: 'layers-outline', iconColor: '#6366f1', iconBgColor: '#e0e7ff' },
      { id: 'invSupplier', route: '/analytics-inv-supplier', icon: 'business-outline', iconColor: '#f59e0b', iconBgColor: '#fef3c7' },
    ],
  },
];

export default function AnalyticsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const goBack = useGoBack('/(tabs)/documents');

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('analytics.title')}
          </Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {SECTIONS.map((section) => (
          <View key={section.titleKey} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon} size={18} color={section.accentColor} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t(section.titleKey)}
              </Text>
            </View>
            <View style={styles.cardsContainer}>
              {section.reports.map((report) => (
                <TouchableOpacity
                  key={report.id}
                  style={[styles.card, { backgroundColor: colors.cardBackground }]}
                  onPress={() => router.push(report.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardContent}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: isDark ? `${report.iconBgColor}30` : report.iconBgColor },
                      ]}
                    >
                      <Ionicons name={report.icon} size={20} color={report.iconColor} />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        {t(`analytics.reports.${report.id}.title`)}
                      </Text>
                      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                        {t(`analytics.reports.${report.id}.subtitle`)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 44,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
  },
  scrollView: { flex: 1 },
  contentContainer: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  section: { gap: theme.spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardsContainer: { gap: theme.spacing.xs },
  card: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm + 2,
    ...theme.shadows.sm,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm + 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: { flex: 1, gap: 1 },
  cardTitle: {
    fontSize: theme.typography.fontSize.sm + 1,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  cardSubtitle: {
    fontSize: theme.typography.fontSize.xs,
  },
});
