import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useAuth } from '../src/store/auth-store';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { supabase } from '../src/services/supabase';
import { EquipmentMachine } from '../src/types';
import { confirmDelete } from '../src/utils/confirm-dialog';
import { theme } from '../src/theme';

const BUCKET_NAME = 'documents';

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

/** Web-safe alert helper */
const showMsg = (message: string) => {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert('', message);
  }
};

export default function DocumentsCategoryScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isDark = effectiveTheme === 'dark';

  // Equipment state
  const [equipment, setEquipment] = useState<EquipmentMachine[]>([]);
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(false);
  const [showCreateEquipment, setShowCreateEquipment] = useState(false);
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [isCreatingEquipment, setIsCreatingEquipment] = useState(false);
  const [equipThumbUrls, setEquipThumbUrls] = useState<Record<string, string>>({});

  // Verificar se é uma subcategoria (equipmentTools.manuals ou equipmentTools.maintenance)
  const isSubCategory = categoryId?.includes('.');
  const baseCategoryId = isSubCategory ? categoryId?.split('.')[0] : categoryId;
  const subCategoryId = isSubCategory ? categoryId?.split('.')[1] : null;

  const category = baseCategoryId ? categoryConfig[baseCategoryId as keyof typeof categoryConfig] : null;
  const config = category || categoryConfig.legalRequirements;

  const isEquipmentTools = baseCategoryId === 'equipmentTools';
  const isLegalRequirements = baseCategoryId === 'legalRequirements';

  // Subcategorias para Legal Requirements
  const legalRequirementsSubCategories: SubCategory[] = [
    {
      id: 'onboarding',
      icon: 'person-add',
      iconColor: '#3b82f6',
      iconBgColor: '#dbeafe',
      chevronColor: '#3b82f6',
    },
    {
      id: 'obrigatorios',
      icon: 'document-text',
      iconColor: '#10b981',
      iconBgColor: '#d1fae5',
      chevronColor: '#10b981',
    },
  ];

  const currentSubCategory = subCategoryId && isLegalRequirements
    ? legalRequirementsSubCategories.find(sub => sub.id === subCategoryId)
    : null;

  // ============== Equipment loading ==============
  const loadEquipment = useCallback(async () => {
    if (!isEquipmentTools || isSubCategory) return;
    setIsLoadingEquipment(true);
    try {
      const list = await repos.equipmentDocumentsRepo.getAllEquipment();
      // Ordenar por nome (alfabética, case-insensitive)
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setEquipment(list);
    } catch (error) {
      console.error('Error loading equipment:', error);
    } finally {
      setIsLoadingEquipment(false);
    }
  }, [isEquipmentTools, isSubCategory]);

  useFocusEffect(
    useCallback(() => {
      loadEquipment();
    }, [loadEquipment])
  );

  // Load equipment thumbnails
  useEffect(() => {
    const withThumb = equipment.filter((eq) => eq.icon && eq.icon.startsWith('equip_thumb_'));
    if (withThumb.length === 0) return;
    let cancelled = false;
    const load = async () => {
      const urls: Record<string, string> = {};
      for (const eq of withThumb) {
        if (cancelled) return;
        try {
          const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(eq.icon!, 3600);
          if (data?.signedUrl) urls[eq.id] = data.signedUrl;
        } catch (_) {}
      }
      if (!cancelled) setEquipThumbUrls((prev) => ({ ...prev, ...urls }));
    };
    load();
    return () => { cancelled = true; };
  }, [equipment]);

  const handleCreateEquipment = async () => {
    if (!newEquipmentName.trim()) {
      showMsg(t('equipmentDocs.equipmentNameRequired') || 'Nome é obrigatório');
      return;
    }
    if (!user) return;
    setIsCreatingEquipment(true);
    try {
      await repos.equipmentDocumentsRepo.createEquipment({
        name: newEquipmentName.trim(),
        createdBy: user.id,
      });
      setNewEquipmentName('');
      setShowCreateEquipment(false);
      showMsg(t('equipmentDocs.equipmentCreated') || 'Equipamento criado');
      loadEquipment();
    } catch (error) {
      console.error('Error creating equipment:', error);
      showMsg(t('equipmentDocs.saveError') || 'Erro ao salvar');
    } finally {
      setIsCreatingEquipment(false);
    }
  };

  const handleDeleteEquipment = (eq: EquipmentMachine) => {
    confirmDelete(
      t('common.delete') || 'Excluir',
      t('equipmentDocs.deleteEquipmentConfirm', { name: eq.name }) ||
        `Excluir "${eq.name}"? Todos os documentos internos também serão excluídos.`,
      async () => {
        await repos.equipmentDocumentsRepo.deleteEquipment(eq.id);
        loadEquipment();
      },
      undefined,
      t('common.delete') || 'Excluir',
      t('common.cancel') || 'Cancelar',
      t('equipmentDocs.equipmentDeleted') || 'Equipamento excluído',
      t('equipmentDocs.deleteEquipmentError') || 'Erro ao excluir'
    );
  };

  const handleEquipmentPress = (eq: EquipmentMachine) => {
    router.push({
      pathname: '/equipment-documents',
      params: { equipmentId: eq.id, equipmentName: eq.name },
    } as any);
  };

  const handleSubCategoryPress = (subCatId: string) => {
    if (subCatId === 'manuals') {
      router.push('/manuals-list');
      return;
    }
    if (subCatId === 'maintenance') {
      router.push('/maintenance-list');
    } else if (subCatId === 'obrigatorios') {
      router.push({
        pathname: '/trainings-list',
        params: { category: 'mandatory' },
      } as any);
    } else if (subCatId === 'onboarding') {
      router.push({
        pathname: '/trainings-list',
        params: { category: 'onboarding' },
      } as any);
    } else if (baseCategoryId === 'professionalTraining') {
      router.push({
        pathname: '/trainings-list',
        params: { category: 'professional' },
      } as any);
    } else if (isLegalRequirements) {
      router.push({
        pathname: '/documents-category',
        params: { categoryId: `legalRequirements.${subCatId}` },
      } as any);
    } else {
      router.push({
        pathname: '/documents-category',
        params: { categoryId: `equipmentTools.${subCatId}` },
      } as any);
    }
  };

  // ============== Equipment icon mapping ==============
  const getEquipmentIcon = (name: string): keyof typeof Ionicons.glyphMap => {
    const n = name.toLowerCase();
    if (n.includes('furnace') || n.includes('forno') || n.includes('temper')) return 'flame';
    if (n.includes('cutting') || n.includes('corte') || n.includes('mesa')) return 'cut';
    if (n.includes('wash') || n.includes('lavar') || n.includes('lavagem')) return 'water';
    if (n.includes('oven') || n.includes('schmelz')) return 'thermometer';
    if (n.includes('cabin') || n.includes('cabine') || n.includes('paint')) return 'color-palette';
    if (n.includes('laminat')) return 'layers';
    if (n.includes('polish') || n.includes('polir')) return 'sparkles';
    if (n.includes('drill') || n.includes('furar')) return 'construct';
    return 'hardware';
  };

  const getEquipmentColor = (index: number): { iconColor: string; bgColor: string } => {
    const palette = [
      { iconColor: '#f59e0b', bgColor: '#fef3c7' },
      { iconColor: '#3b82f6', bgColor: '#dbeafe' },
      { iconColor: '#10b981', bgColor: '#d1fae5' },
      { iconColor: '#a855f7', bgColor: '#f3e8ff' },
      { iconColor: '#ef4444', bgColor: '#fee2e2' },
      { iconColor: '#06b6d4', bgColor: '#cffafe' },
      { iconColor: '#8b5cf6', bgColor: '#ede9fe' },
      { iconColor: '#ec4899', bgColor: '#fce7f3' },
    ];
    return palette[index % palette.length];
  };

  // ============== Render ==============
  return (
    <ScreenWrapper>
        {/* Custom Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.background,
              paddingTop: theme.spacing.md,
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
                {isEquipmentTools && !isSubCategory
                  ? t('equipmentDocs.title')
                  : isSubCategory && subCategoryId
                  ? (isLegalRequirements
                      ? t(`documents.categories.legalRequirements.subCategories.${subCategoryId}.title`)
                      : t(`documents.categories.equipmentTools.subCategories.${subCategoryId}.title`))
                  : t(`documents.categories.${baseCategoryId || categoryId}.title`)}
              </Text>
            </View>
            {isEquipmentTools && !isSubCategory && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowCreateEquipment(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
            {(subCategoryId === 'obrigatorios' || subCategoryId === 'onboarding' || baseCategoryId === 'professionalTraining') && (
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() => {
                  let cat: 'mandatory' | 'professional' | 'onboarding' = 'mandatory';
                  if (subCategoryId === 'obrigatorios') {
                    cat = 'mandatory';
                  } else if (subCategoryId === 'onboarding') {
                    cat = 'onboarding';
                  } else if (baseCategoryId === 'professionalTraining') {
                    cat = 'professional';
                  }
                  router.push({
                    pathname: '/trainings-history',
                    params: { category: cat },
                  } as any);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Create Equipment Modal Inline */}
        {showCreateEquipment && (
          <View style={[styles.createEquipmentBar, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
            <TextInput
              style={[styles.createEquipmentInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
              value={newEquipmentName}
              onChangeText={setNewEquipmentName}
              placeholder={t('equipmentDocs.equipmentNamePlaceholder') || 'Ex: Tempering Furnace'}
              placeholderTextColor={colors.textTertiary}
              autoFocus
              onSubmitEditing={handleCreateEquipment}
            />
            <TouchableOpacity
              style={[styles.createEquipmentBtn, { backgroundColor: colors.primary }]}
              onPress={handleCreateEquipment}
              disabled={isCreatingEquipment}
              activeOpacity={0.7}
            >
              {isCreatingEquipment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="checkmark" size={22} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createEquipmentBtn, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => { setShowCreateEquipment(false); setNewEquipmentName(''); }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Equipment & Tools: show equipment list */}
            {isEquipmentTools && !isSubCategory ? (
              isLoadingEquipment ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : equipment.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                    <Ionicons name="hardware-chip-outline" size={48} color={colors.textTertiary} />
                  </View>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {t('equipmentDocs.noEquipment')}
                  </Text>
                  <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: colors.primary }]}
                    onPress={() => setShowCreateEquipment(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.createButtonText}>{t('equipmentDocs.createEquipment')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.equipmentList}>
                  {equipment.map((eq, index) => {
                    const eqColor = getEquipmentColor(index);
                    const eqIcon = getEquipmentIcon(eq.name);
                    return (
                      <TouchableOpacity
                        key={eq.id}
                        style={[styles.equipmentCard, { backgroundColor: colors.cardBackground }]}
                        onPress={() => handleEquipmentPress(eq)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.equipmentCardContent}>
                          <View
                            style={[
                              styles.equipmentIconContainer,
                              { backgroundColor: isDark ? `${eqColor.bgColor}40` : eqColor.bgColor },
                            ]}
                          >
                            {equipThumbUrls[eq.id] ? (
                              <Image source={{ uri: equipThumbUrls[eq.id] }} style={styles.equipmentThumbImg} resizeMode="cover" />
                            ) : (
                              <Ionicons name={eqIcon} size={28} color={eqColor.iconColor} />
                            )}
                          </View>
                          <View style={styles.equipmentTextContainer}>
                            <Text style={[styles.equipmentName, { color: colors.text }]} numberOfLines={1}>
                              {eq.name}
                            </Text>
                          </View>
                          <View style={[styles.equipmentChevron, { backgroundColor: colors.backgroundSecondary }]}>
                            <Ionicons name="chevron-forward" size={20} color={eqColor.iconColor} />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )
            ) : baseCategoryId === 'professionalTraining' && !isSubCategory ? (
              <View style={styles.emptyState}>
                <TouchableOpacity
                  style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => {
                    router.push({
                      pathname: '/trainings-list',
                      params: { category: 'professional' },
                    } as any);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="school" size={48} color={config.iconColor} />
                </TouchableOpacity>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Clique para ver treinamentos profissionais
                </Text>
              </View>
            ) : isLegalRequirements && !isSubCategory ? (
              <View style={styles.subCategoriesContainer}>
                {legalRequirementsSubCategories.map((subCategory) => (
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
                          { backgroundColor: isDark ? `${subCategory.iconBgColor}40` : subCategory.iconBgColor },
                        ]}
                      >
                        <Ionicons name={subCategory.icon} size={24} color={subCategory.iconColor} />
                      </View>
                      <View style={styles.subCategoryTextContainer}>
                        <Text style={[styles.subCategoryTitle, { color: colors.text }]}>
                          {t(`documents.categories.legalRequirements.subCategories.${subCategory.id}.title`)}
                        </Text>
                        <Text style={[styles.subCategorySubtitle, { color: colors.textSecondary }]}>
                          {t(`documents.categories.legalRequirements.subCategories.${subCategory.id}.subtitle`)}
                        </Text>
                      </View>
                      <View style={[styles.subCategoryChevronContainer, { backgroundColor: colors.backgroundSecondary }]}>
                        <Ionicons name="chevron-forward" size={20} color={subCategory.chevronColor} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
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
    </ScreenWrapper>
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createEquipmentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  createEquipmentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSize.md,
  },
  createEquipmentBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
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
  loadingContainer: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  createButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  equipmentList: {
    gap: theme.spacing.md,
  },
  equipmentCard: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  equipmentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  equipmentIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  equipmentThumbImg: {
    width: 56,
    height: 56,
  },
  equipmentTextContainer: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  equipmentName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  equipmentChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
