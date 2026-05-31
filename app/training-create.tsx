import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRouteParams } from '../src/hooks/use-route-params';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack, safeBack } from '../src/hooks/use-go-back';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { repos } from '../src/services/container';
import { Training, TrainingCategory, TrainingAttachment } from '../src/types';
import { theme } from '../src/theme';

const MAX_ATTACHMENTS = 5;
/** Limite técnico alvo quando o projeto Supabase (Pro+) tem Storage global suficiente. No plano Free o backend impõe máx. 50 MB/object. */
const MAX_TRAINING_ATTACHMENT_BYTES = 262144000; // 250 MB

function appendSupabaseStorageSizeHint(message: string): string {
  const m = message.toLowerCase();
  if (!m.includes('maximum') && !m.includes('exceeded') && !m.includes('object is too')) {
    return message;
  }
  return `${message}\n\n` +
    'Limite no Supabase: no plano Free o tamanho máximo global por arquivo é 50 MB — não aumenta só com migration no repo. Para arquivos maiores: aumente em Dashboard → Storage → Configuration ("Global file size limit") no plano adequado ou use um vídeo/arquivo menor.';
}

function inferMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'avi') return 'video/x-msvideo';
  if (ext === 'webm') return 'video/webm';
  return 'application/octet-stream';
}

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

function generateLocalAttachmentId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `attach-${globalThis.crypto.randomUUID()}`;
  }
  return `attach-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export default function TrainingCreateScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/documents');
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const { trainingId, category } = useRouteParams<{ trainingId?: string; category: TrainingCategory }>('/training-create');
  const trainingCategory = category || 'mandatory';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [titleI18n, setTitleI18n] = useState<Record<string, string>>({});
  const [descriptionI18n, setDescriptionI18n] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Array<{ id: string; filename: string; mimeType: string; uri: string; isNew?: boolean; attachmentId?: string; webFile?: File }>>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState<Set<string>>(new Set());

  const CONTENT_LOCALES = ['en', 'es', 'de', 'fr', 'it'] as const;
  const LOCALE_LABELS: Record<string, string> = { en: 'EN', es: 'ES', de: 'DE', fr: 'FR', it: 'IT' };

  const isEditing = !!trainingId;

  useEffect(() => {
    if (trainingId) {
      loadTraining();
    }
  }, [trainingId]);

  const loadTraining = async () => {
    if (!trainingId) return;
    setIsLoading(true);
    try {
      const training = await repos.trainingRepo.getTrainingById(trainingId);
      if (training) {
        setTitle(training.title);
        setDescription(training.description || '');
        if (training.category === 'professional') setContent(training.content || '');
        if (training.category === 'onboarding') {
          setTitleI18n(training.titleI18n || {});
          setDescriptionI18n(training.descriptionI18n || {});
        }
        // Load attachments
        if (training.attachments) {
          setAttachments(training.attachments.map(att => ({
            id: att.id,
            filename: att.filename,
            mimeType: att.mimeType,
            uri: att.storagePath,
            isNew: false,
            attachmentId: att.id,
          })));
        }
      } else {
        Alert.alert(t('common.error'), t('training.trainingNotFound'), [
          { text: t('common.ok') || t('common.confirm'), onPress: () => safeBack(router) },
        ]);
      }
    } catch (error) {
      console.error('Error loading training:', error);
      Alert.alert(t('common.error'), t('training.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChooseDocument = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
        Alert.alert(t('common.error'), t('training.maxAttachments', { count: MAX_ATTACHMENTS }));
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'video/webm',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const fileSize = (file as any).size as number | undefined;
      if (typeof fileSize === 'number' && fileSize > MAX_TRAINING_ATTACHMENT_BYTES) {
        showMessage(
          t('common.error'),
          `Arquivo muito grande. Limite do app: 250 MB.\n\nArquivo: ${(fileSize / (1024 * 1024)).toFixed(1)} MB`
        );
        return;
      }
      const SUPABASE_FREE_GLOBAL_MAX_BYTES = 52428800; // 50 MB — limite máximo Supabase Storage no plano Free
      if (typeof fileSize === 'number' && fileSize > SUPABASE_FREE_GLOBAL_MAX_BYTES) {
        showMessage(
          'Tamanho e plano Supabase',
          `Este arquivo tem ${(fileSize / (1024 * 1024)).toFixed(1)} MB. No plano Free do Supabase o limite global de upload é 50 MB por arquivo — o servidor recusa valores maiores, mesmo alterando apenas o bucket. Para aceitar até 250 MB você precisa de plano pago e aumentar "Global file size limit" em Storage → Configuration.\n\nPode tentar mesmo assim se o projeto já estiver atualizado no Dashboard.`
        );
      }
      const inferredMime = inferMimeTypeFromFilename(file.name);
      const fileMimeType = file.mimeType && file.mimeType !== 'application/octet-stream'
        ? file.mimeType
        : inferredMime;
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const isPDF = fileMimeType === 'application/pdf' || extension === 'pdf';
      const isVideo =
        fileMimeType.startsWith('video/') ||
        ['mp4', 'mov', 'avi', 'webm'].includes(extension);

      if (!isPDF && !isVideo) {
        showMessage(t('common.error'), t('training.onlyPdfVideoAllowed'));
        return;
      }

      const newAttachment = {
        id: generateLocalAttachmentId(),
        filename: file.name,
        mimeType: fileMimeType,
        uri: file.uri,
        isNew: true,
        webFile: (file as any).file,
      };

      setAttachments((prev) => [...prev, newAttachment]);
    } catch (error) {
      console.error('Error picking document:', error);
      showMessage(t('common.error'), t('training.selectDocumentError'));
    }
  };

  const confirmRemoveStoredAttachment = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    const run = async () => {
      try {
        await onConfirm();
      } catch (error) {
        console.error('Error deleting attachment:', error);
        showMessage(t('common.error'), t('training.removeAttachmentError'));
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) {
        void run();
      }
      return;
    }
    Alert.alert(title, message, [
      { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
      {
        text: t('common.delete') || 'Excluir',
        style: 'destructive',
        onPress: () => void run(),
      },
    ]);
  };

  const handleRemoveAttachment = (id: string) => {
    const attachment = attachments.find((att) => att.id === id);
    if (attachment && !attachment.isNew && attachment.attachmentId) {
      confirmRemoveStoredAttachment(
        t('common.confirm'),
        t('training.removeAttachmentConfirm'),
        async () => {
          await repos.trainingRepo.deleteTrainingAttachment(attachment.attachmentId!);
          setAttachments((prev) => prev.filter((att) => att.id !== id));
        }
      );
    } else {
      setAttachments((prev) => prev.filter((att) => att.id !== id));
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      showMessage(t('common.error'), t('training.titleRequired'));
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsCreating(true);
    try {
      const trainingData: Omit<Training, 'id' | 'createdAt' | 'updatedAt' | 'attachments'> = {
        title: title.trim(),
        description: description.trim() || undefined,
        category: trainingCategory,
        content: trainingCategory === 'professional' ? (content.trim() || undefined) : undefined,
        durationMinutes: undefined,
        isActive: true,
        createdBy: '', // Será preenchido pelo repository
      };
      if (trainingCategory === 'onboarding') {
        const titleI18nFiltered = Object.fromEntries(
          Object.entries(titleI18n).filter(([, v]) => v != null && v.trim() !== '')
        );
        const descriptionI18nFiltered = Object.fromEntries(
          Object.entries(descriptionI18n).filter(([, v]) => v != null && v.trim() !== '')
        );
        if (Object.keys(titleI18nFiltered).length > 0) (trainingData as Training).titleI18n = titleI18nFiltered;
        if (Object.keys(descriptionI18nFiltered).length > 0) (trainingData as Training).descriptionI18n = descriptionI18nFiltered;
      }

      let savedTrainingId: string;

      if (isEditing && trainingId) {
        await repos.trainingRepo.updateTraining(trainingId, trainingData);
        savedTrainingId = trainingId;
      } else {
        const newTraining = await repos.trainingRepo.createTraining(trainingData);
        savedTrainingId = newTraining.id;
      }

      // Upload new attachments
      const newAttachments = attachments.filter(att => att.isNew);
      let uploadedCount = 0;
      let failedCount = 0;
      const uploadErrors: string[] = [];
      let uploadStatusMessage = '';
      if (newAttachments.length > 0) {
        setUploadingAttachments(new Set(newAttachments.map(att => att.id)));
        for (const attachment of newAttachments) {
          try {
            const uploadPayload =
              Platform.OS === 'web' && attachment.webFile instanceof File
                ? {
                    uri: attachment.uri,
                    name: attachment.filename,
                    type: attachment.mimeType,
                    webFile: attachment.webFile,
                  }
                : {
                    uri: attachment.uri,
                    name: attachment.filename,
                    type: attachment.mimeType,
                  };
            await repos.trainingRepo.addTrainingAttachment(savedTrainingId, uploadPayload as any);
            uploadedCount += 1;
          } catch (uploadErr) {
            failedCount += 1;
            console.error('Error uploading attachment:', attachment.filename, uploadErr);
            const message = appendSupabaseStorageSizeHint(
              uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
            );
            uploadErrors.push(`${attachment.filename}: ${message}`);
          }
        }
        setUploadingAttachments(new Set());

        if (failedCount > 0 && uploadedCount === 0) {
          uploadStatusMessage = t('training.uploadAttachmentsError');
        } else if (failedCount > 0 && uploadedCount > 0) {
          uploadStatusMessage = `${uploadedCount} ${t('training.attachments')} enviados, ${failedCount} com falha.`;
        } else if (uploadedCount > 0) {
          uploadStatusMessage = `${uploadedCount} ${uploadedCount === 1 ? t('training.attachment') : t('training.attachments')} enviado(s) com sucesso.`;
        }

        if (failedCount > 0) {
          const details = uploadErrors.length > 0 ? `\n\n${uploadErrors.slice(0, 2).join('\n')}` : '';
          showMessage(t('common.error'), `${uploadStatusMessage || t('training.uploadAttachmentsError')}${details}`);
          // Keep the user on this screen so they can retry attachment upload.
          return;
        }
      }

      const baseSuccess = isEditing ? t('training.trainingUpdated') : t('training.trainingCreated');
      const finalSuccessMessage = uploadStatusMessage
        ? `${baseSuccess}\n\n${uploadStatusMessage}`
        : baseSuccess;

      showMessage(t('common.success'), finalSuccessMessage);
      safeBack(router);
    } catch (error) {
      console.error('Error saving training:', error);
      const errorMessage =
        error instanceof Error && error.message
          ? `${t('training.saveError')}\n\n${error.message}`
          : t('training.saveError');
      showMessage(t('common.error'), errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const getCategoryTitle = () => {
    if (trainingCategory === 'mandatory') {
      return t('training.category.mandatory');
    }
    if (trainingCategory === 'onboarding') {
      return t('training.category.onboarding');
    }
    return t('training.category.professional');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {isEditing ? t('training.editTraining') : t('training.newTraining')}
            </Text>
            <View style={styles.headerSpacer} />
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + theme.spacing.md }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {getCategoryTitle()}
              </Text>
              
              <Input
                label={`${t('training.titleLabel')} *`}
                value={title}
                onChangeText={setTitle}
                placeholder={t('training.titlePlaceholder')}
              />

              <Input
                label={t('training.descriptionLabel')}
                value={description}
                onChangeText={setDescription}
                placeholder={t('training.descriptionPlaceholder')}
                multiline
                numberOfLines={3}
              />

              {trainingCategory === 'professional' && (
                <Input
                  label={t('training.contentLabel')}
                  value={content}
                  onChangeText={setContent}
                  placeholder={t('training.contentPlaceholder')}
                  multiline
                  numberOfLines={10}
                />
              )}

              {trainingCategory === 'onboarding' && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text, marginTop: theme.spacing.md }]}>
                    {t('training.translationsSection')}
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                    {t('training.translationsSectionHint')}
                  </Text>
                  {CONTENT_LOCALES.map((locale) => (
                    <View key={locale} style={styles.translationBlock}>
                      <Input
                        label={`${t('training.titleLabel')} (${LOCALE_LABELS[locale]})`}
                        value={titleI18n[locale] ?? ''}
                        onChangeText={(text) => setTitleI18n((prev) => ({ ...prev, [locale]: text }))}
                        placeholder={t('training.titlePlaceholder')}
                      />
                      <Input
                        label={`${t('training.descriptionLabel')} (${LOCALE_LABELS[locale]})`}
                        value={descriptionI18n[locale] ?? ''}
                        onChangeText={(text) => setDescriptionI18n((prev) => ({ ...prev, [locale]: text }))}
                        placeholder={t('training.descriptionPlaceholder')}
                        multiline
                        numberOfLines={2}
                      />
                    </View>
                  ))}
                </>
              )}

            </View>

            {/* Attachments Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('training.mediaLabel')}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                {t('training.mediaSubtitle', { count: MAX_ATTACHMENTS })}
              </Text>

              {attachments.length > 0 && (
                <View style={styles.attachmentsList}>
                  {attachments.map((attachment) => (
                    <View
                      key={attachment.id}
                      style={[styles.attachmentItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    >
                      <View style={styles.attachmentInfo}>
                        <Ionicons
                          name={attachment.mimeType.startsWith('video/') ? 'videocam' : 'document-text'}
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
                          {attachment.filename}
                        </Text>
                      </View>
                      {uploadingAttachments.has(attachment.id) ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleRemoveAttachment(attachment.id)}
                          style={styles.removeButton}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                          <Ionicons name="close-circle" size={24} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {attachments.length < MAX_ATTACHMENTS && (
                <TouchableOpacity
                  style={[styles.addAttachmentButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                  onPress={handleChooseDocument}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  <Text style={[styles.addAttachmentText, { color: colors.primary }]}>
                    {t('training.addMedia')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title={isEditing ? (t('common.save') || 'Salvar') : (t('common.create') || 'Criar')}
                onPress={handleSave}
                loading={isCreating}
                disabled={isCreating}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    marginBottom: theme.spacing.sm,
  },
  translationBlock: {
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  buttonContainer: {
    marginTop: theme.spacing.md,
  },
  sectionSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.lineHeight.sm * 1.2,
  },
  attachmentsList: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  attachmentName: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  addAttachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addAttachmentText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
  },
});
