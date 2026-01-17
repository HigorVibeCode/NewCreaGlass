import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useI18n } from '../../src/hooks/use-i18n';
import { ScreenWrapper } from '../../src/components/shared/ScreenWrapper';
import { useThemeColors } from '../../src/hooks/use-theme-colors';
import { useAppTheme } from '../../src/hooks/use-app-theme';
import { theme } from '../../src/theme';

interface DocumentCategory {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  chevronColor: string;
}

export default function DocumentsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';

  const categories: DocumentCategory[] = [
    {
      id: 'legalRequirements',
      icon: 'shield-checkmark',
      iconColor: '#3b82f6',
      iconBgColor: '#dbeafe',
      chevronColor: '#3b82f6',
    },
    {
      id: 'equipmentTools',
      icon: 'build',
      iconColor: '#f59e0b',
      iconBgColor: '#fef3c7',
      chevronColor: '#f59e0b',
    },
    {
      id: 'proceduresManuals',
      icon: 'document-text',
      iconColor: '#a855f7',
      iconBgColor: '#f3e8ff',
      chevronColor: '#a855f7',
    },
    {
      id: 'professionalTraining',
      icon: 'school',
      iconColor: '#10b981',
      iconBgColor: '#d1fae5',
      chevronColor: '#10b981',
    },
  ];

  const handleCategoryPress = (categoryId: string) => {
    router.push({
      pathname: '/documents-category',
      params: { categoryId },
    } as any);
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
  },
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
