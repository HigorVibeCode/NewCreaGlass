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
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { Button } from '../src/components/shared/Button';
import { repos } from '../src/services/container';
import { useAuth } from '../src/store/auth-store';
import { MaintenanceRecord } from '../src/types';
import { theme } from '../src/theme';
import { Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MaintenanceDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const isDark = effectiveTheme === 'dark';
  const insets = useSafeAreaInsets();
  const { recordId } = useLocalSearchParams<{ recordId: string }>();

  const [record, setRecord] = useState<MaintenanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (recordId) {
      loadRecord();
    }
  }, [recordId]);

  const loadRecord = async () => {
    if (!recordId) return;
    setIsLoading(true);
    try {
      const recordData = await repos.maintenanceRepo.getMaintenanceRecordById(recordId);
      if (recordData) {
        setRecord(recordData);
      } else {
        Alert.alert(t('common.error'), t('maintenance.recordNotFound'), [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error loading maintenance record:', error);
      Alert.alert(t('common.error'), t('maintenance.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    router.push({
      pathname: '/maintenance-create',
      params: { recordId },
    } as any);
  };

  const handleDelete = () => {
    Alert.alert(
      t('common.confirm'),
      t('maintenance.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (!recordId) return;
            try {
              await repos.maintenanceRepo.deleteMaintenanceRecord(recordId);
              Alert.alert(t('common.success'), t('maintenance.recordDeleted'), [
                { text: t('common.confirm'), onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('Error deleting maintenance record:', error);
              Alert.alert(t('common.error'), t('maintenance.deleteError'));
            }
          },
        },
      ]
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

  if (!record) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text }}>{t('maintenance.recordNotFound')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Custom Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.background,
              paddingTop: Platform.OS === 'ios' ? Math.max(insets.top, theme.spacing.sm) : theme.spacing.md,
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
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Info */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('maintenance.basicInfo')}
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              {t('maintenance.title')}:
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {record.title}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              {t('maintenance.equipment')}:
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {record.equipment}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              {t('maintenance.type')}:
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {record.type}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              {t('maintenance.createdAt')}:
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {formatDate(record.createdAt)}
            </Text>
          </View>
          {record.updatedAt !== record.createdAt && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                {t('maintenance.updatedAt')}:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {formatDate(record.updatedAt)}
              </Text>
            </View>
          )}
        </View>

        {/* Info Boxes */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('maintenance.infos')} ({record.infos.length})
          </Text>
          {record.infos.length === 0 ? (
            <View style={[styles.emptyInfoBox, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('maintenance.noInfos')}
              </Text>
            </View>
          ) : (
            record.infos.map((info, index) => (
              <View key={info.id} style={[styles.infoBox, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.infoBoxHeader}>
                  <Text style={[styles.infoBoxTitle, { color: colors.text }]}>
                    {t('maintenance.info')} {index + 1}
                  </Text>
                </View>
                <Text style={[styles.infoDescription, { color: colors.text }]}>
                  {info.description}
                </Text>
                {info.images.length > 0 && (
                  <View style={styles.imagesContainer}>
                    {info.images.map((image, imgIndex) => (
                      <TouchableOpacity
                        key={imgIndex}
                        onPress={() => handleImagePress(image.storagePath)}
                        style={styles.imageWrapper}
                      >
                        <Image source={{ uri: image.storagePath }} style={styles.imagePreview} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))
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
            {selectedImage && (
              <Image source={{ uri: selectedImage }} style={styles.modalImage} resizeMode="contain" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    zIndex: 10,
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
  infoRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
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
  infoBox: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  infoBoxHeader: {
    marginBottom: theme.spacing.sm,
  },
  infoBoxTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  infoDescription: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.md,
    marginBottom: theme.spacing.md,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  imageWrapper: {
    width: (SCREEN_WIDTH - theme.spacing.lg * 2 - theme.spacing.md * 2 - theme.spacing.sm * 2) / 3,
    height: (SCREEN_WIDTH - theme.spacing.lg * 2 - theme.spacing.md * 2 - theme.spacing.sm * 2) / 3,
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
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
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
