import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useI18n } from '../../src/hooks/use-i18n';
import { ScreenWrapper } from '../../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../../src/hooks/use-theme-colors';
import { useAppTheme } from '../../src/hooks/use-app-theme';
import { useAuth } from '../../src/store/auth-store';
import { theme } from '../../src/theme';
import { pushWithParams } from '../../src/utils/navigation';

interface DocumentCategory {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  chevronColor: string;
}

export default function DocumentsScreen() {
  'use no memo';
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const { user } = useAuth();
  const isMaster = user?.userType === 'Master';

  const categories: DocumentCategory[] = [
    {
      id: 'proceduresInstructionsTrainings',
      icon: 'school',
      iconColor: '#10b981',
      iconBgColor: '#d1fae5',
      chevronColor: '#10b981',
    },
    {
      id: 'equipmentTools',
      icon: 'build',
      iconColor: '#f59e0b',
      iconBgColor: '#fef3c7',
      chevronColor: '#f59e0b',
    },
    {
      id: 'legalRequirements',
      icon: 'shield-checkmark',
      iconColor: '#3b82f6',
      iconBgColor: '#dbeafe',
      chevronColor: '#3b82f6',
    },
  ];

  const handleCategoryPress = (categoryId: string) => {
    if (categoryId === 'proceduresInstructionsTrainings') {
      pushWithParams(router, '/trainings-list', { category: 'professional' });
    } else {
      pushWithParams(router, '/documents-category', { categoryId: String(categoryId) });
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.categoriesContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryCard, { backgroundColor: colors.cardBackground }]}
              onPress={() => handleCategoryPress(category.id)}
              activeOpacity={0.7}
            >
              <View style={styles.categoryContent}>
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: isDark
                        ? `${category.iconBgColor}40`
                        : category.iconBgColor,
                    },
                  ]}
                >
                  <Ionicons name={category.icon} size={24} color={category.iconColor} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={[styles.categoryTitle, { color: colors.text }]}>
                    {t(`documents.categories.${category.id}.title`)}
                  </Text>
                  <Text style={[styles.categorySubtitle, { color: colors.textSecondary }]}>
                    {t(`documents.categories.${category.id}.subtitle`)}
                  </Text>
                </View>
                <View style={[styles.chevronContainer, { backgroundColor: colors.backgroundSecondary }]}>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={category.chevronColor}
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Analytics featured card — Master only */}
        {isMaster && (
          <TouchableOpacity
            style={[styles.analyticsCard, isDark && styles.analyticsCardDark]}
            onPress={() => router.push('/analytics' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.analyticsDecoCircle1} />
            <View style={styles.analyticsDecoCircle2} />
            <View style={styles.analyticsGoldStripe} />
            <View style={styles.analyticsContent}>
              <View style={styles.analyticsIconWrap}>
                <Ionicons name="analytics" size={28} color="#fff" />
              </View>
              <View style={styles.analyticsText}>
                <Text style={styles.analyticsTitle}>
                  {t('documents.categories.analytics.title')}
                </Text>
                <Text style={styles.analyticsSubtitle}>
                  {t('documents.categories.analytics.subtitle')}
                </Text>
              </View>
              <View style={styles.analyticsArrow}>
                <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.9)" />
              </View>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },

  // ── Analytics featured card ──
  analyticsCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    backgroundColor: '#c0392b',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 20px rgba(192,57,43,0.35)' }
      : {
          shadowColor: '#c0392b',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 10,
        }),
  },
  analyticsCardDark: {
    backgroundColor: '#922b21',
  },
  analyticsDecoCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  analyticsDecoCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  analyticsGoldStripe: {
    position: 'absolute',
    top: 18,
    left: -20,
    right: -20,
    height: 3,
    backgroundColor: '#d4a017',
    opacity: 0.6,
    transform: [{ rotate: '-4deg' }],
  },
  analyticsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    zIndex: 1,
  },
  analyticsIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(212,160,23,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsText: {
    flex: 1,
    gap: 2,
  },
  analyticsTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  analyticsSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  analyticsArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212,160,23,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Regular cards ──
  categoriesContainer: {
    gap: theme.spacing.md,
  },
  categoryCard: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  categoryTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  categorySubtitle: {
    fontSize: theme.typography.fontSize.sm,
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
