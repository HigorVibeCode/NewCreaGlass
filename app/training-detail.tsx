import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import SignatureCanvas from 'react-native-signature-canvas';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { repos } from '../src/services/container';
import { Training, TrainingCompletion } from '../src/types';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { SlideToConfirm } from '../src/components/shared/SlideToConfirm';
import { PermissionGuard } from '../src/components/shared/PermissionGuard';
import { confirmDelete } from '../src/utils/confirm-dialog';

type TrainingState = 'not_started' | 'in_progress' | 'signature_required' | 'completed';

export default function TrainingDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { trainingId } = useLocalSearchParams<{ trainingId: string }>();

  const [training, setTraining] = useState<Training | null>(null);
  const [completion, setCompletion] = useState<TrainingCompletion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [trainingState, setTrainingState] = useState<TrainingState>('not_started');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const signatureRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [canComplete, setCanComplete] = useState(false);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const isReadingSignatureRef = useRef(false);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const scrollViewRef = useRef<any>(null);

  useEffect(() => {
    if (trainingId) {
      loadTraining();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [trainingId]);

  // Recarregar quando a tela receber foco (para atualizar após exclusão ou outras mudanças)
  useFocusEffect(
    useCallback(() => {
      if (trainingId) {
        loadTraining();
      }
    }, [trainingId])
  );

  // Timer que só roda quando o treinamento está em progresso
  useEffect(() => {
    if (trainingState === 'in_progress' && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        setTimeSpent(elapsed);
        updateTrainingTime(elapsed);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [trainingState]);

  const loadTraining = async () => {
    if (!trainingId || !user) return;
    setIsLoading(true);
    try {
      const trainingData = await repos.trainingRepo.getTrainingById(trainingId);
      if (trainingData) {
        setTraining(trainingData);
        
        // Verificar se já existe uma conclusão
        const existingCompletion = await repos.trainingRepo.getTrainingCompletion(trainingId, user.id);
        if (existingCompletion) {
          setCompletion(existingCompletion);
          if (existingCompletion.completedAt) {
            // Já foi concluído - mas permite refazer
            // Treinamentos concluídos vão para histórico, mas podem ser refeitos
            setTrainingState('not_started'); // Permite reiniciar
            setTimeSpent(0);
          } else {
            // Está em andamento - retomar timer
            setTrainingState('in_progress');
            const startTime = new Date(existingCompletion.startedAt).getTime();
            startTimeRef.current = startTime;
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setTimeSpent(existingCompletion.timeSpentSeconds || elapsed);
          }
        } else {
          // Não foi iniciado ainda
          setTrainingState('not_started');
        }
      } else {
        Alert.alert(t('common.error') || 'Erro', 'Treinamento não encontrado', [
          { text: t('common.confirm') || 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error loading training:', error);
      Alert.alert(t('common.error') || 'Erro', 'Falha ao carregar treinamento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTraining = async () => {
    if (!trainingId || !user) return;
    
    try {
      // Iniciar treinamento
      const trainingCompletion = await repos.trainingRepo.startTraining(trainingId, user.id);
      setCompletion(trainingCompletion);
      
      const startTime = new Date(trainingCompletion.startedAt).getTime();
      startTimeRef.current = startTime;
      setTimeSpent(0);
      setTrainingState('in_progress');
    } catch (error) {
      console.error('Error starting training:', error);
      Alert.alert(t('common.error') || 'Erro', 'Falha ao iniciar treinamento');
    }
  };

  const updateTrainingTime = async (seconds: number) => {
    if (!trainingId || !user || trainingState !== 'in_progress') return;
    
    try {
      await repos.trainingRepo.updateTrainingTime(trainingId, user.id, seconds);
    } catch (error) {
      console.error('Error updating training time:', error);
    }
  };

  const handleRequestSignature = () => {
    // Verificar se o treinamento está em progresso
    if (trainingState !== 'in_progress') {
      Alert.alert(t('common.error') || 'Erro', 'O treinamento precisa estar em andamento para ser concluído');
      return;
    }
    // Resetar estados do modal antes de abrir
    setFullName('');
    setSignatureBase64(null);
    setPendingSignature(null);
    isReadingSignatureRef.current = false;
    setShowSignatureModal(true);
  };

  const handleSignatureComplete = () => {
    // Verificar nome primeiro
    if (!fullName.trim()) {
      Alert.alert(t('common.error') || 'Erro', 'Por favor, digite seu nome completo');
      return;
    }

    // Se já temos a assinatura no estado, verificar se é válida
    if (signatureBase64 && signatureBase64.length > 0) {
      const base64Data = signatureBase64.replace(/^data:image\/png;base64,/, '');
      if (base64Data && base64Data.length > 100) {
        setCanComplete(true);
        setTrainingState('signature_required');
        setShowSignatureModal(false);
        return;
      } else {
        // Assinatura inválida, tentar ler novamente
        setSignatureBase64(null);
      }
    }

    // Caso contrário, tentar ler a assinatura do canvas
    if (signatureRef.current) {
      isReadingSignatureRef.current = true;
      setPendingSignature('waiting');
      // readSignature() vai trigger onOK ou onEmpty
      try {
        signatureRef.current.readSignature();
      } catch (error) {
        console.error('Error reading signature:', error);
        isReadingSignatureRef.current = false;
        setPendingSignature(null);
        Alert.alert(
          t('common.error') || 'Erro', 
          'Não foi possível ler a assinatura. Por favor, desenhe sua assinatura no canvas e clique em "Salvar Assinatura" primeiro.'
        );
      }
    } else {
      Alert.alert(
        t('common.error') || 'Erro', 
        'Por favor, desenhe sua assinatura no campo acima. Você pode clicar em "Salvar Assinatura" no canvas ou usar este botão.'
      );
    }
  };

  const handleSignatureOK = (signature: string) => {
    console.log('Signature OK callback, length:', signature?.length);
    // Verificar se a assinatura tem conteúdo válido (mais que apenas o prefixo data:image)
    const base64Data = signature.replace(/^data:image\/png;base64,/, '');
    const hasContent = base64Data && base64Data.length > 100; // Assinatura válida tem pelo menos 100 caracteres
    
    if (signature && signature.length > 0 && hasContent) {
      // A assinatura já vem no formato correto do SignatureCanvas (data:image/png;base64,...)
      setSignatureBase64(signature);
      setPendingSignature(null);
      
      // Se estávamos aguardando (isReadingSignatureRef), processar automaticamente
      if (isReadingSignatureRef.current) {
        isReadingSignatureRef.current = false;
        // Verificar se temos nome também
        if (fullName.trim()) {
          // Pequeno delay para garantir que o estado foi atualizado
          setTimeout(() => {
            setCanComplete(true);
            setTrainingState('signature_required');
            setShowSignatureModal(false);
          }, 100);
        } else {
          Alert.alert(t('common.error') || 'Erro', 'Por favor, digite seu nome completo');
        }
      }
    } else {
      setSignatureBase64(null);
      setPendingSignature(null);
      if (isReadingSignatureRef.current) {
        isReadingSignatureRef.current = false;
        Alert.alert(
          t('common.error') || 'Erro',
          'A assinatura está vazia ou muito curta. Por favor, desenhe sua assinatura novamente.'
        );
      } else {
        // Se o usuário clicou em "Salvar Assinatura" mas a assinatura está vazia
        Alert.alert(
          t('common.error') || 'Erro',
          'Por favor, desenhe sua assinatura no canvas antes de salvar.'
        );
      }
    }
  };

  const handleSignatureEmpty = () => {
    console.log('Signature empty callback');
    setSignatureBase64(null);
    setPendingSignature(null);
    if (isReadingSignatureRef.current) {
      isReadingSignatureRef.current = false;
      Alert.alert(
        t('common.error') || 'Erro',
        'A assinatura está vazia. Por favor, desenhe sua assinatura no canvas.'
      );
    }
  };

  // Resetar estados quando o modal é fechado (mas manter assinatura se já foi salva)
  useEffect(() => {
    if (!showSignatureModal && !isProcessing) {
      // Se o modal foi fechado sem completar, resetar apenas o pendingSignature
      // Mas manter signatureBase64 e fullName se já foram preenchidos
      setPendingSignature(null);
    }
  }, [showSignatureModal, isProcessing]);

  const handleComplete = async () => {
    if (!canComplete || !signatureBase64 || !fullName.trim()) {
      return;
    }

    setIsProcessing(true);
    
    try {
      // Obter localização
      let location;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const locationData = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          location = locationData;
        }
      } catch (locationError) {
        console.error('Error getting location for signature:', locationError);
      }

      const latitude = location?.coords?.latitude || 0;
      const longitude = location?.coords?.longitude || 0;

      // A assinatura já vem no formato correto do SignatureCanvas (data:image/png;base64,...)
      // Completar treinamento com assinatura
      await repos.trainingRepo.completeTraining(
        trainingId!,
        user!.id,
        signatureBase64,
        fullName.trim(),
        latitude,
        longitude
      );

      // Parar o timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Recarregar dados
      await loadTraining();

      Alert.alert(
        t('common.success') || 'Sucesso',
        'Treinamento concluído com sucesso!',
        [
          { text: t('common.confirm') || 'OK', onPress: () => router.back() },
        ]
      );
    } catch (error) {
      console.error('Error completing training:', error);
      Alert.alert(t('common.error') || 'Erro', 'Falha ao concluir treinamento');
    } finally {
      setIsProcessing(false);
      setCanComplete(false);
      setShowSignatureModal(false);
      setFullName('');
      setSignatureBase64(null);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

  const handleOpenAttachment = async (attachment: any) => {
    try {
      const url = await repos.trainingRepo.getTrainingAttachmentUrl(attachment.attachmentId || attachment.id);
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('common.error') || 'Erro', 'Não foi possível abrir o arquivo');
      }
    } catch (error) {
      console.error('Error opening attachment:', error);
      Alert.alert(t('common.error') || 'Erro', 'Falha ao abrir anexo');
    }
  };

  const handleDelete = () => {
    if (!trainingId) return;
    
    confirmDelete(
      t('common.delete') || 'Excluir',
      'Tem certeza que deseja excluir este treinamento? Esta ação não pode ser desfeita.',
      async () => {
        try {
          await repos.trainingRepo.deleteTraining(trainingId);
          Alert.alert(t('common.success') || 'Sucesso', 'Treinamento excluído com sucesso', [
            { text: t('common.confirm') || 'OK', onPress: () => router.back() },
          ]);
        } catch (error) {
          console.error('Error deleting training:', error);
          Alert.alert(t('common.error') || 'Erro', 'Falha ao excluir treinamento');
        }
      },
      undefined,
      t('common.delete') || 'Excluir',
      t('common.cancel') || 'Cancelar',
      'Treinamento excluído com sucesso',
      'Falha ao excluir treinamento'
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!training) {
    return null;
  }

  const isCompleted = trainingState === 'completed';

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
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {training.title}
            </Text>
            <View style={styles.headerRight}>
              <PermissionGuard permission="documents.delete">
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDelete}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={24} color={colors.error} />
                </TouchableOpacity>
              </PermissionGuard>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Status Card */}
          <View style={[styles.statusCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.statusHeader}>
              <View style={[styles.statusBadge, { 
                backgroundColor: isCompleted 
                  ? colors.success + '20' 
                  : trainingState === 'in_progress' 
                    ? colors.primary + '20' 
                    : colors.backgroundSecondary 
              }]}>
                <Ionicons
                  name={isCompleted ? 'checkmark-circle' : trainingState === 'in_progress' ? 'play-circle' : 'time-outline'}
                  size={24}
                  color={isCompleted ? colors.success : trainingState === 'in_progress' ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.statusText, {
                  color: isCompleted ? colors.success : trainingState === 'in_progress' ? colors.primary : colors.textSecondary
                }]}>
                  {isCompleted ? 'Concluído' : trainingState === 'in_progress' ? 'Em Andamento' : 'Não Iniciado'}
                </Text>
              </View>
            </View>

            {training.description && (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {training.description}
              </Text>
            )}

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Duração</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {training.durationMinutes ? `${training.durationMinutes} min` : 'Não especificada'}
                </Text>
              </View>

              {trainingState === 'in_progress' && (
                <View style={[styles.infoItem, { backgroundColor: colors.primary + '10' }]}>
                  <Ionicons name="timer" size={18} color={colors.primary} />
                  <Text style={[styles.infoLabel, { color: colors.primary }]}>Tempo Ativo</Text>
                  <Text style={[styles.infoValue, { color: colors.primary, fontWeight: 'bold' }]}>
                    {formatTime(timeSpent)}
                  </Text>
                </View>
              )}

              {isCompleted && completion && (
                <>
                  <View style={styles.infoItem}>
                    <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Concluído em</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {formatDate(completion.completedAt!)}
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Ionicons name="time" size={18} color={colors.textSecondary} />
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Tempo Total</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {formatTime(completion.timeSpentSeconds)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Start Training Button - Only show when not started */}
          {trainingState === 'not_started' && (
            <View style={styles.startSection}>
              <Text style={[styles.startTitle, { color: colors.text }]}>
                Pronto para começar?
              </Text>
              <Text style={[styles.startDescription, { color: colors.textSecondary }]}>
                Deslize o botão abaixo para iniciar o treinamento. O timer começará automaticamente.
              </Text>
              <SlideToConfirm
                onConfirm={handleStartTraining}
                text="Deslize para iniciar o treinamento"
                confirmText="Iniciar"
              />
            </View>
          )}

          {/* Content - Only show when in progress or completed */}
          {(trainingState === 'in_progress' || trainingState === 'signature_required' || isCompleted) && (
            <>
              {training.content && (
                <View style={[styles.contentCard, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Conteúdo do Treinamento</Text>
                  <View style={[styles.contentBox, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={[styles.contentText, { color: colors.text }]}>
                      {training.content}
                    </Text>
                  </View>
                </View>
              )}

              {/* Attachments */}
              {training.attachments && training.attachments.length > 0 && (
                <View style={[styles.contentCard, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Anexos PDF</Text>
                  <View style={styles.attachmentsList}>
                    {training.attachments.map((attachment) => (
                      <TouchableOpacity
                        key={attachment.id}
                        style={[styles.attachmentCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                        onPress={() => handleOpenAttachment(attachment)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.attachmentContent}>
                          <View style={[styles.attachmentIcon, { backgroundColor: colors.error + '20' }]}>
                            <Ionicons name="document-text" size={24} color={colors.error} />
                          </View>
                          <View style={styles.attachmentInfo}>
                            <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
                              {attachment.filename}
                            </Text>
                            <Text style={[styles.attachmentType, { color: colors.textSecondary }]}>
                              PDF
                            </Text>
                          </View>
                          <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Completion Actions */}
              {trainingState === 'in_progress' && (
                <View style={styles.actionSection}>
                  <View style={[styles.timerCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
                    <View style={styles.timerHeader}>
                      <Ionicons name="timer" size={24} color={colors.primary} />
                      <Text style={[styles.timerTitle, { color: colors.primary }]}>
                        Treinamento em Andamento
                      </Text>
                    </View>
                    <Text style={[styles.timerValue, { color: colors.primary }]}>
                      {formatTime(timeSpent)}
                    </Text>
                    <Text style={[styles.timerDescription, { color: colors.textSecondary }]}>
                      O tempo está sendo contabilizado enquanto você lê o conteúdo.
                    </Text>
                  </View>
                  
                  <View style={styles.completionSection}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>
                      Finalizar Treinamento
                    </Text>
                    <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                      Após ler todo o conteúdo, você precisará assinar digitalmente para confirmar a conclusão.
                    </Text>
                    <Button
                      title="Assinar e Concluir"
                      onPress={handleRequestSignature}
                      disabled={isProcessing}
                    />
                  </View>
                </View>
              )}

              {trainingState === 'signature_required' && canComplete && (
                <View style={styles.actionSection}>
                  <View style={[styles.signatureConfirmation, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                    <Text style={[styles.signatureConfirmationText, { color: colors.success }]}>
                      Assinatura confirmada! Você pode concluir o treinamento.
                    </Text>
                  </View>
                  <View style={styles.completionSection}>
                    <Text style={[styles.actionDescription, { color: colors.textSecondary, marginBottom: theme.spacing.md }]}>
                      Ao concluir, o treinamento será marcado como finalizado e não poderá ser reiniciado.
                    </Text>
                    <Button
                      title="Concluir Treinamento"
                      onPress={handleComplete}
                      loading={isProcessing}
                      disabled={isProcessing || !canComplete}
                    />
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Signature Modal */}
        <Modal
          visible={showSignatureModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (!isProcessing) {
              setShowSignatureModal(false);
              setFullName('');
              setSignatureBase64(null);
            }
          }}
        >
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay || 'rgba(0, 0, 0, 0.5)' }]}>
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Assinatura Digital
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!isProcessing) {
                      setShowSignatureModal(false);
                      setFullName('');
                      setSignatureBase64(null);
                    }
                  }}
                  disabled={isProcessing}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                ref={scrollViewRef}
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalContentContainer}
                showsVerticalScrollIndicator={true}
                bounces={true}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={false}
                scrollEnabled={!isDrawingSignature}
                scrollEventThrottle={16}
              >
                <Text style={[styles.modalText, { color: colors.textSecondary }]}>
                  Por favor, assine digitalmente para confirmar a conclusão do treinamento.
                </Text>

                <Input
                  label="Nome Completo *"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Digite seu nome completo"
                  style={styles.nameInput}
                />

                <View 
                  style={[styles.signatureContainer, { borderColor: colors.border, backgroundColor: '#ffffff' }]}
                  onTouchStart={() => setIsDrawingSignature(true)}
                  onTouchEnd={() => setTimeout(() => setIsDrawingSignature(false), 100)}
                  onTouchCancel={() => setIsDrawingSignature(false)}
                >
                  <SignatureCanvas
                    ref={signatureRef}
                    onOK={handleSignatureOK}
                    onEmpty={handleSignatureEmpty}
                    descriptionText=""
                    clearText="Limpar"
                    confirmText="Salvar Assinatura"
                    penColor="#000000"
                    backgroundColor="#ffffff"
                    minWidth={2}
                    maxWidth={3}
                    webStyle={`
                      .m-signature-pad {
                        box-shadow: none;
                        border: none;
                        border-radius: ${theme.borderRadius.md}px;
                        width: 100%;
                        height: 100%;
                        touch-action: none;
                        -webkit-user-select: none;
                        user-select: none;
                      }
                      .m-signature-pad--body {
                        border: none;
                        width: 100%;
                        height: 100%;
                        touch-action: none;
                        -webkit-overflow-scrolling: none;
                        overflow: hidden;
                        position: relative;
                      }
                      .m-signature-pad--body canvas {
                        border-radius: ${theme.borderRadius.md}px;
                        touch-action: none !important;
                        -ms-touch-action: none !important;
                        -webkit-touch-callout: none;
                        -webkit-user-select: none;
                        user-select: none;
                        width: 100% !important;
                        height: 100% !important;
                        pointer-events: auto;
                        display: block;
                      }
                      .m-signature-pad--footer {
                        display: flex;
                        justify-content: space-between;
                        padding: 10px;
                        border-top: 1px solid ${colors.border};
                        touch-action: manipulation;
                      }
                      .m-signature-pad--footer button {
                        background-color: ${colors.primary};
                        color: ${colors.background};
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        touch-action: manipulation;
                      }
                    `}
                  />
                </View>

                <View style={styles.modalButtonContainer}>
                  <View style={styles.buttonStatusContainer}>
                    {pendingSignature === 'waiting' ? (
                      <View style={[styles.statusIndicator, { backgroundColor: colors.primary + '20' }]}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.statusText, { color: colors.primary }]}>
                          Processando assinatura...
                        </Text>
                      </View>
                    ) : signatureBase64 && fullName.trim() ? (
                      <View style={[styles.statusIndicator, { backgroundColor: colors.success + '20' }]}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        <Text style={[styles.statusText, { color: colors.success }]}>
                          Assinatura e nome preenchidos ✓
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.statusIndicator, { backgroundColor: colors.warning + '20' }]}>
                        <Ionicons name="alert-circle" size={20} color={colors.warning} />
                        <Text style={[styles.statusText, { color: colors.warning }]}>
                          {!fullName.trim() 
                            ? 'Digite seu nome completo' 
                            : 'Desenhe sua assinatura no canvas. Você pode clicar em "Salvar Assinatura" no canvas ou usar o botão abaixo'}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <Button
                    title="Confirmar e Continuar"
                    onPress={handleSignatureComplete}
                    disabled={!fullName.trim() || pendingSignature === 'waiting' || isProcessing}
                    style={styles.confirmButton}
                    loading={isProcessing || pendingSignature === 'waiting'}
                  />
                </View>
              </ScrollView>
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
  headerTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  headerSpacer: {
    width: 40,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  statusCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  statusHeader: {
    marginBottom: theme.spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  description: {
    fontSize: theme.typography.fontSize.md,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.lineHeight.md * 1.3,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'transparent',
    gap: theme.spacing.xs,
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  startSection: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'transparent',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  startTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'center',
  },
  startDescription: {
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.sm * 1.4,
  },
  contentCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.md,
  },
  contentBox: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  contentText: {
    fontSize: theme.typography.fontSize.md,
    lineHeight: theme.typography.lineHeight.md * 1.6,
  },
  attachmentsList: {
    gap: theme.spacing.sm,
  },
  attachmentCard: {
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  attachmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  attachmentIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentInfo: {
    flex: 1,
    gap: theme.spacing.xs / 2,
  },
  attachmentName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
  },
  attachmentType: {
    fontSize: theme.typography.fontSize.xs,
  },
  actionSection: {
    gap: theme.spacing.md,
  },
  timerCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timerTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  timerValue: {
    fontSize: theme.typography.fontSize.xxxl,
    fontWeight: theme.typography.fontWeight.bold,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  timerDescription: {
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
  },
  completionSection: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'transparent',
    gap: theme.spacing.md,
  },
  actionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  actionDescription: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.sm * 1.4,
  },
  signatureConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    marginBottom: theme.spacing.sm,
  },
  signatureConfirmationText: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  modalContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 500 : '95%',
    maxHeight: Platform.OS === 'web' ? '90%' : '85%',
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.lg,
    overflow: 'hidden',
    flex: 1,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    minHeight: 56,
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
  modalScrollView: {
    flex: 1,
    maxHeight: '100%',
  },
  modalContentContainer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
    flexGrow: 1,
  },
  modalText: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.sm * 1.4,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  nameInput: {
    marginBottom: 0,
  },
  signatureContainer: {
    height: 250,
    width: '100%',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginVertical: theme.spacing.sm,
    position: 'relative',
  },
  modalButtonContainer: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  validationHint: {
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
  },
  instructionText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    marginBottom: theme.spacing.sm,
  },
  instructionStep: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.xs,
    paddingLeft: theme.spacing.md,
  },
  confirmButton: {
    marginTop: theme.spacing.md,
  },
  buttonStatusContainer: {
    marginBottom: theme.spacing.sm,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  statusText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    flex: 1,
  },
});
