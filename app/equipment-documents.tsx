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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { EquipmentDocument } from '../src/types';
import { confirmDelete } from '../src/utils/confirm-dialog';
import { supabase } from '../src/services/supabase';
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
  const insets = useSafeAreaInsets();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const { equipmentId, equipmentName: initialName } = useLocalSearchParams<{
    equipmentId: string;
    equipmentName: string;
  }>();

  const [documents, setDocuments] = useState<EquipmentDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [equipName, setEquipName] = useState(initialName || '');
  const [equipThumbUrl, setEquipThumbUrl] = useState<string>('');

  const loadDocuments = useCallback(async () => {
    if (!equipmentId) return;
    setIsLoading(true);
    try {
      const list = await repos.equipmentDocumentsRepo.getDocumentsByEquipment(equipmentId);
      // Ordenar por título (alfabética, case-insensitive)
      list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
      setDocuments(list);
    } catch (error) {
      console.error('Error loading equipment documents:', error);
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
          const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(eq.icon, 3600);
          if (data?.signedUrl) setEquipThumbUrl(data.signedUrl);
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
      const next: Record<string, string> = {};
      for (const doc of withThumb) {
        if (cancelled) return;
        try {
          const url = await repos.equipmentDocumentsRepo.getDocumentThumbnailUrl(doc.id);
          if (url) next[doc.id] = url;
        } catch (_) {}
      }
      if (!cancelled) setThumbnailUrls((prev) => ({ ...prev, ...next }));
    };
    load();
    return () => { cancelled = true; };
  }, [documents]);

  const handleCreateDocument = () => {
    router.push({
      pathname: '/equipment-document-create',
      params: { equipmentId, equipmentName: equipName },
    } as any);
  };

  const handleDocumentPress = (docId: string) => {
    router.push({
      pathname: '/equipment-document-detail',
      params: { equipmentId, equipmentName: equipName, documentId: docId },
    } as any);
  };

  // Change equipment thumbnail — just a pencil icon in the header
  const handleChangeThumb = async () => {
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

      const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(filename, 3600);
      if (data?.signedUrl) setEquipThumbUrl(data.signedUrl);
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
        router.back();
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
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
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
