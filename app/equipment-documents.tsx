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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRouteParams } from '../src/hooks/use-route-params';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { EquipmentDocument } from '../src/types';
import { confirmDelete } from '../src/utils/confirm-dialog';
import { useGoBack, safeBack } from '../src/hooks/use-go-back';
import { supabase } from '../src/services/supabase';
import { getCachedSignedUrl } from '../src/utils/signed-url-cache';
import { pushWithParams } from '../src/utils/navigation';
import { theme } from '../src/theme';

const BUCKET_NAME = 'documents';

const showMsg = (message: string) => {
  if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert('', message);
  }
};

export default function EquipmentDocumentsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const params = useRouteParams<{
    equipmentId: string;
    equipmentName: string;
  }>('/equipment-documents');
  const equipmentId = params.equipmentId || '';
  const initialName = params.equipmentName || '';
  const goBack = useGoBack('/(tabs)/documents');

  const [documents, setDocuments] = useState<EquipmentDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [equipName, setEquipName] = useState(initialName || '');
  const [equipThumbUrl, setEquipThumbUrl] = useState<string>('');

  useEffect(() => {
    if (!equipmentId && Platform.OS === 'web') {
      console.warn('[EquipmentDocuments] No equipmentId, redirecting back');
      const timeout = setTimeout(() => safeBack(router), 300);
      return () => clearTimeout(timeout);
    }
  }, [equipmentId, router]);

  const loadDocuments = useCallback(async () => {
    if (!equipmentId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const list = await repos.equipmentDocumentsRepo.getDocumentsByEquipment(equipmentId);
      list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
      setDocuments(list);
    } catch (error) {
      console.error('[EquipmentDocuments] Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [equipmentId]);

  const loadEquipmentInfo = useCallback(async () => {
    if (!equipmentId) return;
    try {
      const eq = await repos.equipmentDocumentsRepo.getEquipmentById(equipmentId);
      if (eq) {
        setEquipName(eq.name);
        if (eq.icon && eq.icon.startsWith('equip_thumb_')) {
          const url = await getCachedSignedUrl(eq.icon);
          if (url) setEquipThumbUrl(url);
        }
      }
    } catch (_) {}
  }, [equipmentId]);

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
      loadEquipmentInfo();
    }, [loadDocuments, loadEquipmentInfo])
  );

  useEffect(() => {
    const withThumb = documents.filter((d) => d.thumbnailPath);
    if (withThumb.length === 0) return;
    let cancelled = false;
    const load = async () => {
      try {
        const BATCH_SIZE = 5;
        for (let i = 0; i < withThumb.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const batch = withThumb.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(
            batch.map(async (doc) => {
              try {
                const url = await repos.equipmentDocumentsRepo.getDocumentThumbnailUrl(doc.id);
                return url ? { id: doc.id, url } : null;
              } catch { return null; }
            })
          );
          if (!cancelled) {
            const next: Record<string, string> = {};
            for (const r of results) if (r) next[r.id] = r.url;
            setThumbnailUrls((prev) => ({ ...prev, ...next }));
          }
        }
      } catch (error) {
        console.error('[EquipmentDocuments] Error loading thumbnails:', error);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [documents]);

  const handleCreateDocument = () => {
    pushWithParams(router, '/equipment-document-create', { equipmentId, equipmentName: equipName });
  };

  const handleDocumentPress = (docId: string) => {
    pushWithParams(router, '/equipment-document-detail', { equipmentId, equipmentName: equipName, documentId: docId });
  };

  // Change equipment thumbnail — just a pencil icon in the header
  const handleChangeThumb = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showMsg(t('equipmentDocs.imagePickerError') || 'Permissão necessária');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets[0]) return;

      const uri = result.assets[0].uri;
      const filename = `equip_thumb_${equipmentId}_${Date.now()}.jpg`;

      let fileData: Blob | Uint8Array;
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        fileData = await response.blob();
      } else {
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
      }

      // Remove old thumbnail
      const eq = await repos.equipmentDocumentsRepo.getEquipmentById(equipmentId);
      if (eq?.icon && eq.icon.startsWith('equip_thumb_')) {
        await supabase.storage.from(BUCKET_NAME).remove([eq.icon]);
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filename, fileData, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        console.error('Error uploading equipment thumbnail:', uploadError);
        showMsg('Erro ao enviar imagem');
        return;
      }

      // Store filename in icon field
      await repos.equipmentDocumentsRepo.updateEquipment(equipmentId, { icon: filename });

      const url = await getCachedSignedUrl(filename);
      if (url) setEquipThumbUrl(url);
    } catch (error) {
      console.error('Error picking equipment thumbnail:', error);
    }
  };

  const handleDeleteEquipment = () => {
    if (!equipmentId) return;
    confirmDelete(
      t('common.delete') || 'Excluir',
      t('equipmentDocs.deleteEquipmentConfirm', { name: equipName }) ||
        `Excluir "${equipName}"?`,
      async () => {
        await repos.equipmentDocumentsRepo.deleteEquipment(equipmentId);
        safeBack(router);
      },
      undefined,
      t('common.delete') || 'Excluir',
      t('common.cancel') || 'Cancelar',
      t('equipmentDocs.equipmentDeleted') || 'Equipamento excluído',
      t('equipmentDocs.deleteEquipmentError') || 'Erro ao excluir'
    );
  };

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
            <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            {/* Thumbnail + name */}
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerThumb, { backgroundColor: colors.backgroundSecondary }]}>
                {equipThumbUrl ? (
                  <Image source={{ uri: equipThumbUrl }} style={styles.headerThumbImg} resizeMode="cover" />
                ) : (
                  <Ionicons name="hardware-chip" size={18} color="#f59e0b" />
                )}
              </View>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {equipName || 'Equipment'}
              </Text>
            </View>

            {/* Pencil to change thumbnail */}
            <TouchableOpacity style={styles.headerBtn} onPress={handleChangeThumb} activeOpacity={0.7}>
              <Ionicons name="pencil" size={20} color={colors.primary} />
            </TouchableOpacity>
            {/* Add doc */}
            <TouchableOpacity style={styles.headerBtn} onPress={handleCreateDocument} activeOpacity={0.7}>
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
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
            {documents.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                  <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('equipmentDocs.noDocuments')}
                </Text>
                <TouchableOpacity
                  style={[styles.createButton, { backgroundColor: colors.primary }]}
                  onPress={handleCreateDocument}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.createButtonText}>{t('equipmentDocs.createDocument')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.listContainer}>
                {documents.map((doc) => (
                  <TouchableOpacity
                    key={doc.id}
                    style={[styles.card, { backgroundColor: colors.cardBackground }]}
                    onPress={() => handleDocumentPress(doc.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardRow}>
                      <View style={[styles.docThumb, { backgroundColor: colors.backgroundSecondary }]}>
                        {doc.thumbnailPath && thumbnailUrls[doc.id] ? (
                          <Image source={{ uri: thumbnailUrls[doc.id] }} style={styles.docThumbImg} resizeMode="cover" />
                        ) : (
                          <Ionicons name="document-text-outline" size={28} color={colors.textTertiary} />
                        )}
                      </View>
                      <View style={styles.cardBody}>
                        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{doc.title}</Text>
                        {doc.description ? (
                          <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>{doc.description}</Text>
                        ) : null}
                        <View style={styles.cardMeta}>
                          <Ionicons name="attach" size={14} color={colors.textTertiary} />
                          <Text style={[styles.cardMetaText, { color: colors.textTertiary }]}>
                            {t('equipmentDocs.attachmentsCount', { count: doc.attachments?.length ?? 0 })}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.chevron, { backgroundColor: colors.backgroundSecondary }]}>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 44,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerThumb: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerThumbImg: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Content
  scrollView: { flex: 1 },
  contentContainer: { padding: theme.spacing.lg },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  // Doc cards
  listContainer: { gap: theme.spacing.md },
  card: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  docThumb: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  docThumbImg: { width: 56, height: 56 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.xs,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: { fontSize: theme.typography.fontSize.xs },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
