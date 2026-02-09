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
  Image,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useAuth } from '../src/store/auth-store';
import { repos } from '../src/services/container';
import { confirmDelete } from '../src/utils/confirm-dialog';
import { downloadAndOpenAttachment } from '../src/utils/attachments';
import { theme } from '../src/theme';

const MAX_ATTACHMENTS = 10;

type AttachmentItem = {
  id: string;
  filename: string;
  mimeType: string;
  uri: string;
  isNew?: boolean;
  attachmentId?: string;
};

/** Web-safe alert helper */
const showMsg = (message: string) => {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert('', message);
  }
};

export default function EquipmentDocumentCreateScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { effectiveTheme } = useAppTheme();
  const { user } = useAuth();
  const { equipmentId, equipmentName, documentId } = useLocalSearchParams<{
    equipmentId: string;
    equipmentName?: string;
    documentId?: string;
  }>();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [thumbnailRemoved, setThumbnailRemoved] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState<Set<string>>(new Set());

  const isEditing = !!documentId;

  useEffect(() => {
    if (documentId) loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    if (!documentId) return;
    setIsLoading(true);
    try {
      const doc = await repos.equipmentDocumentsRepo.getDocumentById(documentId);
      if (doc) {
        setTitle(doc.title);
        setDescription(doc.description || '');
        if (doc.thumbnailPath) {
          try {
            const url = await repos.equipmentDocumentsRepo.getDocumentThumbnailUrl(documentId);
            if (url) setThumbnailUri(url);
          } catch (_) {}
        }
        if (doc.attachments?.length) {
          const loaded: AttachmentItem[] = [];
          for (const att of doc.attachments) {
            try {
              const url = await repos.equipmentDocumentsRepo.getDocumentAttachmentUrl(att.id);
              loaded.push({
                id: att.id,
                filename: att.filename,
                mimeType: att.mimeType,
                uri: url || att.storagePath,
                isNew: false,
                attachmentId: att.id,
              });
            } catch (_) {
              loaded.push({
                id: att.id,
                filename: att.filename,
                mimeType: att.mimeType,
                uri: att.storagePath,
                isNew: false,
                attachmentId: att.id,
              });
            }
          }
          setAttachments(loaded);
        }
      } else {
        showMsg(t('equipmentDocs.documentNotFound') || 'Documento não encontrado');
        router.back();
      }
    } catch (error) {
      console.error('Error loading equipment document:', error);
      showMsg(t('equipmentDocs.loadError') || 'Erro ao carregar documento');
    } finally {
      setIsLoading(false);
    }
  };

  // ============== Attachment Handlers ==============

  const handleTakePhoto = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      showMsg(t('equipmentDocs.maxAttachmentsReached', { count: MAX_ATTACHMENTS }) || `Máximo de ${MAX_ATTACHMENTS} anexos`);
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showMsg(t('equipmentDocs.imagePickerError') || 'Permissão de câmera necessária');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      const mimeType = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
      setAttachments((prev) => [
        ...prev,
        { id: `att-${Date.now()}`, filename, mimeType, uri: asset.uri, isNew: true },
      ]);
    } catch (error) {
      console.error('Error taking photo:', error);
      showMsg(t('equipmentDocs.imagePickerError') || 'Erro ao capturar foto');
    }
  };

  const handleChooseFromGallery = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      showMsg(t('equipmentDocs.maxAttachmentsReached', { count: MAX_ATTACHMENTS }) || `Máximo de ${MAX_ATTACHMENTS} anexos`);
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showMsg(t('equipmentDocs.imagePickerError') || 'Permissão de galeria necessária');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        videoMaxDuration: 120,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() || `media_${Date.now()}.jpg`;
      const mimeType = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
      setAttachments((prev) => [
        ...prev,
        { id: `att-${Date.now()}`, filename, mimeType, uri: asset.uri, isNew: true },
      ]);
    } catch (error) {
      console.error('Error choosing from gallery:', error);
      showMsg(t('equipmentDocs.imagePickerError') || 'Erro ao selecionar mídia');
    }
  };

  const handleChooseFile = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      showMsg(t('equipmentDocs.maxAttachmentsReached', { count: MAX_ATTACHMENTS }) || `Máximo de ${MAX_ATTACHMENTS} anexos`);
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'video/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setAttachments((prev) => [
        ...prev,
        {
          id: `att-${Date.now()}`,
          filename: file.name,
          mimeType: file.mimeType || 'application/octet-stream',
          uri: file.uri,
          isNew: true,
        },
      ]);
    } catch (error) {
      console.error('Error picking file:', error);
      showMsg(t('equipmentDocs.imagePickerError') || 'Erro ao selecionar arquivo');
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const attachment = attachments.find((a) => a.id === id);
    if (attachment && !attachment.isNew && attachment.attachmentId) {
      if (Platform.OS === 'web') {
        if (window.confirm(t('equipmentDocs.deleteDocumentConfirm') || 'Remover este anexo?')) {
          deleteExistingAttachment(attachment.attachmentId, id);
        }
      } else {
        Alert.alert(
          t('common.confirm') || 'Confirmar',
          t('equipmentDocs.deleteDocumentConfirm') || 'Remover este anexo?',
          [
            { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
            {
              text: t('common.delete') || 'Excluir',
              style: 'destructive',
              onPress: () => deleteExistingAttachment(attachment.attachmentId!, id),
            },
          ]
        );
      }
    } else {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const deleteExistingAttachment = async (attachmentId: string, localId: string) => {
    try {
      await repos.equipmentDocumentsRepo.deleteDocumentAttachment(attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== localId));
    } catch (error) {
      console.error('Error deleting attachment:', error);
      showMsg(t('equipmentDocs.removeAttachmentError') || 'Erro ao remover anexo');
    }
  };

  const handleOpenAttachment = (att: AttachmentItem) => {
    if (Platform.OS === 'web') {
      window.open(att.uri, '_blank');
    } else {
      downloadAndOpenAttachment(att.uri, att.filename, att.mimeType);
    }
  };

  // ============== Thumbnail ==============

  const handlePickThumbnail = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showMsg(t('equipmentDocs.imagePickerError') || 'Permissão necessária');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      setThumbnailUri(result.assets[0].uri);
      setThumbnailRemoved(false);
    } catch (error) {
      console.error('Error picking thumbnail:', error);
      showMsg(t('equipmentDocs.imagePickerError') || 'Erro ao selecionar imagem');
    }
  };

  const handleRemoveThumbnail = () => {
    setThumbnailUri(null);
    if (isEditing) setThumbnailRemoved(true);
  };

  // ============== Save ==============

  const validateForm = (): boolean => {
    if (!title.trim()) {
      showMsg(t('equipmentDocs.documentTitleRequired') || 'Título é obrigatório');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !user || !equipmentId) return;
    setIsSaving(true);
    try {
      let savedDocId: string;

      if (isEditing && documentId) {
        await repos.equipmentDocumentsRepo.updateDocument(documentId, {
          title: title.trim(),
          description: description.trim() || undefined,
        });
        savedDocId = documentId;
      } else {
        const doc = await repos.equipmentDocumentsRepo.createDocument({
          equipmentId,
          title: title.trim(),
          description: description.trim() || undefined,
          createdBy: user.id,
        });
        savedDocId = doc.id;
      }

      // Upload new attachments
      const newAttachments = attachments.filter((a) => a.isNew);
      if (newAttachments.length > 0) {
        setUploadingAttachments(new Set(newAttachments.map((a) => a.id)));
        try {
          for (const att of newAttachments) {
            await repos.equipmentDocumentsRepo.addDocumentAttachment(savedDocId, {
              uri: att.uri,
              name: att.filename,
              type: att.mimeType,
            });
          }
        } catch (error) {
          console.error('Error uploading attachments:', error);
          showMsg(t('equipmentDocs.uploadAttachmentsError') || 'Erro ao enviar anexos');
        } finally {
          setUploadingAttachments(new Set());
        }
      }

      // Handle thumbnail
      if (thumbnailRemoved && isEditing && savedDocId) {
        await repos.equipmentDocumentsRepo.updateDocument(savedDocId, { thumbnailPath: null });
      }
      if (thumbnailUri && !thumbnailUri.startsWith('http')) {
        setThumbnailUploading(true);
        try {
          const filename = thumbnailUri.split('/').pop() || `thumb_${Date.now()}.jpg`;
          await repos.equipmentDocumentsRepo.uploadDocumentThumbnail(savedDocId, {
            uri: thumbnailUri,
            name: filename,
            type: 'image/jpeg',
          });
        } catch (error) {
          console.error('Error uploading thumbnail:', error);
          showMsg(t('equipmentDocs.uploadThumbnailError') || 'Erro ao enviar miniatura');
        } finally {
          setThumbnailUploading(false);
        }
      }

      const successMsg = isEditing
        ? (t('equipmentDocs.documentUpdated') || 'Documento atualizado')
        : (t('equipmentDocs.documentCreated') || 'Documento criado');

      if (Platform.OS === 'web') {
        window.alert(successMsg);
        router.back();
      } else {
        Alert.alert(t('common.success') || 'Sucesso', successMsg, [
          { text: t('common.confirm') || 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error saving equipment document:', error);
      showMsg(t('equipmentDocs.saveError') || 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!documentId) return;
    confirmDelete(
      t('common.delete') || 'Excluir',
      t('equipmentDocs.deleteDocumentConfirm') || 'Excluir este documento?',
      async () => {
        await repos.equipmentDocumentsRepo.deleteDocument(documentId);
        router.back();
      },
      undefined,
      t('common.delete') || 'Excluir',
      t('common.cancel') || 'Cancelar',
      t('equipmentDocs.documentDeleted') || 'Documento excluído',
      t('equipmentDocs.deleteDocumentError') || 'Erro ao excluir'
    );
  };

  // ============== Render ==============

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isImage = (mime: string) => mime.startsWith('image/');
  const isVideo = (mime: string) => mime.startsWith('video/');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenWrapper>
        {/* Header */}
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
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {isEditing ? t('equipmentDocs.editDocument') : t('equipmentDocs.createDocument')}
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
            {/* Title */}
            <View style={styles.section}>
              <Input
                label={`${t('equipmentDocs.documentTitle') || 'Título'} *`}
                value={title}
                onChangeText={setTitle}
                placeholder={t('equipmentDocs.documentTitlePlaceholder') || 'Insira o título'}
              />
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('equipmentDocs.documentDescription') || 'Descrição / Informações Extras'}
              </Text>
              <TextInput
                style={[
                  styles.descriptionInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundSecondary,
                  },
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder={t('equipmentDocs.documentDescriptionPlaceholder') || 'Adicione notas, detalhes...'}
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Thumbnail */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('equipmentDocs.thumbnail') || 'Miniatura'}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                {t('equipmentDocs.thumbnailHint') || 'Imagem de capa deste bloco'}
              </Text>
              {thumbnailUri ? (
                <View style={styles.thumbnailSlot}>
                  <Image source={{ uri: thumbnailUri }} style={styles.thumbnailPreview} resizeMode="cover" />
                  <TouchableOpacity
                    style={[styles.removeThumbnailBtn, { backgroundColor: colors.error }]}
                    onPress={handleRemoveThumbnail}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                    <Text style={styles.removeThumbnailText}>{t('common.remove') || 'Remover'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.addThumbnailButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                  onPress={handlePickThumbnail}
                  activeOpacity={0.7}
                  disabled={thumbnailUploading}
                >
                  {thumbnailUploading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={24} color={colors.primary} />
                      <Text style={[styles.addThumbnailText, { color: colors.primary }]}>
                        {t('equipmentDocs.addThumbnail') || 'Adicionar Miniatura'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Attachments */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('equipmentDocs.attachments') || 'Anexos'}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                {t('equipmentDocs.maxAttachments', { count: MAX_ATTACHMENTS }) || `Até ${MAX_ATTACHMENTS} arquivos`}
              </Text>

              {/* Attachment list */}
              {attachments.length > 0 && (
                <View style={styles.attachmentsList}>
                  {attachments.map((att) => (
                    <View
                      key={att.id}
                      style={[styles.attachmentItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    >
                      {/* Preview */}
                      <TouchableOpacity
                        style={styles.attachmentPreviewWrap}
                        onPress={() => !att.isNew && handleOpenAttachment(att)}
                        activeOpacity={0.7}
                      >
                        {isImage(att.mimeType) && att.uri ? (
                          <Image source={{ uri: att.uri }} style={styles.attachmentPreview} resizeMode="cover" />
                        ) : isVideo(att.mimeType) ? (
                          <View style={[styles.attachmentPreview, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }]}>
                            <Ionicons name="videocam" size={22} color="#fff" />
                          </View>
                        ) : (
                          <View style={[styles.attachmentPreview, { justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="document-text" size={22} color={colors.primary} />
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.attachmentInfo}>
                        <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
                          {att.filename}
                        </Text>
                        <Text style={[styles.attachmentMime, { color: colors.textTertiary }]} numberOfLines={1}>
                          {att.mimeType}
                        </Text>
                      </View>
                      {uploadingAttachments.has(att.id) ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <TouchableOpacity onPress={() => handleRemoveAttachment(att.id)} style={styles.removeButton}>
                          <Ionicons name="close-circle" size={24} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Add buttons */}
              {attachments.length < MAX_ATTACHMENTS && (
                <View style={styles.attachmentActions}>
                  <TouchableOpacity
                    style={[styles.attachOptionBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={handleTakePhoto}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera" size={22} color={colors.primary} />
                    <Text style={[styles.attachOptionText, { color: colors.primary }]}>
                      {t('equipmentDocs.takePhoto') || 'Câmera'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.attachOptionBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={handleChooseFromGallery}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="images" size={22} color={colors.primary} />
                    <Text style={[styles.attachOptionText, { color: colors.primary }]}>
                      {t('equipmentDocs.chooseFromGallery') || 'Galeria'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.attachOptionBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={handleChooseFile}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="document-attach" size={22} color={colors.primary} />
                    <Text style={[styles.attachOptionText, { color: colors.primary }]}>
                      {t('equipmentDocs.chooseFile') || 'Arquivo'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Save / Delete */}
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
                  onPress={handleDelete}
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
  descriptionInput: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSize.md,
    minHeight: 100,
    lineHeight: 22,
  },
  // Thumbnail
  thumbnailSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  thumbnailPreview: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.sm,
  },
  removeThumbnailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  removeThumbnailText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
    color: '#fff',
  },
  addThumbnailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addThumbnailText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '500',
  },
  // Attachments
  attachmentsList: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    gap: theme.spacing.sm,
  },
  attachmentPreviewWrap: {
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  attachmentPreview: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.sm,
  },
  attachmentInfo: {
    flex: 1,
    minWidth: 0,
  },
  attachmentName: {
    fontSize: theme.typography.fontSize.sm,
  },
  attachmentMime: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: 2,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  attachmentActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  attachOptionBtn: {
    flex: 1,
    minWidth: 100,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  attachOptionText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Buttons
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
