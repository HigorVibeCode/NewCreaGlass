import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { EquipmentDocument, EquipmentDocumentAttachment } from '../src/types';
import { confirmDelete } from '../src/utils/confirm-dialog';
import { downloadAndOpenAttachment } from '../src/utils/attachments';
import { theme } from '../src/theme';

export default function EquipmentDocumentDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const { equipmentId, equipmentName, documentId } = useLocalSearchParams<{
    equipmentId: string;
    equipmentName?: string;
    documentId: string;
  }>();

  const [document, setDocument] = useState<EquipmentDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});

  const loadDocument = useCallback(async () => {
    if (!documentId) return;
    setIsLoading(true);
    try {
      const doc = await repos.equipmentDocumentsRepo.getDocumentById(documentId);
      setDocument(doc);
    } catch (error) {
      console.error('Error loading document:', error);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useFocusEffect(
    useCallback(() => {
      loadDocument();
    }, [loadDocument])
  );

  // Load thumbnail URL
  useEffect(() => {
    if (!document?.thumbnailPath || !documentId) return;
    let cancelled = false;
    (async () => {
      try {
        const url = await repos.equipmentDocumentsRepo.getDocumentThumbnailUrl(documentId);
        if (!cancelled && url) setThumbnailUrl(url);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [document, documentId]);

  // Load attachment URLs
  useEffect(() => {
    if (!document?.attachments?.length) return;
    let cancelled = false;
    const load = async () => {
      const urls: Record<string, string> = {};
      for (const att of document.attachments!) {
        if (cancelled) return;
        try {
          const url = await repos.equipmentDocumentsRepo.getDocumentAttachmentUrl(att.id);
          if (url) urls[att.id] = url;
        } catch (_) {}
      }
      if (!cancelled) setAttachmentUrls(urls);
    };
    load();
    return () => { cancelled = true; };
  }, [document]);

  const handleEdit = () => {
    router.push({
      pathname: '/equipment-document-create',
      params: { equipmentId, equipmentName, documentId },
    } as any);
  };

  const handleDelete = () => {
    if (!documentId) return;
    confirmDelete(
      t('common.delete') || 'Excluir',
      t('equipmentDocs.deleteDocumentConfirm') || 'Excluir este documento? Esta ação não pode ser desfeita.',
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

  const handleOpenAttachment = (att: EquipmentDocumentAttachment) => {
    const url = attachmentUrls[att.id];
    if (!url) return;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      downloadAndOpenAttachment(url, att.filename, att.mimeType);
    }
  };

  const isImage = (mime: string) => mime.startsWith('image/');
  const isVideo = (mime: string) => mime.startsWith('video/');

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!document) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('equipmentDocs.documentNotFound') || 'Documento não encontrado'}
          </Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={{ color: colors.primary, marginTop: 16 }}>{t('common.back') || 'Voltar'}</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.background,
              paddingTop: theme.spacing.md,
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
              {document.title}
            </Text>
            <TouchableOpacity style={styles.editHeaderBtn} onPress={handleEdit} activeOpacity={0.7}>
              <Ionicons name="pencil" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + theme.spacing.lg }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Title row with thumbnail */}
          <View style={styles.titleRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (Platform.OS === 'web' && thumbnailUrl) {
                  window.open(thumbnailUrl, '_blank');
                }
              }}
            >
              <View style={[styles.thumbSmall, { backgroundColor: colors.backgroundSecondary }]}>
                {thumbnailUrl ? (
                  <Image source={{ uri: thumbnailUrl }} style={styles.thumbSmallImg} resizeMode="cover" />
                ) : (
                  <Ionicons name="document-text-outline" size={28} color={colors.textTertiary} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={[styles.docTitle, { color: colors.text }]}>{document.title}</Text>
          </View>

          {/* Description */}
          {document.description ? (
            <View style={[styles.descriptionCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.sectionLabel, { color: colors.primary }]}>
                  {t('equipmentDocs.documentDescription') || 'Informações'}
                </Text>
              </View>
              <Text style={[styles.descriptionText, { color: colors.text }]}>
                {document.description}
              </Text>
            </View>
          ) : null}

          {/* Attachments */}
          {document.attachments && document.attachments.length > 0 ? (
            <View style={styles.attachmentsSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="attach" size={18} color={colors.primary} />
                <Text style={[styles.sectionLabel, { color: colors.primary }]}>
                  {t('equipmentDocs.attachments') || 'Anexos'} ({document.attachments.length})
                </Text>
              </View>
              <View style={styles.attachmentsGrid}>
                {document.attachments.map((att) => {
                  const url = attachmentUrls[att.id];
                  return (
                    <TouchableOpacity
                      key={att.id}
                      style={[styles.attachmentCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                      onPress={() => handleOpenAttachment(att)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.attachmentThumb, { backgroundColor: colors.backgroundSecondary }]}>
                        {isImage(att.mimeType) && url ? (
                          <Image source={{ uri: url }} style={styles.attachmentThumbImg} resizeMode="cover" />
                        ) : isVideo(att.mimeType) ? (
                          <Ionicons name="play-circle" size={22} color="#fff" />
                        ) : (
                          <Ionicons name="document-text" size={22} color={colors.primary} />
                        )}
                      </View>
                      <View style={styles.attachmentTextWrap}>
                        <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
                          {att.filename}
                        </Text>
                        <Text style={[styles.attachmentMime, { color: colors.textTertiary }]} numberOfLines={1}>
                          {att.mimeType.split('/')[1]?.toUpperCase() || att.mimeType}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleEdit}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={20} color="#fff" />
              <Text style={styles.actionButtonTextWhite}>
                {t('common.edit') || 'Editar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error }]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonTextWhite}>
                {t('common.delete') || 'Excluir'}
              </Text>
            </TouchableOpacity>
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
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
  },
  editHeaderBtn: {
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
    gap: theme.spacing.lg,
  },
  // Title row with small thumbnail
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  thumbSmall: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumbSmallImg: {
    width: 56,
    height: 56,
  },
  docTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  // Description
  descriptionCard: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  sectionLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
  },
  // Attachments
  attachmentsSection: {
    gap: theme.spacing.sm,
  },
  attachmentsGrid: {
    gap: theme.spacing.sm,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  attachmentThumb: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  attachmentThumbImg: {
    width: 48,
    height: 48,
  },
  attachmentTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  attachmentName: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
  },
  attachmentMime: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: 2,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
  // Actions
  actionsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  actionButtonTextWhite: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
});
