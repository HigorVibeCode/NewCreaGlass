import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useAuth } from '../src/store/auth-store';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { supabase } from '../src/services/supabase';
import { TrainingWithCompletion, TrainingCategory } from '../src/types';
import { theme } from '../src/theme';

export default function TrainingsHistoryScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isDark = effectiveTheme === 'dark';
  const { category } = useLocalSearchParams<{ category: TrainingCategory }>();
  const trainingCategory = category || 'mandatory';

  const [trainings, setTrainings] = useState<TrainingWithCompletion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [signatureImageUrl, setSignatureImageUrl] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  const isMaster = user?.userType === 'Master';

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      // Se for Master e não tiver userId selecionado, buscar todos
      // Se for comum, buscar apenas os próprios
      const userId = isMaster ? selectedUserId : user?.id;
      const completedTrainings = await repos.trainingRepo.getCompletedTrainings(userId);
      
      // Filtrar por categoria
      const filtered = completedTrainings.filter(t => t.category === trainingCategory);
      setTrainings(filtered);
    } catch (error) {
      console.error('Error loading training history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isMaster, selectedUserId, user?.id, trainingCategory]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const getCategoryTitle = () => {
    if (trainingCategory === 'mandatory') {
      return 'Histórico - Treinamentos Obrigatórios';
    }
    if (trainingCategory === 'onboarding') {
      return 'Histórico - Treinamentos de Onboarding';
    }
    return 'Histórico - Treinamentos Profissionais';
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
            <View style={styles.headerSpacer} />
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
                  <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Nenhum treinamento concluído ainda
                </Text>
              </View>
            ) : (
              <View style={styles.trainingsContainer}>
                {trainings.map((training) => (
                  <TouchableOpacity
                    key={training.id}
                    style={[styles.trainingCard, { backgroundColor: colors.cardBackground }]}
                    onPress={() => router.push({
                      pathname: '/training-detail',
                      params: { trainingId: training.id },
                    } as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.trainingHeader}>
                      <Text style={[styles.trainingTitle, { color: colors.text }]} numberOfLines={2}>
                        {training.title}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={[styles.statusText, { color: colors.success }]}>
                          Concluído
                        </Text>
                      </View>
                    </View>

                    {training.description && (
                      <Text style={[styles.trainingDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                        {training.description}
                      </Text>
                    )}

                    {training.completion && (
                      <View style={[styles.completionDetails, { borderTopColor: colors.border }]}>
                        <View style={styles.completionRow}>
                          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                          <Text style={[styles.completionText, { color: colors.textSecondary }]}>
                            Concluído em: {formatDate(training.completion.completedAt!)}
                          </Text>
                        </View>
                        <View style={styles.completionRow}>
                          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                          <Text style={[styles.completionText, { color: colors.textSecondary }]}>
                            Tempo total: {formatTime(training.completion.timeSpentSeconds)}
                          </Text>
                        </View>
                        {training.signature && (
                          <>
                            <View style={styles.completionRow}>
                              <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                              <Text style={[styles.completionText, { color: colors.textSecondary }]}>
                                Assinado por: {training.signature.fullName}
                              </Text>
                            </View>
                            {training.signature.signaturePath && (
                              <View style={styles.signatureViewContainer}>
                                <Text style={[styles.signatureLabel, { color: colors.textSecondary }]}>
                                  Assinatura:
                                </Text>
                                <TouchableOpacity
                                  style={[styles.signatureImageContainer, { borderColor: colors.border }]}
                                  onPress={async () => {
                                    try {
                                      // Obter URL da assinatura
                                      const filename = training.signature.signaturePath.replace('signatures/', '');
                                      const { data, error } = await supabase.storage
                                        .from('signatures')
                                        .createSignedUrl(filename, 3600);
                                      
                                      if (error) {
                                        throw error;
                                      }
                                      
                                      if (data?.signedUrl) {
                                        setSignatureImageUrl(data.signedUrl);
                                        setShowSignatureModal(true);
                                      }
                                    } catch (error) {
                                      console.error('Error opening signature:', error);
                                      Alert.alert('Erro', 'Não foi possível abrir a assinatura');
                                    }
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <View style={[styles.signaturePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                                    <Ionicons name="document-text" size={32} color={colors.primary} />
                                  </View>
                                  <View style={[styles.signatureOverlay, { backgroundColor: colors.backgroundSecondary + 'E6' }]}>
                                    <Ionicons name="eye-outline" size={20} color={colors.primary} />
                                    <Text style={[styles.signatureViewText, { color: colors.primary }]}>
                                      Visualizar Assinatura
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              </View>
                            )}
                          </>
                        )}
                        {training.attachments && training.attachments.length > 0 && (
                          <View style={styles.completionRow}>
                            <Ionicons name="document-text" size={16} color={colors.primary} />
                            <Text style={[styles.completionText, { color: colors.primary }]}>
                              {training.attachments.length} {training.attachments.length === 1 ? 'anexo' : 'anexos'} disponível{training.attachments.length > 1 ? 'eis' : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    <View style={[styles.viewTrainingRow, { borderTopColor: colors.border }]}>
                      <Ionicons name="open-outline" size={16} color={colors.primary} />
                      <Text style={[styles.viewTrainingText, { color: colors.primary }]}>
                        Ver treinamento e mídia
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Signature Modal */}
        <Modal
          visible={showSignatureModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowSignatureModal(false);
            setSignatureImageUrl(null);
          }}
        >
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.9)' }]}>
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Assinatura Digital
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowSignatureModal(false);
                    setSignatureImageUrl(null);
                  }}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              {signatureImageUrl && (
                <View style={styles.signatureModalContent}>
                  <Image
                    source={{ uri: signatureImageUrl }}
                    style={styles.signatureModalImage}
                    contentFit="contain"
                  />
                </View>
              )}
            </View>
          </View>
        </Modal>
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
  headerSpacer: {
    width: 40,
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
  },
  trainingsContainer: {
    gap: theme.spacing.md,
  },
  trainingCard: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  trainingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  trainingTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs / 2,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs / 2,
    borderRadius: theme.borderRadius.sm,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  trainingDescription: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.sm,
    lineHeight: theme.typography.lineHeight.sm * 1.2,
  },
  completionDetails: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  viewTrainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
  },
  viewTrainingText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  completionText: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  signatureViewContainer: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  signatureLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  signatureImageContainer: {
    width: '100%',
    height: 120,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  signaturePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureImage: {
    width: '100%',
    height: '100%',
  },
  signatureOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
  },
  signatureViewText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
  },
  modalCloseButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  signatureModalContent: {
    padding: theme.spacing.lg,
    minHeight: 300,
    maxHeight: 500,
  },
  signatureModalImage: {
    width: '100%',
    height: '100%',
    minHeight: 300,
  },
});
