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
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { repos } from '../src/services/container';
import { useAuth } from '../src/store/auth-store';
import { MaintenanceRecord, MaintenanceInfo, MaintenanceInfoImage } from '../src/types';
import { theme } from '../src/theme';

interface InfoBox {
  id: string;
  description: string;
  images: Array<{ uri: string; filename: string; mimeType: string }>;
  isCreated: boolean; // Se já foi criado no backend
  infoId?: string; // ID do backend se já criado
}

const MAX_IMAGES_PER_INFO = 3;

export default function MaintenanceCreateScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const params = useLocalSearchParams<{ recordId?: string; recordid?: string }>();
  const rawId = params.recordId ?? (params as { recordid?: string }).recordid;
  const recordId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;

  const [title, setTitle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [type, setType] = useState('');
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [removedCover, setRemovedCover] = useState(false);
  const [infoBoxes, setInfoBoxes] = useState<InfoBox[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(!!recordId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(recordId ?? null);

  const isEditing = !!recordId;

  const isValidImageUri = (uri: string | undefined): uri is string =>
    !!uri && typeof uri === 'string' && uri.length > 0 && (uri.startsWith('http') || uri.startsWith('file') || uri.startsWith('content') || uri.startsWith('blob'));

  useEffect(() => {
    if (recordId) {
      loadRecord();
    }
  }, [recordId]);

  const loadRecord = async () => {
    if (!recordId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const record = await repos.maintenanceRepo.getMaintenanceRecordById(recordId);
      if (record) {
        setTitle(record.title ?? '');
        setEquipment(record.equipment ?? '');
        setType(record.type ?? '');
        setExistingCoverUrl(record.coverImagePath ?? null);
        setCoverImageUri(null);
        setRemovedCover(false);
        setCurrentRecordId(record.id);
        
        // Convert infos to InfoBox format (protect against missing images)
        const boxes: InfoBox[] = (record.infos ?? []).map((info) => ({
          id: info.id,
          description: info.description ?? '',
          images: (info.images ?? []).map((img) => ({
            uri: img.storagePath ?? '',
            filename: img.filename ?? '',
            mimeType: img.mimeType ?? 'image/jpeg',
          })),
          isCreated: true,
          infoId: info.id,
        }));
        setInfoBoxes(boxes);
      } else {
        setLoadError(t('maintenance.recordNotFound'));
      }
    } catch (error) {
      console.error('Error loading maintenance record:', error);
      setLoadError(t('maintenance.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickCoverImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('maintenance.imagePickerError'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      setCoverImageUri(result.assets[0].uri);
      setRemovedCover(false);
    } catch (error) {
      console.error('Error picking cover image:', error);
      Alert.alert(t('common.error'), t('maintenance.imagePickerError'));
    }
  };

  const handleRemoveCoverImage = () => {
    setCoverImageUri(null);
    if (existingCoverUrl) setRemovedCover(true);
  };

  const handleAddInfo = () => {
    const newInfoBox: InfoBox = {
      id: 'info-' + Date.now(),
      description: '',
      images: [],
      isCreated: false,
    };
    setInfoBoxes([...infoBoxes, newInfoBox]);
  };

  const handleUpdateInfoDescription = (infoId: string, description: string) => {
    setInfoBoxes(infoBoxes.map(box => 
      box.id === infoId ? { ...box, description } : box
    ));
  };

  const handleAddImageToInfo = async (infoId: string) => {
    const box = infoBoxes.find(b => b.id === infoId);
    if (!box) return;

    if (box.images.length >= MAX_IMAGES_PER_INFO) {
      Alert.alert(t('common.error'), t('maintenance.maxImagesReached'));
      return;
    }

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('maintenance.imagePickerError'));
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() || `image_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      setInfoBoxes(infoBoxes.map(box => 
        box.id === infoId 
          ? { ...box, images: [...box.images, { uri: asset.uri, filename, mimeType }] }
          : box
      ));
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error'), t('maintenance.imagePickerError'));
    }
  };

  const handleRemoveImageFromInfo = (infoId: string, imageIndex: number) => {
    setInfoBoxes(infoBoxes.map(box => 
      box.id === infoId 
        ? { ...box, images: box.images.filter((_, idx) => idx !== imageIndex) }
        : box
    ));
  };

  const handleDeleteInfo = (infoId: string) => {
    const box = infoBoxes.find(b => b.id === infoId);
    if (!box) return;

    Alert.alert(
      t('common.confirm'),
      t('maintenance.deleteInfoConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            // If info is already created, delete from backend
            if (box.isCreated && box.infoId && currentRecordId) {
              try {
                await repos.maintenanceRepo.deleteMaintenanceInfo(box.infoId, user?.id);
              } catch (error) {
                console.error('Error deleting info:', error);
                Alert.alert(t('common.error'), t('maintenance.deleteInfoError'));
                return;
              }
            }
            setInfoBoxes(infoBoxes.filter(b => b.id !== infoId));
          },
        },
      ]
    );
  };

  const handleSaveInfo = async (infoId: string) => {
    const box = infoBoxes.find(b => b.id === infoId);
    if (!box || !currentRecordId || !user) return;

    if (!box.description.trim()) {
      Alert.alert(t('common.error'), t('maintenance.fillDescription'));
      return;
    }

    try {
      let savedInfoId = box.infoId;

      // Create or update info
      if (box.isCreated && box.infoId) {
        // Update existing info
        const updatedInfo = await repos.maintenanceRepo.updateMaintenanceInfo(
          box.infoId,
          { description: box.description },
          user.id
        );
        savedInfoId = updatedInfo.id;
      } else {
        // Create new info
        const newInfo = await repos.maintenanceRepo.addMaintenanceInfo(
          currentRecordId,
          { description: box.description },
        );
        savedInfoId = newInfo.id;
      }

      // Upload images if any
      for (let i = 0; i < box.images.length; i++) {
        const image = box.images[i];
        // Check if image is already uploaded (has http/https URL)
        if (image.uri.startsWith('http://') || image.uri.startsWith('https://')) {
          continue; // Already uploaded
        }

        try {
          await repos.maintenanceRepo.addMaintenanceInfoImage(
            savedInfoId,
            {
              storagePath: image.uri,
              filename: image.filename,
              mimeType: image.mimeType,
              maintenanceInfoId: savedInfoId,
              orderIndex: i,
            }
          );
        } catch (error) {
          console.error('Error uploading image:', error);
          // Continue with other images
        }
      }

      // Update box to mark as created
      setInfoBoxes(infoBoxes.map(b => 
        b.id === infoId 
          ? { ...b, isCreated: true, infoId: savedInfoId }
          : b
      ));

      Alert.alert(t('common.success'), t('maintenance.infoSaved'));
    } catch (error) {
      console.error('Error saving info:', error);
      Alert.alert(t('common.error'), t('maintenance.saveInfoError'));
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('maintenance.fillTitle'));
      return false;
    }
    if (!equipment.trim()) {
      Alert.alert(t('common.error'), t('maintenance.fillEquipment'));
      return false;
    }
    if (!type.trim()) {
      Alert.alert(t('common.error'), t('maintenance.fillType'));
      return false;
    }
    return true;
  };

  const handleSaveRecord = async () => {
    if (!user) return;

    if (!validateForm()) return;

    setIsCreating(true);
    try {
      let recordIdToUse = currentRecordId;
      let coverPath: string | null = null;

      if (coverImageUri) {
        const filename = coverImageUri.split('/').pop() || `cover_${Date.now()}.jpg`;
        coverPath = await repos.maintenanceRepo.uploadCoverImage({
          uri: coverImageUri,
          name: filename,
          type: 'image/jpeg',
        });
      }

      if (isEditing && recordId) {
        const updates: { title: string; equipment: string; type: string; coverImagePath?: string | null } = {
          title: title.trim(),
          equipment: equipment.trim(),
          type: type.trim(),
        };
        if (removedCover) updates.coverImagePath = null;
        else if (coverPath) updates.coverImagePath = coverPath;
        await repos.maintenanceRepo.updateMaintenanceRecord(recordId, updates, user.id);
        recordIdToUse = recordId;
      } else {
        const newRecord = await repos.maintenanceRepo.createMaintenanceRecord({
          title: title.trim(),
          equipment: equipment.trim(),
          type: type.trim(),
          coverImagePath: coverPath || undefined,
          infos: [],
          history: [],
          createdBy: user.id,
        });
        recordIdToUse = newRecord.id;
        setCurrentRecordId(newRecord.id);
      }

      if (isEditing) {
        router.back();
      } else {
        Alert.alert(t('common.success'), t('maintenance.recordCreated'), [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error saving maintenance record:', error);
      Alert.alert(t('common.error'), isEditing ? t('maintenance.updateError') : t('maintenance.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (loadError && recordId) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background, padding: theme.spacing.lg }]}>
        <Text style={{ color: colors.text, textAlign: 'center', marginBottom: theme.spacing.md }}>{loadError}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + theme.spacing.md }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('maintenance.basicInfo')}
            </Text>
            <Text style={[styles.coverLabel, { color: colors.textSecondary }]}>
              {t('maintenance.coverImage')}
            </Text>
            <View style={styles.coverRow}>
              {(() => {
                const coverUri = coverImageUri ?? (existingCoverUrl && !removedCover ? existingCoverUrl : null);
                const showCover = coverUri && isValidImageUri(coverUri);
                return showCover ? (
                <>
                  <View style={styles.coverPreviewWrap}>
                    <Image source={{ uri: coverUri }} style={styles.coverPreview} contentFit="cover" />
                  </View>
                  <TouchableOpacity
                    style={[styles.removeCoverButton, { backgroundColor: colors.error }]}
                    onPress={handleRemoveCoverImage}
                  >
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.removeCoverText}>{t('maintenance.removeCoverImage')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.addCoverButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                  onPress={handlePickCoverImage}
                >
                  <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                  <Text style={[styles.addCoverText, { color: colors.textSecondary }]}>
                    {t('maintenance.addCoverImage')}
                  </Text>
                </TouchableOpacity>
              );
              })()}
            </View>
            <Input
              label={t('maintenance.titleLabel')}
              value={title}
              onChangeText={setTitle}
              placeholder={t('maintenance.titlePlaceholder')}
            />
            <Input
              label={t('maintenance.equipment')}
              value={equipment}
              onChangeText={setEquipment}
              placeholder={t('maintenance.equipmentPlaceholder')}
            />
            <Input
              label={t('maintenance.type')}
              value={type}
              onChangeText={setType}
              placeholder={t('maintenance.typePlaceholder')}
            />
          </View>

          {/* Info Boxes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('maintenance.infos')}
              </Text>
              {infoBoxes.length === 0 && (
                <Button
                  title={t('maintenance.addFirstInfo')}
                  onPress={handleAddInfo}
                  style={styles.addFirstInfoButton}
                />
              )}
            </View>

            {infoBoxes.map((box, boxIndex) => (
              <View key={box.id} style={[styles.infoBox, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.infoBoxHeader}>
                  <Text style={[styles.infoBoxTitle, { color: colors.text }]}>
                    {t('maintenance.info')} {boxIndex + 1}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteInfo(box.id)}
                    style={styles.deleteInfoButton}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>

                <Input
                  label={t('maintenance.description')}
                  value={box.description}
                  onChangeText={(text) => handleUpdateInfoDescription(box.id, text)}
                  placeholder={t('maintenance.descriptionPlaceholder')}
                  multiline
                  numberOfLines={4}
                  style={styles.descriptionInput}
                />

                {/* Images */}
                <View style={styles.imagesSection}>
                  <Text style={[styles.imagesLabel, { color: colors.text }]}>
                    {t('maintenance.images')} ({box.images.length}/{MAX_IMAGES_PER_INFO})
                  </Text>
                  <View style={styles.imagesContainer}>
                    {(box.images ?? []).map((image, imgIndex) => (
                      <View key={imgIndex} style={styles.imageContainer}>
                        {isValidImageUri(image.uri) ? (
                          <Image source={{ uri: image.uri }} style={styles.imagePreview} contentFit="cover" />
                        ) : (
                          <View style={[styles.imagePreview, styles.imagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                            <Ionicons name="image-outline" size={24} color={colors.textTertiary} />
                          </View>
                        )}
                        <TouchableOpacity
                          style={[styles.removeImageButton, { backgroundColor: colors.error }]}
                          onPress={() => handleRemoveImageFromInfo(box.id, imgIndex)}
                        >
                          <Ionicons name="close" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {box.images.length < MAX_IMAGES_PER_INFO && (
                      <TouchableOpacity
                        style={[styles.addImageButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                        onPress={() => handleAddImageToInfo(box.id)}
                      >
                        <Ionicons name="add" size={24} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Save Info Button - only show if record is created */}
                {currentRecordId && (
                  <Button
                    title={box.isCreated ? t('maintenance.updateInfo') : t('maintenance.saveInfo')}
                    onPress={() => handleSaveInfo(box.id)}
                    style={styles.saveInfoButton}
                  />
                )}
              </View>
            ))}

            {/* Add Next Info Button - only show if last info is created */}
            {infoBoxes.length > 0 && infoBoxes[infoBoxes.length - 1].isCreated && currentRecordId && (
              <Button
                title={t('maintenance.addInfo')}
                onPress={handleAddInfo}
                style={styles.addInfoButton}
              />
            )}
          </View>

          {/* Back + Save/Update Record Buttons */}
          <View style={styles.saveRow}>
            <Button
              title={t('common.back')}
              variant="outline"
              onPress={() => router.back()}
              style={styles.backButton}
            />
            <Button
              title={isEditing ? t('maintenance.updateRecord') : t('maintenance.createRecord')}
              onPress={handleSaveRecord}
              loading={isCreating}
              style={styles.saveButtonFlex}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.md,
  },
  coverLabel: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.xs,
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  coverPreviewWrap: {
    width: 96,
    height: 96,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  coverPreview: {
    width: 96,
    height: 96,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeCoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  removeCoverText: {
    color: '#fff',
    fontSize: theme.typography.fontSize.sm,
  },
  addCoverButton: {
    width: 120,
    height: 96,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  addCoverText: {
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
  },
  addFirstInfoButton: {
    marginTop: 0,
  },
  infoBox: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  infoBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  infoBoxTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  deleteInfoButton: {
    padding: theme.spacing.xs,
  },
  descriptionInput: {
    marginBottom: theme.spacing.md,
    minHeight: 100,
  },
  imagesSection: {
    marginBottom: theme.spacing.md,
  },
  imagesLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing.sm,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  imageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.sm,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveInfoButton: {
    marginTop: theme.spacing.sm,
  },
  addInfoButton: {
    marginTop: theme.spacing.md,
  },
  saveRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  backButton: {
    flex: 1,
  },
  saveButtonFlex: {
    flex: 1,
  },
});
