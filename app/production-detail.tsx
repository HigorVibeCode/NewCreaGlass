import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropdownOption } from '../src/components/shared/Dropdown';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { repos } from '../src/services/container';
import { useAuth } from '../src/store/auth-store';
import { theme } from '../src/theme';
import { downloadAndOpenAttachment } from '../src/utils/attachments';
import { GlassType, InventoryItem, PaintType, Production, ProductionStatus, ProductionStatusHistory, StructureType, User } from '../src/types';

export default function ProductionDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { productionId } = useLocalSearchParams<{ productionId: string }>();

  const [production, setProduction] = useState<Production | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [glassItems, setGlassItems] = useState<Map<string, InventoryItem>>(new Map());
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [statusHistory, setStatusHistory] = useState<ProductionStatusHistory[]>([]);
  const [historyUsers, setHistoryUsers] = useState<Map<string, User>>(new Map());

  useEffect(() => {
    if (productionId) {
      loadProduction();
    }
  }, [productionId]);

  const loadProduction = async () => {
    if (!productionId) return;
    setIsLoading(true);
    try {
      const productionData = await repos.productionRepo.getProductionById(productionId);
      if (productionData) {
        setProduction(productionData);
        // Load glass items for all items
        const glassIds = productionData.items.map(item => item.glassId).filter(Boolean);
        const glassMap = new Map<string, InventoryItem>();
        for (const glassId of glassIds) {
          try {
            const glassItem = await repos.inventoryRepo.getItemById(glassId);
            if (glassItem) {
              glassMap.set(glassId, glassItem);
            }
          } catch (error) {
            console.error(`Error loading glass item ${glassId}:`, error);
          }
        }
        setGlassItems(glassMap);
      } else {
        Alert.alert(t('common.error'), 'Production order not found', [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error loading production:', error);
      Alert.alert(t('common.error'), 'Failed to load production order');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: ProductionStatus): string => {
    switch (status) {
      case 'not_authorized':
        return t('production.status.not_authorized');
      case 'authorized':
        return t('production.status.authorized');
      case 'cutting':
        return t('production.status.cutting');
      case 'polishing':
        return t('production.status.polishing');
      case 'waiting_for_tempering':
        return t('production.status.waiting_for_tempering');
      case 'on_oven':
        return t('production.status.on_oven');
      case 'tempered':
        return t('production.status.tempered');
      case 'on_cabin':
        return t('production.status.on_cabin');
      case 'laminating':
        return t('production.status.laminating');
      case 'laminated':
        return t('production.status.laminated');
      case 'waiting_for_packing':
        return t('production.status.waiting_for_packing');
      case 'packed':
        return t('production.status.packed');
      case 'ready_for_dispatch':
        return t('production.status.ready_for_dispatch');
      case 'delivered':
        return t('production.status.delivered');
      case 'completed':
        return t('production.status.completed');
      default:
        return status;
    }
  };

  const getStatusColor = (status: ProductionStatus): string => {
    switch (status) {
      case 'not_authorized':
        return colors.error;
      case 'authorized':
        return colors.success; // Green (most important phase)
      case 'cutting':
        return colors.info;
      case 'polishing':
        return '#06b6d4'; // Cyan
      case 'waiting_for_tempering':
        return colors.warning;
      case 'on_oven':
        return '#f59e0b'; // Amber
      case 'tempered':
        return '#8b5cf6'; // Purple
      case 'on_cabin':
        return colors.info;
      case 'laminating':
        return '#06b6d4'; // Cyan
      case 'laminated':
        return '#3b82f6'; // Blue
      case 'waiting_for_packing':
        return colors.warning;
      case 'packed':
        return '#06b6d4'; // Cyan
      case 'ready_for_dispatch':
        return '#f59e0b'; // Amber
      case 'delivered':
        return colors.success;
      case 'completed':
        return colors.success;
      default:
        return colors.textSecondary;
    }
  };

  const getOrderTypeLabel = (orderType: string): string => {
    return orderType || '';
  };

  const statusOptions: DropdownOption[] = [
    { label: t('production.status.not_authorized'), value: 'not_authorized' },
    { label: t('production.status.authorized'), value: 'authorized' },
    { label: t('production.status.cutting'), value: 'cutting' },
    { label: t('production.status.polishing'), value: 'polishing' },
    { label: t('production.status.waiting_for_tempering'), value: 'waiting_for_tempering' },
    { label: t('production.status.on_oven'), value: 'on_oven' },
    { label: t('production.status.tempered'), value: 'tempered' },
    { label: t('production.status.on_cabin'), value: 'on_cabin' },
    { label: t('production.status.laminating'), value: 'laminating' },
    { label: t('production.status.laminated'), value: 'laminated' },
    { label: t('production.status.waiting_for_packing'), value: 'waiting_for_packing' },
    { label: t('production.status.packed'), value: 'packed' },
    { label: t('production.status.ready_for_dispatch'), value: 'ready_for_dispatch' },
    { label: t('production.status.delivered'), value: 'delivered' },
    { label: t('production.status.completed'), value: 'completed' },
  ];

  const handleStatusSelect = async (newStatus: ProductionStatus) => {
    if (!productionId || !production || !user) return;
    setStatusModalVisible(false);
    try {
      await repos.productionRepo.updateProduction(productionId, { status: newStatus }, user.id);
      await loadProduction();
      Alert.alert(t('common.success'), t('production.statusUpdated'));
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert(t('common.error'), t('production.updateStatusError'));
    }
  };

  const loadStatusHistory = async () => {
    if (!productionId) return;
    try {
      const history = await repos.productionRepo.getStatusHistory(productionId);
      setStatusHistory(history);
      
      // Load users for history entries
      const userIds = Array.from(new Set(history.map(h => h.changedBy)));
      const userMap = new Map<string, User>();
      for (const userId of userIds) {
        try {
          const userData = await repos.usersRepo.getUserById(userId);
          if (userData) {
            userMap.set(userId, userData);
          }
        } catch (error) {
          console.error(`Error loading user ${userId}:`, error);
        }
      }
      setHistoryUsers(userMap);
    } catch (error) {
      console.error('Error loading status history:', error);
    }
  };

  const handleOpenHistory = async () => {
    setHistoryModalVisible(true);
    await loadStatusHistory();
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getGlassTypeLabel = (glassType: GlassType): string => {
    switch (glassType) {
      case 'tempered':
        return t('production.glassTypes.tempered');
      case 'strengthened':
        return t('production.glassTypes.strengthened');
      case 'float':
        return t('production.glassTypes.float');
      case 'laminated':
        return t('production.glassTypes.laminated');
      case 'textured':
        return t('production.glassTypes.textured');
      case 'sandblasted':
        return t('production.glassTypes.sandblasted');
      case 'cuted':
        return t('production.glassTypes.cuted');
      case 'insulated':
        return t('production.glassTypes.insulated');
      default:
        return glassType;
    }
  };

  const getStructureTypeLabel = (structureType: StructureType): string => {
    switch (structureType) {
      case 'none':
        return t('production.structureTypes.none');
      case 'linear':
        return t('production.structureTypes.linear');
      case 'abstract':
        return t('production.structureTypes.abstract');
      case 'organic':
        return t('production.structureTypes.organic');
      case 'check_project':
        return t('production.structureTypes.check_project');
      default:
        return structureType;
    }
  };

  const getPaintTypeLabel = (paintType: PaintType): string => {
    switch (paintType) {
      case 'none':
        return t('production.paintTypes.none');
      case 'solid':
        return t('production.paintTypes.solid');
      case 'gradient':
        return t('production.paintTypes.gradient');
      case 'printed':
        return t('production.paintTypes.printed');
      case 'satiniert':
        return t('production.paintTypes.satiniert');
      case 'check_project':
        return t('production.paintTypes.check_project');
      default:
        return paintType;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const handleEdit = () => {
    if (!productionId) return;
    router.push({
      pathname: '/production-create',
      params: { productionId },
    });
  };

  const handleDelete = () => {
    Alert.alert(
      t('common.delete'),
      t('production.deleteOrderConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (!productionId) return;
            try {
              await repos.productionRepo.deleteProduction(productionId);
              Alert.alert(t('common.success'), t('production.orderDeleted'), [
                { text: t('common.confirm'), onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('Error deleting production:', error);
              Alert.alert(t('common.error'), t('production.deleteOrderError'));
            }
          },
        },
      ]
    );
  };

  const handleSave = () => {
    // TODO: Implement save
    Alert.alert(t('common.info'), 'Save functionality will be implemented');
  };

  const handleAttachmentPress = async (attachment: { storagePath: string; mimeType: string; filename: string }) => {
    await downloadAndOpenAttachment(
      attachment.storagePath,
      attachment.filename,
      attachment.mimeType
    );
  };

  if (isLoading || !production) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('common.loading')}
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <>
    <ScreenWrapper>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + theme.spacing.md }]}
      >
      <View style={styles.content}>
        <View style={[styles.headerCard, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.clientName, { color: colors.text }]}>{production.clientName}</Text>
            <TouchableOpacity
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(production.status) + '20' },
              ]}
              onPress={() => setStatusModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor(production.status) },
                ]}
              >
                {getStatusLabel(production.status)}
              </Text>
              <Ionicons name="chevron-down" size={16} color={getStatusColor(production.status)} style={{ marginLeft: theme.spacing.xs }} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.orderType, { color: colors.textSecondary }]}>
            {getOrderTypeLabel(production.orderType)}
          </Text>
          <Text style={[styles.dueDate, { color: colors.textSecondary }]}>
            {t('production.dueDate')}: {formatDate(production.dueDate)}
          </Text>
          <TouchableOpacity
            style={[styles.historyButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={handleOpenHistory}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.historyButtonText, { color: colors.textSecondary }]}>
              {t('production.statusHistory')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('production.items')}
          </Text>
          {production.items.map((item, index) => (
            <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.itemHeader}>
                <Text style={[styles.itemNumber, { color: colors.textSecondary }]}>
                  {t('production.item')} {index + 1}
                </Text>
              </View>
              <View style={styles.itemDetails}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {t('production.glass')}:
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {glassItems.get(item.glassId)?.name || '-'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {t('production.glassType')}:
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {getGlassTypeLabel(item.glassType)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {t('production.quantity')}:
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {item.quantity}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {t('production.areaM2')}:
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {item.areaM2} m²
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {t('production.structureType')}:
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {getStructureTypeLabel(item.structureType)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {t('production.paintType')}:
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {getPaintTypeLabel(item.paintType)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {production.attachments.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('production.attachments')}
            </Text>
            {production.attachments.map((attachment) => (
              <TouchableOpacity
                key={attachment.id}
                style={[styles.attachmentCard, { backgroundColor: colors.cardBackground }]}
                onPress={() => handleAttachmentPress(attachment)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={attachment.mimeType.startsWith('image/') ? 'image' : 'document-text'} 
                  size={20} 
                  color={colors.textSecondary} 
                />
                <Text style={[styles.attachmentName, { color: colors.text }]}>
                  {attachment.filename}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleEdit}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.error }]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      </ScrollView>
    </ScreenWrapper>

    <Modal
      visible={statusModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setStatusModalVisible(false)}
    >
      <TouchableWithoutFeedback onPress={() => setStatusModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t('production.selectStatus')}
                </Text>
                <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.optionsList} nestedScrollEnabled>
                {statusOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionItem,
                      { borderBottomColor: colors.borderLight },
                      production?.status === option.value && { backgroundColor: colors.primary + '10' },
                    ]}
                    onPress={() => handleStatusSelect(option.value as ProductionStatus)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          styles.statusColorIndicator,
                          { backgroundColor: getStatusColor(option.value as ProductionStatus) },
                        ]}
                      />
                      <Text
                        style={[
                          styles.optionText,
                          { color: colors.text },
                          production?.status === option.value && { 
                            fontWeight: theme.typography.fontWeight.semibold, 
                            color: colors.primary 
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {production?.status === option.value && (
                      <Ionicons name="checkmark" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>

    <Modal
      visible={historyModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setHistoryModalVisible(false)}
    >
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <TouchableWithoutFeedback onPress={() => setHistoryModalVisible(false)}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('production.statusHistory')}
            </Text>
            <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView 
            style={styles.historyScrollView} 
            contentContainerStyle={styles.historyListContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
                {statusHistory.length === 0 ? (
                  <Text style={[styles.emptyHistoryText, { color: colors.textSecondary }]}>
                    {t('production.noStatusHistory')}
                  </Text>
                ) : (
                  statusHistory.map((historyEntry) => (
                    <View key={historyEntry.id} style={[styles.historyItem, { borderBottomColor: colors.borderLight }]}>
                      <View style={styles.historyStatusChange}>
                        <View style={styles.historyStatusRow}>
                          <Text style={[styles.historyLabel, { color: colors.textSecondary }]}>
                            {t('production.previousStatus')}:
                          </Text>
                          <View style={[styles.statusBadgeSmall, { backgroundColor: getStatusColor(historyEntry.previousStatus) + '20' }]}>
                            <Text style={[styles.statusTextSmall, { color: getStatusColor(historyEntry.previousStatus) }]}>
                              {getStatusLabel(historyEntry.previousStatus)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.historyArrowContainer}>
                          <Ionicons name="arrow-down" size={16} color={colors.textSecondary} />
                        </View>
                        <View style={styles.historyStatusRow}>
                          <Text style={[styles.historyLabel, { color: colors.textSecondary }]}>
                            {t('production.newStatus')}:
                          </Text>
                          <View style={[styles.statusBadgeSmall, { backgroundColor: getStatusColor(historyEntry.newStatus) + '20' }]}>
                            <Text style={[styles.statusTextSmall, { color: getStatusColor(historyEntry.newStatus) }]}>
                              {getStatusLabel(historyEntry.newStatus)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.historyMeta}>
                        <Text style={[styles.historyMetaText, { color: colors.textTertiary }]}>
                          {t('production.changedBy')}: {historyUsers.get(historyEntry.changedBy)?.username || t('common.unknownUser')}
                        </Text>
                        <Text style={[styles.historyMetaText, { color: colors.textTertiary }]}>
                          {t('production.changedAt')}: {formatDateTime(historyEntry.changedAt)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  content: {
    padding: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    fontSize: theme.typography.fontSize.md,
  },
  headerCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  clientName: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
    marginRight: theme.spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    minHeight: 36,
  },
  statusText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  orderType: {
    fontSize: theme.typography.fontSize.md,
    marginBottom: theme.spacing.xs,
  },
  dueDate: {
    fontSize: theme.typography.fontSize.sm,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.md,
  },
  itemCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  itemHeader: {
    marginBottom: theme.spacing.md,
  },
  itemNumber: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  itemDetails: {
    gap: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  detailValue: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    flex: 1,
    textAlign: 'right',
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  attachmentName: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: Dimensions.get('window').height * 0.8,
    ...theme.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  optionsList: {
    maxHeight: 400,
    flexGrow: 0,
  },
  historyScrollView: {
    height: Dimensions.get('window').height * 0.5,
  },
  historyListContent: {
    paddingBottom: theme.spacing.md,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.md,
  },
  optionText: {
    fontSize: theme.typography.fontSize.md,
    flex: 1,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  historyButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
  },
  emptyHistoryText: {
    textAlign: 'center',
    padding: theme.spacing.lg,
    fontSize: theme.typography.fontSize.md,
  },
  historyItem: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  historyStatusChange: {
    marginBottom: theme.spacing.sm,
  },
  historyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  historyLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    minWidth: 100,
  },
  statusBadgeSmall: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    flexShrink: 0,
  },
  statusTextSmall: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  historyArrowContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  historyMeta: {
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  historyMetaText: {
    fontSize: theme.typography.fontSize.xs,
    lineHeight: theme.typography.fontSize.xs * 1.4,
  },
});
