import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { Button } from '../src/components/shared/Button';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { useAuth } from '../src/store/auth-store';
import { confirmDelete } from '../src/utils/confirm-dialog';
import { MaintenanceRecord } from '../src/types';
import { theme } from '../src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MaintenanceDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isDark = effectiveTheme === 'dark';
  const params = useLocalSearchParams<{ recordId?: string; recordid?: string }>();
  const rawId = params.recordId ?? (params as { recordid?: string }).recordid;
  const recordId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;

  const [record, setRecord] = useState<MaintenanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (recordId) {
      loadRecord();
    } else {
      setIsLoading(false);
    }
  }, [recordId]);

  const loadRecord = async () => {
    if (!recordId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const recordData = await repos.maintenanceRepo.getMaintenanceRecordById(recordId);
      if (recordData) {
        setRecord(recordData);
      } else {
        setRecord(null);
        Alert.alert(t('common.error'), t('maintenance.recordNotFound'), [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error loading maintenance record:', error);
      setLoadError(t('maintenance.loadError'));
      setRecord(null);
      Alert.alert(t('common.error'), t('maintenance.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const isValidImageUri = (uri: string | undefined): uri is string =>
    !!uri && typeof uri === 'string' && (uri.startsWith('http://') || uri.startsWith('https://'));

  const handleEdit = () => {
    router.push({
      pathname: '/maintenance-create',
      params: { recordId },
    } as any);
  };

  const handleDelete = () => {
    if (!recordId) return;
    confirmDelete(
      t('common.confirm'),
      t('maintenance.deleteConfirm'),
      async () => {
        await repos.maintenanceRepo.deleteMaintenanceRecord(recordId);
        router.back();
      },
      undefined,
      t('common.delete'),
      t('common.cancel'),
      t('maintenance.recordDeleted'),
      t('maintenance.deleteError')
    );
  };

  const handleImagePress = (imageUri: string) => {
    setSelectedImage(imageUri);
    setImageModalVisible(true);
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

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!record && !isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg }]}>
        <Text style={{ color: colors.text, textAlign: 'center' }}>
          {loadError || t('maintenance.recordNotFound')}
        </Text>
        <TouchableOpacity style={{ marginTop: theme.spacing.md }} onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
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
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {t('maintenance.recordDetails')}
              </Text>
            </View>
          </View>
        </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Info card with cover image */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          {(() => {
            const coverImage = record.coverImagePath ?? (record.infos ?? []).find((info) => info.images?.length)?.images?.[0]?.storagePath;
            const showImage = isValidImageUri(coverImage);
            return showImage ? (
              <TouchableOpacity onPress={() => handleImagePress(coverImage!)} activeOpacity={0.9} style={styles.cardCoverWrap}>
                <View style={styles.cardCoverImageWrap}>
                  <Image source={{ uri: coverImage! }} style={styles.cardCoverImage} contentFit="cover" />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.cardCoverPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="construct-outline" size={40} color={colors.textTertiary} />
              </View>
            );
          })()}
          <View style={styles.cardContent}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('maintenance.basicInfo')}
            </Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  {t('maintenance.titleLabel')}
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={2}>
                  {record.title}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  {t('maintenance.equipment')}
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={2}>
                  {record.equipment}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  {t('maintenance.type')}
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={2}>
                  {record.type}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  {t('maintenance.createdAt')}
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {formatDate(record.createdAt)}
                </Text>
              </View>
              {record.updatedAt !== record.createdAt && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                    {t('maintenance.updatedAt')}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {formatDate(record.updatedAt)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Info Boxes */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('maintenance.infos')} ({(record.infos ?? []).length})
          </Text>
          {(record.infos ?? []).length === 0 ? (
            <View style={[styles.emptyInfoBox, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('maintenance.noInfos')}
              </Text>
            </View>
          ) : (
            (record.infos ?? []).map((info, index) => {
              const firstImage = info.images?.[0]?.storagePath;
              const showFirstImage = isValidImageUri(firstImage);
              const otherImages = (info.images ?? []).slice(1);
              return (
                <View key={info.id} style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                  <View style={styles.cardContent}>
                    <View style={styles.infoBoxRow}>
                      <TouchableOpacity
                        onPress={() => showFirstImage && handleImagePress(firstImage!)}
                        activeOpacity={0.9}
                        style={styles.infoBoxThumbWrap}
                      >
                        {showFirstImage ? (
                          <View style={styles.infoBoxThumbBox}>
                            <Image source={{ uri: firstImage! }} style={styles.infoBoxThumbImage} contentFit="cover" />
                          </View>
                        ) : (
                          <View style={[styles.infoBoxThumbBox, styles.imageThumbPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                            <Ionicons name="information-circle-outline" size={28} color={colors.textTertiary} />
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.infoBoxTextBlock}>
                        <Text style={[styles.infoBoxTitle, { color: colors.text }]}>
                          {t('maintenance.info')} {index + 1}
                        </Text>
                        {info.description ? (
                          <Text style={[styles.infoDescription, { color: colors.text }]}>
                            {info.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {otherImages.length > 0 && (
                      <View style={styles.imagesContainer}>
                        {otherImages.map((image, imgIndex) => (
                          <TouchableOpacity
                            key={imgIndex}
                            onPress={() => handleImagePress(image.storagePath)}
                            activeOpacity={0.8}
                            style={styles.imageThumbWrap}
                          >
                            {isValidImageUri(image.storagePath) ? (
                              <View style={styles.imageThumbBox}>
                                <Image source={{ uri: image.storagePath }} style={styles.imageThumb} contentFit="cover" />
                              </View>
                            ) : (
                              <View style={[styles.imageThumbBox, styles.imageThumbPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                                <Ionicons name="image-outline" size={22} color={colors.textTertiary} />
                              </View>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Button
            title={t('maintenance.editRecord')}
            onPress={handleEdit}
            style={styles.editButton}
          />
          <Button
            title={t('common.delete')}
            onPress={handleDelete}
            style={[styles.deleteButton, { backgroundColor: colors.error }]}
          />
        </View>
      </ScrollView>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setImageModalVisible(false)}
        >
          <View style={styles.modalContent}>
            {selectedImage && isValidImageUri(selectedImage) && (
              <Image source={{ uri: selectedImage }} style={styles.modalImage} contentFit="contain" />
            )}
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setImageModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.md,
  },
  card: {
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  cardCoverWrap: {
    width: '100%',
    height: 96,
  },
  cardCoverImageWrap: {
    width: '100%',
    height: 96,
    overflow: 'hidden',
  },
  cardCoverImage: {
    width: '100%',
    height: 96,
    backgroundColor: '#e5e7eb',
  },
  cardCoverPlaceholder: {
    width: '100%',
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: theme.spacing.md,
  },
  infoGrid: {
    gap: theme.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    minWidth: 100,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  infoBoxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  infoBoxThumbWrap: {
    width: 72,
    height: 72,
  },
  infoBoxThumbBox: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  infoBoxThumbImage: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.sm,
  },
  infoBoxTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  infoBoxTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
  },
  infoDescription: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.md,
    marginBottom: 0,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  imageThumbWrap: {
    width: 72,
    height: 72,
  },
  imageThumbBox: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  imageThumb: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.sm,
  },
  imageThumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: 72,
    height: 72,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  emptyInfoBox: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
  },
  actionsContainer: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  editButton: {
    marginTop: 0,
  },
  deleteButton: {
    marginTop: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: (SCREEN_WIDTH || 400) * 0.9,
    height: (SCREEN_WIDTH || 400) * 0.9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  closeModalButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
