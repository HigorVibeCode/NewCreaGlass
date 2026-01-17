import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { theme } from '../src/theme';

const categoryConfig = {
  legalRequirements: {
    icon: 'shield-checkmark' as const,
    iconColor: '#3b82f6',
    iconBgColor: '#dbeafe',
  },
  equipmentTools: {
    icon: 'build' as const,
    iconColor: '#f59e0b',
    iconBgColor: '#fef3c7',
  },
  proceduresManuals: {
    icon: 'document-text' as const,
    iconColor: '#a855f7',
    iconBgColor: '#f3e8ff',
  },
  professionalTraining: {
    icon: 'school' as const,
    iconColor: '#10b981',
    iconBgColor: '#d1fae5',
  },
};

export default function DocumentsCategoryScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const insets = useSafeAreaInsets();

  const category = categoryId ? categoryConfig[categoryId as keyof typeof categoryConfig] : null;
  const config = category || categoryConfig.legalRequirements;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Custom Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.background,
              paddingTop: Platform.OS === 'ios' ? Math.max(insets.top, theme.spacing.sm) : theme.spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View
                style={[
                  styles.headerIconContainer,
                  {
                    backgroundColor: isDark ? `${config.iconBgColor}40` : config.iconBgColor,
                  },
                ]}
              >
                <Ionicons name={config.icon} size={20} color={config.iconColor} />
              </View>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {t(`documents.categories.${categoryId}.title`)}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.subtitleContainer}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t(`documents.categories.${categoryId}.subtitle`)}
            </Text>
          </View>

          <View style={styles.emptyState}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name="document-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('documents.noDocuments')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    zIndex: 10,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 44,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -theme.spacing.xs,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
  },
  content: {
    gap: theme.spacing.lg,
  },
  subtitleContainer: {
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.md,
    lineHeight: theme.typography.lineHeight.md,
  },
  emptyState: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
});
