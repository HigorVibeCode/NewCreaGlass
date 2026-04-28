import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useRouteParams } from '../src/hooks/use-route-params';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useAuth } from '../src/store/auth-store';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { formatDateTime as formatDateTimeUtil } from '../src/utils/date-format';
import { supabase } from '../src/services/supabase';
import { getCachedSignedUrl } from '../src/utils/signed-url-cache';
import { TrainingWithCompletion, TrainingCategory } from '../src/types';
import { getLocalizedTrainingTitle, getLocalizedTrainingDescription } from '../src/utils/training-i18n';
import { pushWithParams } from '../src/utils/navigation';
import { theme } from '../src/theme';

function escapeHtml(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function TrainingsHistoryScreen() {
  const { t, currentLanguage } = useI18n();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/documents');
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isDark = effectiveTheme === 'dark';
  const { category } = useRouteParams<{ category: TrainingCategory }>('/trainings-history');
  const trainingCategory = category || 'mandatory';

  const [trainings, setTrainings] = useState<TrainingWithCompletion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [signatureImageUrl, setSignatureImageUrl] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [exportingCertificateId, setExportingCertificateId] = useState<string | null>(null);

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
    return formatDateTimeUtil(dateString);
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
      return t('training.historyMandatory');
    }
    if (trainingCategory === 'onboarding') {
      return t('training.historyOnboarding');
    }
    return t('training.historyProfessional');
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

  const buildCertificateHtml = (params: {
    training: TrainingWithCompletion;
    signatureUrl?: string;
  }) => {
    const { training, signatureUrl } = params;
    const trainee = training.signature?.fullName || user?.username || '-';
    const trainingTitle = trainingCategory === 'onboarding'
      ? getLocalizedTrainingTitle(training, currentLanguage || 'pt')
      : training.title;
    const trainingDescription = trainingCategory === 'onboarding'
      ? getLocalizedTrainingDescription(training, currentLanguage || 'pt')
      : training.description;
    const completedAt = training.completion?.completedAt
      ? formatDate(training.completion.completedAt)
      : '-';
    const totalTime = training.completion?.timeSpentSeconds
      ? formatTime(training.completion.timeSpentSeconds)
      : '-';
    const emittedAt = formatDate(new Date().toISOString());

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Training Certificate</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      color: #0f172a;
      margin: 0;
      background: #f8fafc;
    }
    .sheet {
      background: #ffffff;
      border: 2px solid #0f172a;
      border-radius: 14px;
      padding: 34px;
      box-sizing: border-box;
      min-height: 260mm;
      position: relative;
    }
    .top-accent {
      height: 8px;
      background: linear-gradient(90deg, #0ea5e9, #2563eb);
      border-radius: 6px;
      margin-bottom: 24px;
    }
    .title {
      text-align: center;
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 0.3px;
      margin: 0;
      color: #0f172a;
    }
    .subtitle {
      text-align: center;
      font-size: 15px;
      color: #475569;
      margin: 8px 0 26px 0;
    }
    .center { text-align: center; }
    .label {
      font-size: 14px;
      color: #475569;
      margin: 6px 0;
    }
    .name {
      font-size: 31px;
      font-weight: 800;
      margin: 12px 0 20px 0;
      color: #111827;
    }
    .training {
      font-size: 20px;
      font-weight: 700;
      margin: 10px 0;
      color: #1d4ed8;
    }
    .description {
      margin: 10px auto 0 auto;
      max-width: 86%;
      font-size: 14px;
      color: #334155;
      line-height: 1.5;
    }
    .details {
      margin-top: 28px;
      border: 1px solid #dbeafe;
      background: #eff6ff;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .details-title {
      font-size: 13px;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 18px;
    }
    .details-row { font-size: 13px; color: #1e293b; }
    .strong { font-weight: 700; }
    .signature-block {
      margin-top: 30px;
      text-align: center;
      border-top: 1px dashed #cbd5e1;
      padding-top: 20px;
    }
    .signature-img {
      max-width: 340px;
      max-height: 140px;
      object-fit: contain;
      border-bottom: 1px solid #334155;
      padding-bottom: 10px;
    }
    .signature-caption {
      margin-top: 8px;
      font-size: 12px;
      color: #475569;
    }
    .note {
      margin-top: 26px;
      border: 1px solid #f59e0b;
      background: #fffbeb;
      border-radius: 10px;
      padding: 12px;
      font-size: 12px;
      color: #92400e;
      line-height: 1.45;
    }
    .footer {
      position: absolute;
      left: 34px;
      right: 34px;
      bottom: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top-accent"></div>
    <h1 class="title">Certificado de Conclusao</h1>
    <p class="subtitle">Professional Trainings - Crea Glass</p>

    <div class="center">
      <div class="label">Certificamos que</div>
      <div class="name">${escapeHtml(trainee)}</div>
      <div class="label">concluiu com sucesso o treinamento</div>
      <div class="training">${escapeHtml(trainingTitle)}</div>
      ${trainingDescription ? `<div class="description">${escapeHtml(trainingDescription)}</div>` : ''}
    </div>

    <div class="details">
      <div class="details-title">Resumo da conclusao</div>
      <div class="details-grid">
        <div class="details-row"><span class="strong">Categoria:</span> ${escapeHtml(training.category)}</div>
        <div class="details-row"><span class="strong">Concluido em:</span> ${escapeHtml(completedAt)}</div>
        <div class="details-row"><span class="strong">Tempo total:</span> ${escapeHtml(totalTime)}</div>
        <div class="details-row"><span class="strong">Emitido em:</span> ${escapeHtml(emittedAt)}</div>
      </div>
    </div>

    <div class="signature-block">
      ${signatureUrl ? `<img src="${escapeHtml(signatureUrl)}" class="signature-img" alt="Assinatura" />` : ''}
      <div class="signature-caption">Assinatura do funcionario</div>
      <div class="signature-caption">${escapeHtml(trainee)}</div>
    </div>

    <div class="note">
      <strong>Observacao:</strong> este certificado tem finalidade exclusivamente informativa
      e de registro interno de treinamento. Nao constitui documento oficial para fins legais,
      regulatorios ou de certificacao externa.
    </div>

    <div class="footer">
      <span>Crea Glass - Registro interno de treinamento</span>
      <span>Documento informativo</span>
    </div>
  </div>
</body>
</html>`;
  };

  const handleEmitCertificate = async (training: TrainingWithCompletion) => {
    if (!training.completion || !training.signature) {
      Alert.alert('Erro', 'Treinamento sem dados de conclusao/assinatura.');
      return;
    }
    setExportingCertificateId(training.id);
    const webPrintWindow =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.open('', '_blank')
        : null;
    if (webPrintWindow) {
      webPrintWindow.document.open();
      webPrintWindow.document.write('<html><body style="font-family:Arial;padding:24px;">Gerando certificado...</body></html>');
      webPrintWindow.document.close();
    }
    try {
      let signatureUrl: string | undefined;
      if (training.signature.signaturePath) {
        try {
          const filename = training.signature.signaturePath.replace('signatures/', '');
          signatureUrl = await getCachedSignedUrl(filename, 3600, 'signatures');
        } catch (sigErr) {
          console.warn('Could not load signature URL for certificate, continuing without image:', sigErr);
        }
      }

      const html = buildCertificateHtml({ training, signatureUrl });
      if (Platform.OS === 'web') {
        if (webPrintWindow) {
          try {
            webPrintWindow.document.open();
            webPrintWindow.document.write(html);
            webPrintWindow.document.close();
            setTimeout(() => {
              try {
                webPrintWindow.focus();
                webPrintWindow.print();
              } catch (printErr) {
                console.warn('Web print failed after write:', printErr);
                Alert.alert('Erro', 'Nao foi possivel abrir a impressao. Verifique bloqueio de pop-up.');
              }
            }, 300);
          } catch (writeErr) {
            console.warn('Direct write failed, trying blob URL fallback:', writeErr);
            const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const objectUrl = URL.createObjectURL(htmlBlob);
            webPrintWindow.location.href = objectUrl;
            webPrintWindow.onload = () => {
              try {
                webPrintWindow.focus();
                webPrintWindow.print();
                setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
              } catch (printErr) {
                console.warn('Web print failed:', printErr);
                Alert.alert('Erro', 'Nao foi possivel abrir a impressao. Verifique bloqueio de pop-up.');
              }
            };
          }
        } else {
          Alert.alert('Erro', 'Pop-up bloqueado pelo navegador. Permita pop-ups para emitir o certificado.');
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Emitir certificado',
          });
        }
      }
    } catch (error) {
      console.error('Error emitting certificate:', error);
      if (webPrintWindow) {
        const errorHtml = '<html><body style="font-family:Arial;padding:24px;">Nao foi possivel gerar o certificado. Tente novamente.</body></html>';
        const errorBlob = new Blob([errorHtml], { type: 'text/html;charset=utf-8' });
        const errorUrl = URL.createObjectURL(errorBlob);
        webPrintWindow.location.replace(errorUrl);
        setTimeout(() => URL.revokeObjectURL(errorUrl), 3000);
      }
      Alert.alert('Erro', 'Nao foi possivel emitir o certificado.');
    } finally {
      setExportingCertificateId(null);
    }
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
              onPress={goBack}
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
                  <View
                    key={training.id}
                    style={[styles.trainingCard, { backgroundColor: colors.cardBackground }]}
                  >
                    <View style={styles.trainingHeader}>
                      <Text style={[styles.trainingTitle, { color: colors.text }]} numberOfLines={2}>
                        {trainingCategory === 'onboarding'
                          ? getLocalizedTrainingTitle(training, currentLanguage || 'pt')
                          : training.title}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={[styles.statusText, { color: colors.success }]}>
                          Concluído
                        </Text>
                      </View>
                    </View>

                    {(trainingCategory === 'onboarding'
                      ? getLocalizedTrainingDescription(training, currentLanguage || 'pt')
                      : training.description) && (
                      <Text style={[styles.trainingDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                        {trainingCategory === 'onboarding'
                          ? getLocalizedTrainingDescription(training, currentLanguage || 'pt')
                          : training.description}
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
                                      const filename = training.signature.signaturePath.replace('signatures/', '');
                                      const url = await getCachedSignedUrl(filename, 3600, 'signatures');
                                      if (url) {
                                        setSignatureImageUrl(url);
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
                    <TouchableOpacity
                      style={[styles.viewTrainingRow, { borderTopColor: colors.border }]}
                      onPress={() => pushWithParams(router, '/training-detail', { trainingId: training.id })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="open-outline" size={16} color={colors.primary} />
                      <Text style={[styles.viewTrainingText, { color: colors.primary }]}>
                        Ver treinamento e mídia
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.certificateButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
                      onPress={() => handleEmitCertificate(training)}
                      activeOpacity={0.7}
                      disabled={exportingCertificateId === training.id}
                    >
                      {exportingCertificateId === training.id ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="ribbon-outline" size={16} color={colors.primary} />
                          <Text style={[styles.certificateButtonText, { color: colors.primary }]}>
                            Emitir certificado
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
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
  certificateButton: {
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  certificateButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
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
