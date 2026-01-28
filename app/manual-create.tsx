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
import { confirmDelete } from '../src/utils/confirm-dialog';
import { theme } from '../src/theme';

const MAX_PDFS = 3;

type AttachmentItem = {
  id: string;
  filename: string;
  mimeType: string;
  uri: string;
  isNew?: boolean;
  attachmentId?: string;
};

export default function ManualCreateScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { effectiveTheme } = useAppTheme();
  const { manualId } = useLocalSearchParams<{ manualId?: string }>();

  const [title, setTitle] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState<Set<string>>(new Set());

  const isEditing = !!manualId;

  useEffect(() => {
    if (manualId) loadManual();
  }, [manualId]);

  const loadManual = async () => {
    if (!manualId) return;
    setIsLoading(true);
    try {
      const manual = await repos.manualsRepo.getManualById(manualId);
      if (manual) {
        setTitle(manual.title);
        if (manual.attachments?.length) {
          setAttachments(
            manual.attachments.map((att) => ({
              id: att.id,
              filename: att.filename,
              mimeType: att.mimeType,
              uri: att.storagePath,
              isNew: false,
              attachmentId: att.id,
            }))
          );
        }
      } else {
        Alert.alert(t('common.error'), t('manuals.manualNotFound'), [
          { text: t('common.ok') || t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error loading manual:', error);
      Alert.alert(t('common.error'), t('manuals.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChoosePdf = async () => {
    if (attachments.length >= MAX_PDFS) {
      Alert.alert(t('common.error'), t('manuals.maxPdfsReached', { count: MAX_PDFS }));
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const mimeType = file.mimeType || 'application/pdf';
      if (mimeType !== 'application/pdf') {
        Alert.alert(t('common.error'), t('manuals.onlyPdfAllowed'));
        return;
      }
      setAttachments((prev) => [
        ...prev,
        {
          id: 'attach-' + Date.now(),
          filename: file.name,
          mimeType,
          uri: file.uri,
          isNew: true,
        },
      ]);
    } catch (error) {
      console.error('Error picking PDF:', error);
      Alert.alert(t('common.error'), t('manuals.selectPdfError'));
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const attachment = attachments.find((a) => a.id === id);
    if (attachment && !attachment.isNew && attachment.attachmentId) {
      Alert.alert(
        t('common.confirm'),
        t('manuals.removePdfConfirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await repos.manualsRepo.deleteManualAttachment(attachment.attachmentId!);
                setAttachments((prev) => prev.filter((a) => a.id !== id));
              } catch (error) {
                console.error('Error deleting attachment:', error);
                Alert.alert(t('common.error'), t('manuals.removeAttachmentError'));
              }
            },
          },
        ]
      );
    } else {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('manuals.titleRequired'));
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      let savedManualId: string;
      if (isEditing && manualId) {
        await repos.manualsRepo.updateManual(manualId, { title: title.trim() });
        savedManualId = manualId;
      } else {
        const manual = await repos.manualsRepo.createManual({ title: title.trim() });
        savedManualId = manual.id;
      }

      const newAttachments = attachments.filter((a) => a.isNew);
      if (newAttachments.length > 0) {
        setUploadingAttachments(new Set(newAttachments.map((a) => a.id)));
        try {
          for (const att of newAttachments) {
            await repos.manualsRepo.addManualAttachment(savedManualId, {
              uri: att.uri,
              name: att.filename,
              type: att.mimeType,
            });
          }
        } catch (error) {
          console.error('Error uploading PDFs:', error);
          Alert.alert(t('common.error'), t('manuals.uploadPdfsError'));
        } finally {
          setUploadingAttachments(new Set());
        }
      }

      Alert.alert(
        t('common.success'),
        isEditing ? t('manuals.manualUpdated') : t('manuals.manualCreated'),
        [{ text: t('common.ok') || t('common.confirm'), onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving manual:', error);
      Alert.alert(t('common.error'), t('manuals.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteManual = () => {
    if (!manualId) return;
    confirmDelete(
      t('common.delete'),
      t('manuals.deleteConfirm', { title: title || '' }),
      async () => {
        await repos.manualsRepo.deleteManual(manualId);
        router.back();
      },
      undefined,
      t('common.delete'),
      t('common.cancel'),
      t('manuals.manualDeleted'),
      t('manuals.deleteError')
    );
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
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {isEditing ? t('manuals.editManual') : t('manuals.newManual')}
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
              <Input
                label={`${t('manuals.manualTitle')} *`}
                value={title}
                onChangeText={setTitle}
                placeholder={t('manuals.titlePlaceholder')}
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('manuals.attachPdf')}</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                {t('manuals.maxPdfs', { count: MAX_PDFS })}
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
                        <TouchableOpacity onPress={() => handleRemoveAttachment(attachment.id)} style={styles.removeButton}>
                          <Ionicons name="close-circle" size={24} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {attachments.length < MAX_PDFS && (
                <TouchableOpacity
                  style={[styles.addAttachmentButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                  onPress={handleChoosePdf}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  <Text style={[styles.addAttachmentText, { color: colors.primary }]}>{t('manuals.addPdf')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title={isEditing ? (t('common.save') || 'Salvar') : (t('common.create') || 'Criar')}
                onPress={handleSave}
                loading={isSaving}
                disabled={isSaving}
              />
              {isEditing && (
                <TouchableOpacity
                  style={[styles.deleteButton, { backgroundColor: colors.error }]}
                  onPress={handleDeleteManual}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                  <Text style={styles.deleteButtonText}>
                    {t('common.delete') || 'Excluir'}
                  </Text>
                </TouchableOpacity>
              )}
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
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
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
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.sm,
  },
  attachmentsList: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
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
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addAttachmentText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  deleteButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#fff',
  },
});
