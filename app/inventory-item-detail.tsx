import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useI18n } from '../src/hooks/use-i18n';
import { repos } from '../src/services/container';
import { InventoryItem } from '../src/types';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { PermissionGuard } from '../src/components/shared/PermissionGuard';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

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
      <Image source={{ uri: url }} style={styles.detailImage} contentFit="cover" />
    </View>
  );
}

export default function InventoryItemDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { itemId, groupId } = useLocalSearchParams<{ itemId: string; groupId: string }>();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (itemId) loadItem();
  }, [itemId]);

  const loadItem = async () => {
    if (!itemId) return;
    setIsLoading(true);
    try {
      const data = await repos.inventoryRepo.getItemById(itemId);
      setItem(data ?? null);
      if (!data) {
        Alert.alert(t('common.error'), t('inventory.loadItemError'), [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error loading item:', error);
      Alert.alert(t('common.error'), t('inventory.loadItemError'));
    } finally {
      setIsLoading(false);
    }
  };

  const isGlass = item?.height != null && item?.width != null;
  const isSupplies = groupId && (groupId.includes('supplies') || (item && !item.height && (item.position != null || item.color != null)));

  const handleEdit = () => {
    if (!groupId || !item) return;
    router.replace({
      pathname: '/inventory-group',
      params: { groupId, editItemId: item.id },
    });
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

  if (!item) {
    return null;
  }

  return (
    <ScreenWrapper>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
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
          {isSupplies && item.images && item.images.length > 0 && (
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

          {isSupplies && (item.position || item.color || item.type || item.opoOeschgerCode) && (
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
            <PermissionGuard permission="inventory.item.adjustStock">
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
                onPress={() => router.push({ pathname: '/inventory-stock-count', params: { itemId: item.id } })}
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
