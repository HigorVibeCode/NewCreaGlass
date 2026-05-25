import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { formatDate as formatDateUtil, formatDateTime as formatDateTimeUtil } from '../src/utils/date-format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropdownOption } from '../src/components/shared/Dropdown';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { PermissionGuard } from '../src/components/shared/PermissionGuard';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { repos } from '../src/services/container';
import { useAuth } from '../src/store/auth-store';
import { useGoBack, safeBack } from '../src/hooks/use-go-back';
import { theme } from '../src/theme';
import {
  downloadAndOpenAttachment,
  extractStorageObjectKey,
  getSignedUrlFromStorage,
} from '../src/utils/attachments';
import { downloadAllDxfAttachmentsAsZip } from '../src/utils/dxf-zip-download';
import { isDxfFile } from '../src/utils/production-attachment-storage';
import { confirmDelete, confirmDialog } from '../src/utils/confirm-dialog';
import { pushWithParams } from '../src/utils/navigation';
import { generateHybridLinks, shareViaWhatsApp } from '../src/utils/share-links';
import { useRouteParams } from '../src/hooks/use-route-params';
import { GlassType, InventoryItem, PaintType, Production, ProductionStatus, ProductionStatusHistory, StructureType, User } from '../src/types';

/** Resolve signed URL for a thumbnail — uses same robust logic as downloadAndOpenAttachment */
function AttachmentThumbnail({
  storagePath,
  originalStoragePath,
  filename,
  index,
}: {
  storagePath: string;
  originalStoragePath?: string;
  filename: string;
  index: number;
}) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const colors = useThemeColors();

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      try {
        // Extract a usable storage key from the URL (same approach as downloadAndOpenAttachment)
        const storageKey =
          originalStoragePath ||
          extractStorageObjectKey(storagePath) ||
          storagePath;

        const freshUrl = await getSignedUrlFromStorage(storageKey, filename);
        if (!cancelled && freshUrl && (freshUrl.startsWith('http://') || freshUrl.startsWith('https://'))) {
          setImageUri(freshUrl);
        } else if (!cancelled) {
          setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [storagePath, originalStoragePath, filename]);

  if (failed || !imageUri) {
    return (
      <View style={[thumbnailStyles.fallback, { backgroundColor: colors.backgroundSecondary }]}>
        <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
        <View style={thumbnailStyles.badge}>
          <Text style={thumbnailStyles.badgeText}>{index + 1}</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Image
        source={{ uri: imageUri }}
        style={thumbnailStyles.image}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
      <View style={thumbnailStyles.badge}>
        <Text style={thumbnailStyles.badgeText}>{index + 1}</Text>
      </View>
    </View>
  );
}

const thumbnailStyles = StyleSheet.create({
  image: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.md,
  },
  fallback: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default function ProductionDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { productionId } = useRouteParams<{ productionId: string }>('/production-detail');
  const goBack = useGoBack();

  const [production, setProduction] = useState<Production | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [glassItems, setGlassItems] = useState<Map<string, InventoryItem>>(new Map());
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [downloadingDxfZip, setDownloadingDxfZip] = useState(false);

  const dxfAttachments = useMemo(
    () =>
      (production?.attachments ?? []).filter((att) =>
        isDxfFile(att.originalName || att.filename, att.mimeType)
      ),
    [production?.attachments]
  );
  const [isLinkingWorkOrder, setIsLinkingWorkOrder] = useState(false);
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
    setLoadError(false);
    try {
      const productionData = await repos.productionRepo.getProductionById(productionId);
      if (productionData) {
        setProduction(productionData);
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
        setLoadError(true);
      }
    } catch (error) {
      console.error('Error loading production:', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: ProductionStatus): string => {
    const key = `production.status.${status}`;
    const translated = t(key);
    if (translated && translated !== key) {
      return translated;
    }
    // Compatibility fallback for old statuses
    switch (status) {
      case 'on_cabin':
        return t('production.status.on_paint_cabin');
      case 'laminating':
        return t('production.status.on_laminating_machine');
      case 'on_oven':
        return t('production.status.on_schmelz_oven');
      default:
        return status;
    }
  };

  const getStatusColor = (status: ProductionStatus): string => {
    switch (status) {
      // Red group
      case 'not_authorized':
      case 'cancelled':
      case 'rework_needed':
        return colors.error;
      // Green (entry)
      case 'authorized':
        return colors.success;
      // Orange group (active processes)
      case 'on_cutting_process':
      case 'on_polishing_process':
      case 'on_paint_cabin':
      case 'on_laminating_machine':
      case 'on_schmelz_oven':
      case 'on_banding_oven':
      case 'tempering_in_progress':
        return '#f97316';
      // Yellow group (waiting)
      case 'waiting_to_cnc_wjet':
      case 'waiting_to_drill':
      case 'waiting_to_paint_cabin':
      case 'waiting_for_schmelz':
      case 'waiting_for_tempering':
      case 'waiting_for_packing':
        return '#eab308';
      // Blue group
      case 'packed':
      case 'ready_for_dispatch':
        return colors.info;
      // Green (exit)
      case 'delivered':
      case 'completed':
        return '#059669';
      // Compatibilidade com status antigos
      case 'cutting':
      case 'polishing':
        return '#f97316';
      case 'tempered':
        return '#059669';
      case 'on_cabin':
      case 'laminating':
      case 'on_oven':
        return '#f97316';
      case 'laminated':
        return colors.info;
      default:
        return colors.textSecondary;
    }
  };

  const getOrderTypeLabel = (orderType: string): string => {
    return orderType || '';
  };

  const statusOptions: DropdownOption[] = [
    // Red group
    { label: t('production.status.not_authorized'), value: 'not_authorized' },
    { label: t('production.status.cancelled'), value: 'cancelled' },
    { label: t('production.status.rework_needed'), value: 'rework_needed' },
    // Green (entry)
    { label: `${t('production.status.authorized')} 🔔`, value: 'authorized' },
    // Orange group (active processes)
    { label: t('production.status.on_cutting_process'), value: 'on_cutting_process' },
    { label: t('production.status.on_polishing_process'), value: 'on_polishing_process' },
    { label: t('production.status.on_paint_cabin'), value: 'on_paint_cabin' },
    { label: t('production.status.on_laminating_machine'), value: 'on_laminating_machine' },
    { label: t('production.status.on_schmelz_oven'), value: 'on_schmelz_oven' },
    { label: t('production.status.on_banding_oven'), value: 'on_banding_oven' },
    { label: t('production.status.tempering_in_progress'), value: 'tempering_in_progress' },
    // Yellow group (waiting)
    { label: t('production.status.waiting_to_cnc_wjet'), value: 'waiting_to_cnc_wjet' },
    { label: t('production.status.waiting_to_drill'), value: 'waiting_to_drill' },
    { label: t('production.status.waiting_to_paint_cabin'), value: 'waiting_to_paint_cabin' },
    { label: t('production.status.waiting_for_schmelz'), value: 'waiting_for_schmelz' },
    { label: t('production.status.waiting_for_tempering'), value: 'waiting_for_tempering' },
    { label: t('production.status.waiting_for_packing'), value: 'waiting_for_packing' },
    // Blue group
    { label: t('production.status.packed'), value: 'packed' },
    { label: t('production.status.ready_for_dispatch'), value: 'ready_for_dispatch' },
    // Green (exit)
    { label: t('production.status.delivered'), value: 'delivered' },
    { label: t('production.status.completed'), value: 'completed' },
  ];

  const handleStatusSelect = async (newStatus: ProductionStatus) => {
    if (!productionId || !production || !user) {
      console.error('handleStatusSelect: Missing required data', { productionId, production: !!production, user: !!user });
      return;
    }
    
    console.log('handleStatusSelect: Updating status', { productionId, currentStatus: production.status, newStatus });
    setStatusModalVisible(false);
    
    try {
      await repos.productionRepo.updateProduction(productionId, { status: newStatus }, user.id);
      console.log('handleStatusSelect: Status updated successfully');
      await loadProduction();
      Alert.alert(t('common.success'), t('production.statusUpdated'));
    } catch (error) {
      console.error('Error updating status:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert(t('common.error'), t('production.updateStatusError') + ': ' + errorMessage);
      setStatusModalVisible(true); // Reabre o modal em caso de erro
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
    return formatDateTimeUtil(dateString);
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
      case 'lavabo':
        return t('production.glassTypes.lavabo');
      case 'client_service':
        return t('production.glassTypes.client_service');
      case 'polish_only':
        return t('production.glassTypes.polish_only');
      case 'cutting_only':
        return t('production.glassTypes.cutting_only');
      case 'schmelzglas_only':
        return t('production.glassTypes.schmelzglas_only');
      case 'float_esg':
        return t('production.glassTypes.float_esg');
      case 'schmelzglas_tvg':
        return t('production.glassTypes.schmelzglas_tvg');
      case 'float_tvg':
        return t('production.glassTypes.float_tvg');
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
    return formatDateUtil(dateString);
  };

  const handleEdit = () => {
    if (!productionId) return;
    pushWithParams(router, '/production-create', { productionId: productionId! });
  };

  const handleDelete = () => {
    if (!productionId) return;
    confirmDelete(
      t('common.delete'),
      t('production.deleteOrderConfirm'),
      async () => {
        await repos.productionRepo.deleteProduction(productionId);
        safeBack(router);
      },
      undefined,
      t('common.delete'),
      t('common.cancel'),
      t('production.orderDeleted'),
      t('production.deleteOrderError')
    );
  };

  const handleSave = () => {
    // TODO: Implement save
    Alert.alert(t('common.info'), 'Save functionality will be implemented');
  };

  const linkWorkOrder = async () => {
    if (!production || !user) return;

    setIsLinkingWorkOrder(true);
    try {
      let clientAddress = '';
      let clientContact = '';
      if (production.clientId) {
        const client = await repos.clientsRepo.getClientById(production.clientId);
        clientAddress = client?.address || '';
        clientContact = client?.contact || '';
      }

      const plannedMaterials = production.items.map((item, index) => ({
        id: `po-item-${index}`,
        name: `${getGlassTypeLabel(item.glassType)} (${item.quantity})`,
        quantity: item.quantity || 1,
        unit: 'un',
      }));

      const createdWorkOrder = await repos.workOrdersRepo.createWorkOrder({
        clientId: production.clientId,
        clientName: production.clientName,
        clientAddress,
        clientContact,
        serviceType: 'external',
        scheduledDate: production.dueDate,
        scheduledTime: '07:30',
        status: 'planned',
        plannedChecklist: [],
        plannedMaterials,
        teamMembers: [],
        responsible: user.id,
        isLocked: false,
        productionOrderId: production.id,
        timeStatuses: [],
        serviceLogs: [],
        evidences: [],
        checklistItems: [],
        createdBy: user.id,
      });

      // Import production attachments as work order evidences
      for (const attachment of production.attachments || []) {
        const candidatePath = attachment.originalStoragePath || attachment.storagePath;
        const filePath = extractStoragePathFromUrl(candidatePath) || candidatePath;
        if (!filePath) continue;
        await repos.workOrdersRepo.createEvidence(createdWorkOrder.id, {
          type: 'antes',
          photoPath: filePath,
          createdBy: user.id,
        });
      }

      await repos.productionRepo.updateProduction(production.id, {
        linkedWorkOrderId: createdWorkOrder.id,
      });

      await loadProduction();
      if (Platform.OS === 'web') {
        confirmDialog(
          t('common.success'),
          `${t('production.workOrderLinkedSuccess')}\n\n${t('production.openLinkedWorkOrder')}?`,
          () => pushWithParams(router, '/work-order-detail', { workOrderId: createdWorkOrder.id }),
          undefined,
          t('common.confirm'),
          t('common.cancel')
        );
      } else {
        Alert.alert(t('common.success'), t('production.workOrderLinkedSuccess'), [
          {
            text: t('production.openLinkedWorkOrder'),
            onPress: () => pushWithParams(router, '/work-order-detail', { workOrderId: createdWorkOrder.id }),
          },
          { text: t('common.confirm') },
        ]);
      }
    } catch (error) {
      console.error('Error linking work order:', error);
      Alert.alert(t('common.error'), t('production.workOrderLinkedError'));
    } finally {
      setIsLinkingWorkOrder(false);
    }
  };

  const handleLinkWorkOrder = async () => {
    if (isLinkingWorkOrder) return;
    if (production?.linkedWorkOrderId) {
      setIsLinkingWorkOrder(true);
      try {
        const linkedWorkOrder = await repos.workOrdersRepo.getWorkOrderById(production.linkedWorkOrderId);
        if (linkedWorkOrder) {
          pushWithParams(router, '/work-order-detail', { workOrderId: production.linkedWorkOrderId });
          return;
        }
      } catch (error) {
        console.error('Error validating linked work order:', error);
      } finally {
        setIsLinkingWorkOrder(false);
      }
    }
    confirmDialog(
      t('production.linkWorkOrderConfirmTitle'),
      t('production.linkWorkOrderConfirmMessage'),
      () => {
        linkWorkOrder();
      },
      undefined,
      t('production.linkWorkOrderAction'),
      t('common.cancel')
    );
  };

  const handleDownloadAllDxf = async () => {
    if (!production || dxfAttachments.length < 2) return;

    setDownloadingDxfZip(true);
    try {
      const zipBaseName = `PO-${(production.orderNumber || production.id).trim()}`;
      await downloadAllDxfAttachmentsAsZip(production.attachments, zipBaseName);
    } catch (error) {
      console.error('Error downloading DXF ZIP:', error);
      Alert.alert(t('common.error'), t('production.downloadAllDxfError'));
    } finally {
      setDownloadingDxfZip(false);
    }
  };

  const handleAttachmentPress = async (attachment: {
    storagePath: string;
    originalStoragePath?: string;
    originalName?: string;
    mimeType: string;
    filename: string;
  }) => {
    try {
      const storageKey =
        attachment.originalStoragePath ||
        extractStorageObjectKey(attachment.storagePath) ||
        attachment.storagePath;

      await downloadAndOpenAttachment(
        storageKey,
        attachment.originalName || attachment.filename,
        attachment.mimeType
      );
    } catch (error) {
      console.error('Error opening attachment:', error);
    }
  };

  const handleShare = async () => {
    if (!productionId) return;
    const orderNumber = production?.orderNumber || '';
    const clientName = production?.clientName || '';
    const shareTitle = `Production Order ${orderNumber} - ${clientName}`.trim();
    await shareViaWhatsApp(
      { entity: 'production', params: { productionId } },
      shareTitle
    );
  };

  const handlePrintLabel = async () => {
    if (!productionId || !production) return;

    try {
      const { webUrl } = generateHybridLinks({
        entity: 'production',
        params: { productionId },
      });
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(webUrl)}`;
      const glassValue = production.items
        .map((item) => glassItems.get(item.glassId)?.name || getGlassTypeLabel(item.glassType))
        .filter(Boolean)
        .join(', ') || '-';
      const glassTypeValue = Array.from(
        new Set(
          production.items
            .map((item) => getGlassTypeLabel(item.glassType))
            .filter(Boolean)
        )
      ).join(', ') || '-';
      const esc = (value: string) =>
        value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${esc(`${production.clientName || 'Client'} - PO ${production.orderNumber || '-'}`)}</title>
            <style>
              @page { size: 297mm 185mm; margin: 8mm; }
              html, body { width: 100%; height: auto; }
              body {
                margin: 0;
                font-family: Arial, sans-serif;
                color: #111;
                background: #ffffff;
              }
              .sheet {
                width: 281mm;
                max-width: 100%;
                margin: 0 auto;
              }
              .label {
                width: 100%;
                height: 169mm;
                border: 1px solid #dbe3f0;
                border-radius: 8px;
                box-sizing: border-box;
                padding: 0;
                display: flex;
                gap: 0;
                align-items: stretch;
                overflow: hidden;
                background: #ffffff;
              }
              .left {
                width: 70%;
                min-width: 0;
                padding: 18px 14px 16px 20px;
              }
              .topbar {
                background: #000000;
                color: #fff;
                font-size: 30px;
                font-weight: 700;
                letter-spacing: 0.6px;
                padding: 10px 20px;
              }
              .title-row {
                display: none;
              }
              .title {
                font-size: 40px;
                font-weight: 700;
                margin: 0;
                color: #0b3c79;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .row {
                font-size: 50px;
                margin-bottom: 4px;
                line-height: 1.12;
                text-align: left;
              }
              .label-key { font-weight: 700; }
              .row-value {
                white-space: normal;
                overflow-wrap: anywhere;
                word-break: break-word;
              }
              .qr-wrap {
                width: 30%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                background: #ffffff;
                border-left: 1px solid #dbe3f0;
                padding: 16px 10px 10px;
              }
              .qr {
                width: 96%;
                max-width: 78mm;
                aspect-ratio: 1 / 1;
                object-fit: contain;
                border: 1px solid #dbe3f0;
                border-radius: 4px;
                background: #fff;
                padding: 5px;
              }
              .qr-caption {
                margin-top: 8px;
                font-size: 33px;
                color: #5b6b86;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="sheet">
            <div class="label">
              <div style="width:70%;min-width:0;display:flex;flex-direction:column;">
                <div class="topbar">PO - Production Order ${esc(production.orderNumber || '-')}</div>
                <div class="left">
                <div class="row"><span class="label-key">Client:</span><span class="row-value">${esc(production.clientName || '-')}</span></div>
                <div class="row"><span class="label-key">Order Type:</span><span class="row-value">${esc(getOrderTypeLabel(production.orderType) || '-')}</span></div>
                <div class="row"><span class="label-key">Due Date:</span><span class="row-value">${esc(formatDate(production.dueDate) || '-')}</span></div>
                <div class="row"><span class="label-key">Glass:</span><span class="row-value">${esc(glassValue)}</span></div>
                <div class="row"><span class="label-key">Glass Type:</span><span class="row-value">${esc(glassTypeValue)}</span></div>
                </div>
              </div>
              <div class="qr-wrap">
                <img class="qr" src="${qrUrl}" alt="QR Code" />
                <div class="qr-caption">Scan to open PO</div>
              </div>
            </div>
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => {
              if (printWindow && !printWindow.closed) {
                printWindow.focus();
                printWindow.print();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }
            }, 400);
          };
          return;
        }
      }

      const { uri } = await Print.printToFileAsync({ html });
      try {
        if (Platform.OS === 'android') {
          const contentUri = await FileSystemLegacy.getContentUriAsync(uri);
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1,
            type: 'application/pdf',
          });
        } else {
          const canOpen = await Linking.canOpenURL(uri);
          if (!canOpen) throw new Error('Cannot open PDF URI');
          await Linking.openURL(uri);
        }
      } catch (openError) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: t('common.share') || 'Share',
          });
        } else {
          Alert.alert(t('common.success') || 'Success', uri);
        }
      }
    } catch (error) {
      console.error('Error printing label:', error);
      Alert.alert(t('common.error') || 'Error', t('inventory.reportGenerationError') || 'Could not generate label');
    }
  };

  if (isLoading) {
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

  if (loadError || !production) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>
            {t('common.error')}
          </Text>
          <TouchableOpacity
            onPress={goBack}
            style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>{t('common.back') || 'Back'}</Text>
          </TouchableOpacity>
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
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
                {t('production.attachments')}
              </Text>
              <View style={styles.sectionHeaderActions}>
                {dxfAttachments.length > 1 && (
                  <TouchableOpacity
                    style={[
                      styles.downloadAllDxfButton,
                      { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                    ]}
                    onPress={handleDownloadAllDxf}
                    disabled={downloadingDxfZip}
                    activeOpacity={0.7}
                  >
                    {downloadingDxfZip ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="archive-outline" size={16} color={colors.primary} />
                        <Text style={[styles.downloadAllDxfLabel, { color: colors.primary }]}>
                          {t('production.downloadAllDxf')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.inlineIconButton, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => {
                    if (!productionId) return;
                    pushWithParams(router, '/production-create', {
                      productionId: String(productionId),
                      quickAttachmentAction: 'camera',
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            {/* Image thumbnails grid */}
            {production.attachments.some((a) => a.mimeType.startsWith('image/')) && (
              <View style={styles.thumbnailGrid}>
                {production.attachments
                  .filter((a) => a.mimeType.startsWith('image/'))
                  .map((attachment, idx) => (
                    <TouchableOpacity
                      key={attachment.id}
                      style={[styles.thumbnailCard, { backgroundColor: colors.cardBackground }]}
                      onPress={() => handleAttachmentPress(attachment)}
                      activeOpacity={0.7}
                    >
                      <AttachmentThumbnail
                        storagePath={attachment.storagePath}
                        originalStoragePath={attachment.originalStoragePath}
                        filename={attachment.originalName || attachment.filename}
                        index={idx}
                      />
                    </TouchableOpacity>
                  ))}
              </View>
            )}
            {/* PDF attachments (unchanged) */}
            {production.attachments
              .filter((a) => !a.mimeType.startsWith('image/'))
              .map((attachment) => {
                const isDxf = isDxfFile(
                  attachment.originalName || attachment.filename,
                  attachment.mimeType
                );
                return (
                  <TouchableOpacity
                    key={attachment.id}
                    style={[styles.attachmentCard, { backgroundColor: colors.cardBackground }]}
                    onPress={() => handleAttachmentPress(attachment)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isDxf ? 'layers-outline' : 'document-text'}
                      size={20}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.attachmentName, { color: colors.text }]}>
                      {attachment.originalName || attachment.filename}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }]}
            onPress={goBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Ionicons name="share-social-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }]}
            onPress={handlePrintLabel}
            activeOpacity={0.7}
          >
            <Ionicons name="print-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleLinkWorkOrder}
            activeOpacity={0.7}
            disabled={isLinkingWorkOrder}
          >
            <Ionicons name="link-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <PermissionGuard permission="production.update">
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }]}
              onPress={handleEdit}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </PermissionGuard>
          <PermissionGuard permission="production.delete">
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.error }]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={24} color={colors.error} />
            </TouchableOpacity>
          </PermissionGuard>
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
          <View 
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(e) => e.stopPropagation()}
          >
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
                  onPress={() => {
                    console.log('Status option clicked:', option.value);
                    handleStatusSelect(option.value as ProductionStatus);
                  }}
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
        </View>
      </TouchableWithoutFeedback>
    </Modal>

    <Modal
      visible={historyModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setHistoryModalVisible(false)}
    >
      <TouchableWithoutFeedback onPress={() => setHistoryModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t('production.statusHistory')}
                </Text>
                <TouchableOpacity 
                  onPress={() => setHistoryModalVisible(false)}
                  activeOpacity={0.7}
                >
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
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexShrink: 1,
  },
  downloadAllDxfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 30,
  },
  downloadAllDxfLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  inlineIconButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  thumbnailCard: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
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
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xs,
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
