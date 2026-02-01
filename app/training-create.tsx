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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { repos } from '../src/services/container';
import { Training, TrainingCategory, TrainingAttachment } from '../src/types';
import { theme } from '../src/theme';

const MAX_ATTACHMENTS = 5;

export default function TrainingCreateScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const { trainingId, category } = useLocalSearchParams<{ trainingId?: string; category: TrainingCategory }>();
  const trainingCategory = category || 'mandatory';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [titleI18n, setTitleI18n] = useState<Record<string, string>>({});
  const [descriptionI18n, setDescriptionI18n] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Array<{ id: string; filename: string; mimeType: string; uri: string; isNew?: boolean; attachmentId?: string }>>([]);
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
          { text: t('common.ok') || t('common.confirm'), onPress: () => router.back() },
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
      const fileMimeType = file.mimeType || 'application/pdf';
      const isPDF = fileMimeType === 'application/pdf';
      const isVideo = fileMimeType.startsWith('video/');

      if (!isPDF && !isVideo) {
        Alert.alert(t('common.error'), t('training.onlyPdfVideoAllowed'));
        return;
      }

      const newAttachment = {
        id: 'attach-' + Date.now(),
        filename: file.name,
        mimeType: fileMimeType,
        uri: file.uri,
        isNew: true,
      };

      setAttachments([...attachments, newAttachment]);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert(t('common.error'), t('training.selectDocumentError'));
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const attachment = attachments.find(att => att.id === id);
    if (attachment && !attachment.isNew && attachment.attachmentId) {
      // Se é um anexo existente, confirmar exclusão
      Alert.alert(
        t('common.confirm'),
        t('training.removeAttachmentConfirm'),
        [
          { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
          {
            text: t('common.delete') || 'Excluir',
            style: 'destructive',
            onPress: async () => {
              try {
                await repos.trainingRepo.deleteTrainingAttachment(attachment.attachmentId!);
                setAttachments(attachments.filter(att => att.id !== id));
              } catch (error) {
                console.error('Error deleting attachment:', error);
                Alert.alert(t('common.error'), t('training.removeAttachmentError'));
              }
            },
          },
        ]
      );
    } else {
      // Se é um anexo novo, apenas remover da lista
      setAttachments(attachments.filter(att => att.id !== id));
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('training.titleRequired'));
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
      if (newAttachments.length > 0) {
        setUploadingAttachments(new Set(newAttachments.map(att => att.id)));
        try {
          for (const attachment of newAttachments) {
            await repos.trainingRepo.addTrainingAttachment(savedTrainingId, {
              uri: attachment.uri,
              name: attachment.filename,
              type: attachment.mimeType,
            });
          }
        } catch (error) {
          console.error('Error uploading attachments:', error);
          Alert.alert(t('common.error'), t('training.uploadAttachmentsError'));
        } finally {
          setUploadingAttachments(new Set());
        }
      }

      Alert.alert(
        t('common.success'),
        isEditing ? t('training.trainingUpdated') : t('training.trainingCreated'),
        [
          { text: t('common.ok') || t('common.confirm'), onPress: () => router.back() },
        ]
      );
    } catch (error) {
      console.error('Error saving training:', error);
      Alert.alert(t('common.error'), t('training.saveError'));
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
              onPress={() => router.back()}
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
                        <Ionicons name="document-text" size={20} color={colors.primary} />
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
