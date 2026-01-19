import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { theme } from '../src/theme';

interface SubCategory {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  chevronColor: string;
}

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

  // Verificar se é uma subcategoria (equipmentTools.manuals ou equipmentTools.maintenance)
  const isSubCategory = categoryId?.includes('.');
  const baseCategoryId = isSubCategory ? categoryId?.split('.')[0] : categoryId;
  const subCategoryId = isSubCategory ? categoryId?.split('.')[1] : null;

  const category = baseCategoryId ? categoryConfig[baseCategoryId as keyof typeof categoryConfig] : null;
  const config = category || categoryConfig.legalRequirements;

  // Subcategorias para Equipment and Tools
  const equipmentToolsSubCategories: SubCategory[] = [
    {
      id: 'manuals',
      icon: 'book',
      iconColor: '#3b82f6',
      iconBgColor: '#dbeafe',
      chevronColor: '#3b82f6',
    },
    {
      id: 'maintenance',
      icon: 'construct',
      iconColor: '#f59e0b',
      iconBgColor: '#fef3c7',
      chevronColor: '#f59e0b',
    },
  ];

  const isEquipmentTools = baseCategoryId === 'equipmentTools';
  const currentSubCategory = subCategoryId 
    ? equipmentToolsSubCategories.find(sub => sub.id === subCategoryId)
    : null;

  const handleSubCategoryPress = (subCategoryId: string) => {
    if (subCategoryId === 'maintenance') {
      // Navegar para a lista de manutenções
      router.push('/maintenance-list');
    } else {
      // Para outras subcategorias, navegar para a tela de documentos
      router.push({
        pathname: '/documents-category',
        params: { categoryId: `equipmentTools.${subCategoryId}` },
      } as any);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Custom Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.background,
              paddingTop: Platform.OS === 'ios' ? Math.max(insets.top + theme.spacing.md, 60) : theme.spacing.xl + theme.spacing.md,
              paddingBottom: theme.spacing.md,
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

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.subtitleContainer}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {isSubCategory && subCategoryId
                ? t(`documents.categories.equipmentTools.subCategories.${subCategoryId}.subtitle`)
                : t(`documents.categories.${baseCategoryId || categoryId}.subtitle`)}
            </Text>
          </View>

          {isEquipmentTools && !isSubCategory ? (
            // Mostrar subcategorias para Equipment and Tools
            <View style={styles.subCategoriesContainer}>
              {equipmentToolsSubCategories.map((subCategory) => (
                <TouchableOpacity
                  key={subCategory.id}
                  style={[styles.subCategoryCard, { backgroundColor: colors.cardBackground }]}
                  onPress={() => handleSubCategoryPress(subCategory.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.subCategoryContent}>
                    <View
                      style={[
                        styles.subCategoryIconContainer,
                        {
                          backgroundColor: isDark
                            ? `${subCategory.iconBgColor}40`
                            : subCategory.iconBgColor,
                        },
                      ]}
                    >
                      <Ionicons name={subCategory.icon} size={24} color={subCategory.iconColor} />
                    </View>
                    <View style={styles.subCategoryTextContainer}>
                      <Text style={[styles.subCategoryTitle, { color: colors.text }]}>
                        {t(`documents.categories.equipmentTools.subCategories.${subCategory.id}.title`)}
                      </Text>
                      <Text style={[styles.subCategorySubtitle, { color: colors.textSecondary }]}>
                        {t(`documents.categories.equipmentTools.subCategories.${subCategory.id}.subtitle`)}
                      </Text>
                    </View>
                    <View style={[styles.subCategoryChevronContainer, { backgroundColor: colors.backgroundSecondary }]}>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={subCategory.chevronColor}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            // Mostrar estado vazio para subcategorias e outras categorias
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons 
                  name={isSubCategory && currentSubCategory ? currentSubCategory.icon : 'document-outline'} 
                  size={48} 
                  color={isSubCategory && currentSubCategory ? currentSubCategory.iconColor : colors.textTertiary} 
                />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('documents.noDocuments')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  subCategoriesContainer: {
    gap: theme.spacing.md,
  },
  subCategoryCard: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  subCategoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  subCategoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subCategoryTextContainer: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  subCategoryTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  subCategorySubtitle: {
    fontSize: theme.typography.fontSize.sm,
  },
  subCategoryChevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
