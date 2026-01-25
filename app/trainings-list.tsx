import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useAuth } from '../src/store/auth-store';
import { Button } from '../src/components/shared/Button';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { PermissionGuard } from '../src/components/shared/PermissionGuard';
import { repos } from '../src/services/container';
import { Training, TrainingCategory } from '../src/types';
import { theme } from '../src/theme';

export default function TrainingsListScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isDark = effectiveTheme === 'dark';
  const { category } = useLocalSearchParams<{ category: TrainingCategory }>();
  const trainingCategory = category || 'mandatory';
  
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTrainings = useCallback(async () => {
    setIsLoading(true);
    try {
      const allTrainings = await repos.trainingRepo.getAllTrainings(trainingCategory);
      setTrainings(allTrainings);
    } catch (error) {
      console.error('Error loading trainings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [trainingCategory]);

  useEffect(() => {
    loadTrainings();
  }, [loadTrainings]);

  useFocusEffect(
    useCallback(() => {
      loadTrainings();
    }, [loadTrainings])
  );

  // Recarregar após voltar de outras telas (ex: após excluir)
  useEffect(() => {
    const unsubscribe = router.subscribe?.((state: any) => {
      // Recarregar quando voltar para esta tela
      if (state?.routes) {
        const currentRoute = state.routes[state.index];
        if (currentRoute?.name === 'trainings-list') {
          loadTrainings();
        }
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [router, loadTrainings]);

  const handleAddTraining = () => {
    router.push({
      pathname: '/training-create',
      params: { category: trainingCategory },
    } as any);
  };

  const handleTrainingPress = (trainingId: string) => {
    router.push({
      pathname: '/training-detail',
      params: { trainingId },
    } as any);
  };

  const handleHistory = () => {
    router.push({
      pathname: '/trainings-history',
      params: { category: trainingCategory },
    } as any);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getCategoryTitle = () => {
    if (trainingCategory === 'mandatory') {
      return t('documents.categories.legalRequirements.subCategories.obrigatorios.title');
    }
    if (trainingCategory === 'onboarding') {
      return t('documents.categories.legalRequirements.subCategories.onboarding.title');
    }
    return t('documents.categories.professionalTraining.title');
  };

  const getCategoryIcon = () => {
    if (trainingCategory === 'mandatory') {
      return 'document-text';
    }
    if (trainingCategory === 'onboarding') {
      return 'person-add';
    }
    return 'school';
  };

  const getCategoryColor = () => {
    if (trainingCategory === 'mandatory') {
      return '#10b981';
    }
    if (trainingCategory === 'onboarding') {
      return '#3b82f6';
    }
    return '#10b981';
  };

  const getCategoryBgColor = () => {
    if (trainingCategory === 'mandatory') {
      return isDark ? '#d1fae540' : '#d1fae5';
    }
    if (trainingCategory === 'onboarding') {
      return isDark ? '#dbeafe40' : '#dbeafe';
    }
    return isDark ? '#d1fae540' : '#d1fae5';
  };

  const isMaster = user?.userType === 'Master';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenWrapper>
        {/* Custom Header */}
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
                    backgroundColor: getCategoryBgColor(),
                  },
                ]}
              >
                <Ionicons name={getCategoryIcon() as any} size={20} color={getCategoryColor()} />
              </View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {getCategoryTitle()}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <PermissionGuard permission="documents.view">
                <TouchableOpacity
                  style={styles.historyButton}
                  onPress={handleHistory}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={24} color={colors.text} />
                </TouchableOpacity>
              </PermissionGuard>
              <PermissionGuard permission="documents.create">
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddTraining}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={24} color={colors.primary} />
                </TouchableOpacity>
              </PermissionGuard>
            </View>
          </View>
        </View>

        {/* Content */}
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
            {trainings.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                  <Ionicons name={getCategoryIcon() as any} size={48} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Nenhum treinamento disponível
                </Text>
                <PermissionGuard permission="documents.create">
                  <Button
                    title="Adicionar Treinamento"
                    onPress={handleAddTraining}
                    style={styles.createButton}
                  />
                </PermissionGuard>
              </View>
            ) : (
              <View style={styles.trainingsContainer}>
                {trainings.map((training) => {
                  // Verificar se o treinamento tem anexos
                  const hasAttachments = training.attachments && training.attachments.length > 0;
                  
                  return (
                    <TouchableOpacity
                      key={training.id}
                      style={[styles.trainingCard, { backgroundColor: colors.cardBackground }]}
                      onPress={() => handleTrainingPress(training.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.trainingHeader}>
                        <View style={styles.trainingHeaderLeft}>
                          <View style={[styles.trainingIcon, { backgroundColor: getCategoryBgColor() }]}>
                            <Ionicons name={getCategoryIcon() as any} size={20} color={getCategoryColor()} />
                          </View>
                          <View style={styles.trainingTitleContainer}>
                            <Text style={[styles.trainingTitle, { color: colors.text }]} numberOfLines={2}>
                              {training.title}
                            </Text>
                            {training.description && (
                              <Text style={[styles.trainingDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                                {training.description}
                              </Text>
                            )}
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                      </View>
                      
                      <View style={styles.trainingDetails}>
                        {training.durationMinutes && (
                          <View style={styles.trainingDetailRow}>
                            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.trainingDetailText, { color: colors.textSecondary }]}>
                              {training.durationMinutes} minutos
                            </Text>
                          </View>
                        )}
                        {hasAttachments && (
                          <View style={styles.trainingDetailRow}>
                            <Ionicons name="document-text" size={16} color={colors.primary} />
                            <Text style={[styles.trainingDetailText, { color: colors.primary }]}>
                              {training.attachments!.length} {training.attachments!.length === 1 ? 'anexo' : 'anexos'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.trainingDetailRow}>
                          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                          <Text style={[styles.trainingDetailText, { color: colors.textSecondary }]}>
                            {formatDate(training.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </ScreenWrapper>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: theme.spacing.sm,
  },
  createButton: {
    marginTop: theme.spacing.md,
  },
  trainingsContainer: {
    gap: theme.spacing.md,
  },
  trainingCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
    marginBottom: theme.spacing.md,
  },
  trainingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  trainingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    flex: 1,
  },
  trainingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  trainingTitleContainer: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  trainingTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
  },
  trainingDescription: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.sm * 1.3,
  },
  trainingDetails: {
    gap: theme.spacing.xs,
  },
  trainingDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  trainingDetailText: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
});
