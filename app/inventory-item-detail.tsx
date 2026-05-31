import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRouteParams } from '../src/hooks/use-route-params';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useI18n } from '../src/hooks/use-i18n';
import { repos } from '../src/services/container';
import {
  hasInventoryImageCards,
  isGlassInventoryGroup,
  isProfilesInventoryGroup,
} from '../src/constants/inventory-groups';
import { InventoryItem } from '../src/types';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { PermissionGuard } from '../src/components/shared/PermissionGuard';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack } from '../src/hooks/use-go-back';
import { prefetchSignedUrls } from '../src/utils/signed-url-cache';
import { pushWithParams } from '../src/utils/navigation';
import { generateHybridLinks, shareViaWhatsApp } from '../src/utils/share-links';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

function DetailImage({ storagePath }: { storagePath: string }) {
  const colors = useThemeColors();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    repos.inventoryRepo.getItemImageUrlSigned(storagePath).then((u) => {
      if (!cancelled && u) setUrl(u);
    });
    return () => { cancelled = true; };
  }, [storagePath]);
  if (!url) {
    return (
      <View style={[styles.detailImageBox, { backgroundColor: colors.backgroundSecondary }]}>
        <Ionicons name="image-outline" size={48} color={colors.textTertiary} />
      </View>
    );
  }
  return (
    <View style={[styles.detailImageBox, { backgroundColor: colors.backgroundSecondary }]}>
      <Image source={{ uri: url }} style={styles.detailImage} contentFit="cover" cachePolicy="memory-disk" />
    </View>
  );
}

export default function InventoryItemDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { itemId, groupId } = useRouteParams<{ itemId: string; groupId: string }>('/inventory-item-detail');
  const goBack = useGoBack('/(tabs)/inventory');

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [groupName, setGroupName] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (itemId) {
      loadItem();
    }
  }, [itemId]);

  const loadItem = async () => {
    if (!itemId) return;
    setIsLoading(true);
    setLoadError(false);
    try {
      const data = await repos.inventoryRepo.getItemById(itemId);
      setItem(data ?? null);
      const targetGroupId = groupId || data?.groupId;
      if (targetGroupId) {
        const group = await repos.inventoryRepo.getGroupById(targetGroupId);
        setGroupName(group?.name);
      } else {
        setGroupName(undefined);
      }
      if (data?.images?.length) {
        prefetchSignedUrls(data.images.map((img) => img.storagePath).filter(Boolean)).catch(() => {});
      }
      if (!data) setLoadError(true);
    } catch (error) {
      console.error('Error loading item:', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const isGlass =
    isGlassInventoryGroup(groupName) ||
    (item?.height != null && item?.width != null);
  const isImageCardItem =
    hasInventoryImageCards(groupName) ||
    (!isGlass &&
      !!(item?.images?.length || item?.position != null || item?.color != null));
  const isProfilesItem = isProfilesInventoryGroup(groupName);

  const handleEdit = () => {
    if (!item) return;
    const targetGroupId = groupId || item.groupId;
    if (!targetGroupId) {
      Alert.alert(t('common.error'), t('inventory.loadItemError'));
      return;
    }
    pushWithParams(router, '/inventory-group', {
      groupId: String(targetGroupId),
      editItemId: item.id,
    });
  };

  const handleShare = async () => {
    if (!itemId || !groupId) return;
    await shareViaWhatsApp(
      { entity: 'inventoryItem', params: { itemId, groupId } },
      `Inventory Item ${item?.name || ''}`.trim()
    );
  };

  const handlePrintLabel = async () => {
    if (!itemId || !groupId || !item) return;
    try {
      const { webUrl } = generateHybridLinks({
        entity: 'inventoryItem',
        params: { itemId, groupId },
      });
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(webUrl)}`;
      const esc = (value: string) =>
        value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

      const itemType = groupName ?? (isGlass ? 'Glass' : isProfilesItem ? 'Profiles' : 'Supplies');
      const subtitle = `Group: ${itemType}`;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              @page { size: 297mm 145mm; margin: 8mm; }
              html, body { width: 100%; height: auto; }
              body { margin: 0; font-family: Arial, sans-serif; color: #111; background: #fff; }
              .sheet { width: 281mm; max-width: 100%; margin: 0 auto; }
              .label {
                width: 100%;
                height: 129mm;
                border: 1px solid #dbe3f0;
                border-radius: 8px;
                box-sizing: border-box;
                display: flex;
                overflow: hidden;
                background: #fff;
              }
              .left-wrap { width: 70%; min-width: 0; display: flex; flex-direction: column; }
              .topbar {
                background: #000;
                color: #fff;
                font-size: 30px;
                font-weight: 700;
                letter-spacing: 0.4px;
                padding: 10px 20px;
              }
              .left {
                width: 100%;
                min-width: 0;
                padding: 18px 20px 16px;
                box-sizing: border-box;
              }
              .item-name {
                font-size: 70px;
                line-height: 1.02;
                font-weight: 800;
                margin: 0 0 10px 0;
                word-break: break-word;
              }
              .meta {
                font-size: 36px;
                color: #222;
                margin: 0;
                line-height: 1.15;
                word-break: break-word;
              }
              .qr-wrap {
                width: 30%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                background: #fff;
                border-left: 1px solid #dbe3f0;
                padding: 16px 10px 10px;
                box-sizing: border-box;
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
                <div class="left-wrap">
                  <div class="topbar">Inventory Item Label</div>
                  <div class="left">
                    <p class="item-name">${esc(item.name || '-')}</p>
                    <p class="meta">${esc(subtitle)}</p>
                  </div>
                </div>
                <div class="qr-wrap">
                  <img class="qr" src="${qrUrl}" alt="QR Code" />
                  <div class="qr-caption">Scan to open item</div>
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
      } catch {
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
      console.error('Error printing inventory label:', error);
      Alert.alert(t('common.error') || 'Error', 'Could not generate item label');
    }
  };

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (loadError || !item) {
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
    <ScreenWrapper>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <PermissionGuard permission="inventory.item.update">
          <TouchableOpacity style={styles.editHeaderButton} onPress={handleEdit} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </PermissionGuard>
      </View>

      <ScrollView style={[styles.scrollView, { backgroundColor: colors.background }]}>
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {isImageCardItem && item.images && item.images.length > 0 && (
            <View style={styles.imageSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('inventory.productImage')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
                {item.images.map((im) => (
                  <View key={im.id} style={styles.imageWrap}>
                    <DetailImage storagePath={im.storagePath} />
                    {im.isMain && (
                      <View style={[styles.mainBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.mainBadgeText}>{t('inventory.mainImage')}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('inventory.currentStock')}</Text>
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.row}>
                <Ionicons name="cube-outline" size={22} color={colors.textSecondary} />
                <Text style={[styles.value, { color: colors.text }]}>
                  {item.stock} {isGlass ? t('inventory.units') : item.unit}
                </Text>
              </View>
              {item.stock <= item.lowStockThreshold && (
                <View style={[styles.lowPill, { backgroundColor: colors.error + '20' }]}>
                  <Ionicons name="warning" size={16} color={colors.error} />
                  <Text style={[styles.lowPillText, { color: colors.error }]}>{t('inventory.lowStock')}</Text>
                </View>
              )}
            </View>
          </View>

          {isGlass && (
            <>
              {item.height != null && item.width != null && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('inventory.dimensions')}</Text>
                  <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.value, { color: colors.text }]}>
                      {item.width}mm × {item.height}mm{item.thickness != null ? ` × ${item.thickness}mm` : ''}
                    </Text>
                    {item.totalM2 != null && (
                      <Text style={[styles.secondary, { color: colors.textSecondary }]}>
                        {t('inventory.totalM2')}: {(item.totalM2 * item.stock).toFixed(2)} m²
                      </Text>
                    )}
                  </View>
                </View>
              )}
              {(item.location || item.supplier || item.referenceNumber) && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('inventory.location')}</Text>
                  <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    {item.location && <Text style={[styles.value, { color: colors.text }]}>{item.location}</Text>}
                    {item.supplier && <Text style={[styles.secondary, { color: colors.textSecondary }]}>{t('inventory.supplier')}: {item.supplier}</Text>}
                    {item.referenceNumber && <Text style={[styles.secondary, { color: colors.textSecondary }]}>{t('inventory.referenceNumber')}: {item.referenceNumber}</Text>}
                  </View>
                </View>
              )}
            </>
          )}

          {isImageCardItem &&
            (item.position ||
              (isProfilesItem && (item.color || item.type || item.opoOeschgerCode))) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('inventory.referenceCode')}</Text>
              <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                {item.position && (
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('inventory.position')}: </Text>
                    <Text style={[styles.value, { color: colors.text }]}>{item.position}</Text>
                  </View>
                )}
                {item.color && (
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('inventory.color')}: </Text>
                    <Text style={[styles.value, { color: colors.text }]}>{item.color}</Text>
                  </View>
                )}
                {item.type && (
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('inventory.type')}: </Text>
                    <Text style={[styles.value, { color: colors.text }]}>{item.type}</Text>
                  </View>
                )}
                {item.opoOeschgerCode && (
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('inventory.opoOeschgerCode')}: </Text>
                    <Text style={[styles.value, { color: colors.text }]}>{item.opoOeschgerCode}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={24} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>{t('common.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              onPress={handlePrintLabel}
              activeOpacity={0.7}
            >
              <Ionicons name="print-outline" size={24} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>{t('common.print')}</Text>
            </TouchableOpacity>
            <PermissionGuard permission="inventory.item.adjustStock">
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
                onPress={() => pushWithParams(router, '/inventory-stock-count', { itemId: item.id })}
                activeOpacity={0.7}
              >
                <Ionicons name="calculator" size={24} color={colors.success} />
                <Text style={[styles.actionButtonText, { color: colors.success }]}>{t('inventory.adjustStock')}</Text>
              </TouchableOpacity>
            </PermissionGuard>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.fontSize.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  editHeaderButton: {
    padding: theme.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    marginBottom: theme.spacing.sm,
  },
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  label: { fontSize: theme.typography.fontSize.md },
  value: { fontSize: theme.typography.fontSize.md, fontWeight: theme.typography.fontWeight.medium, flex: 1 },
  secondary: { fontSize: theme.typography.fontSize.sm, marginTop: theme.spacing.xs },
  lowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  lowPillText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  imageSection: { marginBottom: theme.spacing.lg },
  imageRow: { flexDirection: 'row', gap: theme.spacing.sm },
  imageWrap: { position: 'relative' },
  detailImageBox: {
    width: 120,
    height: 120,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  detailImage: { width: '100%', height: '100%' },
  mainBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: theme.spacing.xs,
    alignItems: 'center',
  },
  mainBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    color: '#fff',
    fontWeight: theme.typography.fontWeight.semibold,
  },
  actions: { marginTop: theme.spacing.md, gap: theme.spacing.sm },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    gap: theme.spacing.sm,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
