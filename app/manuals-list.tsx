import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { Manual } from '../src/types';
import { theme } from '../src/theme';

export default function ManualsListScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadManuals = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await repos.manualsRepo.getAllManuals();
      setManuals(list);
    } catch (error) {
      console.error('Error loading manuals:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadManuals();
  }, [loadManuals]);

  useFocusEffect(
    useCallback(() => {
      loadManuals();
    }, [loadManuals])
  );

  const handleCreateManual = () => {
    router.push('/manual-create');
  };

  const handleEditManual = (manualId: string) => {
    router.push({ pathname: '/manual-create', params: { manualId } } as any);
  };

  const handleManualPress = async (manual: Manual) => {
    if (!manual.attachments?.length) return;
    const first = manual.attachments[0];
    try {
      const url = await repos.manualsRepo.getManualAttachmentUrl(first.id);
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
    } catch (e) {
      console.error('Error opening PDF:', e);
    }
  };

  const titleManuals = t('documents.categories.equipmentTools.subCategories.manuals.title') || 'Manuais';

  return (
    <ScreenWrapper>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + theme.spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#dbeafe40' : '#dbeafe' }]}>
              <Ionicons name="book" size={20} color="#3b82f6" />
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{titleManuals}</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleCreateManual} activeOpacity={0.7}>
            <Ionicons name="add" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {manuals.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="book-outline" size={48} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('manuals.noManuals')}
              </Text>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateManual}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.createButtonText}>{t('manuals.createManual')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {manuals.map((manual) => (
                <View
                  key={manual.id}
                  style={[styles.card, { backgroundColor: colors.cardBackground }]}
                >
                  <TouchableOpacity
                    style={styles.cardMain}
                    onPress={() => handleManualPress(manual)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                        {manual.title}
                      </Text>
                    </View>
                    <View style={styles.cardDetails}>
                      <View style={styles.cardDetailRow}>
                        <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.cardDetailText, { color: colors.textSecondary }]}>
                          {manual.attachments?.length ?? 0} {t('manuals.pdfs')}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
                      onPress={() => handleEditManual(manual.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil" size={20} color={colors.primary} />
                      <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                        {t('common.edit') || 'Editar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
  },
  emptyState: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
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
  listContainer: {
    gap: theme.spacing.md,
  },
  card: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  cardMain: {
    marginBottom: theme.spacing.sm,
  },
  cardHeader: {
    marginBottom: theme.spacing.xs,
  },
  cardTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  cardDetails: {
    gap: theme.spacing.xs,
  },
  cardDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  cardDetailText: {
    fontSize: theme.typography.fontSize.sm,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
  },
});
